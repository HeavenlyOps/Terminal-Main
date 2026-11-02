"""IDX Edge PRO (stock.arjum.com) real-time data provider.

Real-time IDX prices and daily/weekly/monthly candles, replacing the ~10 minute
delayed Yahoo feed for quotes and daily+ history. Intraday candles are not
offered by this API, so the caller keeps yfinance for those.

The API key is read from the ARJUM_API_KEY environment variable and is never
written to a log, an error message, or a cache key. Set it before launching:

    Windows CMD : set ARJUM_API_KEY=sk_live_xxx
    PowerShell  : $env:ARJUM_API_KEY = "sk_live_xxx"
    Linux/macOS : export ARJUM_API_KEY=sk_live_xxx

If the key is absent or any request fails, callers fall back to yfinance.
"""

from datetime import datetime, timedelta, timezone
import logging
import math
import os

from curl_cffi import requests

WIB = timezone(timedelta(hours=7))
BASE_URL = "https://stock.arjum.com/api"
# daily is the API default; weekly/monthly are aggregated by the provider.
SUPPORTED_FRAMES = ("daily", "weekly", "monthly")
HISTORY_MAX_LIMIT = 500
_TIMEOUT = 15
logger = logging.getLogger(__name__)


class ArjumError(RuntimeError):
    """Raised when the provider is unavailable so callers can fall back."""


def api_key():
    """Return the configured key, or None when the provider is disabled."""
    key = os.environ.get("ARJUM_API_KEY", "").strip()
    return key or None


def is_configured():
    return api_key() is not None


def _finite(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _request(path, params=None):
    """GET a provider endpoint. Raises ArjumError on any failure.

    The key never appears in raised messages: only the HTTP status or a generic
    reason is surfaced, so tracebacks and the cache stay free of the secret.
    """
    key = api_key()
    if not key:
        raise ArjumError("ARJUM_API_KEY belum diatur.")
    try:
        response = requests.get(
            f"{BASE_URL}{path}",
            params=params or {},
            headers={"X-API-Key": key, "Accept": "application/json",
                     "User-Agent": "NusantaraTerminal/0.6"},
            timeout=_TIMEOUT,
        )
    except Exception as error:  # network/transport issues -> fall back
        raise ArjumError(f"Tidak dapat menghubungi IDX Edge: {type(error).__name__}") from None
    if response.status_code == 401 or response.status_code == 403:
        raise ArjumError("API key IDX Edge ditolak (401/403). Periksa ARJUM_API_KEY.")
    if response.status_code == 429:
        raise ArjumError("Kuota harian IDX Edge habis atau terlalu sering (429).")
    if response.status_code >= 400:
        raise ArjumError(f"IDX Edge mengembalikan HTTP {response.status_code}.")
    try:
        return response.json()
    except Exception:
        raise ArjumError("Respons IDX Edge bukan JSON yang valid.") from None


# ---------------------------------------------------------------------------
# Symbol mapping: the app uses Yahoo-style symbols (BBCA.JK, ^JKSE); the
# provider uses bare codes (BBCA) and the literal "IHSG" for the index.
# ---------------------------------------------------------------------------

def to_provider_code(symbol):
    """Map a Yahoo-style symbol to the provider's code (BBCA.JK -> BBCA)."""
    if symbol in ("^JKSE", "IHSG"):
        return "IHSG"
    return symbol.removesuffix(".JK").upper()


def _resolve_ts(data_ts, served_ts, source_date=None):
    """Combine the provider's time-of-day fields into a WIB ISO timestamp.

    The quote endpoints return only a HH:MM:SS time; the index returns
    data_ts=null. We attach today's WIB date (or source_date when given) so the
    UI can show a faithful 'last updated' moment without inventing one.
    """
    now = datetime.now(WIB)
    clock = data_ts or served_ts
    day = source_date or now.strftime("%Y-%m-%d")
    if not clock:
        return now.isoformat()
    try:
        return datetime.strptime(f"{day} {clock}", "%Y-%m-%d %H:%M:%S").replace(tzinfo=WIB).isoformat()
    except ValueError:
        return now.isoformat()


def _quote_from_block(block, market=None):
    """Normalise one provider price block into the app's quote shape."""
    price = _finite(block.get("last_price"))
    if price is None:
        raise ArjumError("Blok harga tanpa last_price yang valid.")
    change = _finite(block.get("change"))
    change_pct = _finite(block.get("change_pct"))
    previous_close = price - change if change is not None else None
    ts = _resolve_ts(block.get("data_ts"), block.get("served_ts"), block.get("source_date"))
    return {
        "price": price,
        "previous_close": previous_close,
        "change": change,
        "change_percent": change_pct,
        "session_date": ts[:10],
        "fetched_at": datetime.now(WIB).isoformat(),
        "quote_ts": ts,
        "market_state": block.get("market_state") or (market or {}).get("status"),
        "market_label": block.get("market_label") or (market or {}).get("label"),
        "no_trade_today": bool(block.get("no_trade_today", False)),
        "source": "IDX Edge PRO (stock.arjum.com)",
    }


def get_price(symbol):
    """Real-time quote for one Yahoo-style symbol. Raises ArjumError on failure."""
    code = to_provider_code(symbol)
    data = _request(f"/price/{code}")
    return _quote_from_block(data)


def get_prices(symbols):
    """Batch real-time quotes. Returns {yahoo_symbol: quote} for those found.

    One request serves the whole watchlist (plus IHSG), which is what keeps the
    free 1,000 req/day quota comfortable.
    """
    pairs = [(symbol, to_provider_code(symbol)) for symbol in symbols]
    codes = sorted({code for _, code in pairs})
    if not codes:
        return {}
    data = _request("/price/list", params={"codes": ",".join(codes)})
    stocks = data.get("stocks") or {}
    market = data.get("market") or {}
    out = {}
    for symbol, code in pairs:
        block = stocks.get(code)
        if not isinstance(block, dict):
            continue
        try:
            out[symbol] = _quote_from_block(block, market)
        except ArjumError:
            continue
    return out


def supports_frame(frame):
    return frame in SUPPORTED_FRAMES


def get_history(symbol, frame="daily", limit=HISTORY_MAX_LIMIT):
    """Return OHLCV candles for daily/weekly/monthly frames.

    Yields a list of dicts: timestamp (WIB ISO), chart_time, open/high/low/close,
    volume. Raises ArjumError on failure or for unsupported (intraday) frames.
    """
    if frame not in SUPPORTED_FRAMES:
        raise ArjumError(f"IDX Edge tidak menyediakan frame '{frame}'.")
    code = to_provider_code(symbol)
    limit = max(20, min(int(limit), HISTORY_MAX_LIMIT))
    data = _request(f"/history/{code}", params={"frame": frame, "limit": limit})
    rows = data.get("rows")
    if not isinstance(rows, list) or not rows:
        raise ArjumError("Riwayat IDX Edge kosong.")
    candles = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        prices = [_finite(row.get(name)) for name in ("open", "high", "low", "close")]
        if any(value is None for value in prices):
            continue
        date = row.get("date")
        try:
            moment = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=WIB)
        except (TypeError, ValueError):
            continue
        volume = _finite(row.get("volume"))
        candles.append({
            "timestamp": moment.isoformat(),
            "chart_time": moment.strftime("%Y-%m-%dT%H:%M:%S"),
            "open": prices[0], "high": prices[1], "low": prices[2], "close": prices[3],
            "volume": max(0, int(volume)) if volume is not None else 0,
        })
    if not candles:
        raise ArjumError("Riwayat IDX Edge tidak berisi candle yang valid.")
    candles.sort(key=lambda c: c["chart_time"])
    return candles
