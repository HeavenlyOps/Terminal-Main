"""Terminal saham lokal. Jalankan: python app.py"""

import argparse
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
import logging
import math
import threading
import time
import webbrowser

from flask import Flask, jsonify, render_template, request
import yfinance as yf
from market_data import MAX_WATCHLIST, get_news, get_quotes
from instruments import browser_config, instrument, normalise_symbol


app = Flask(__name__)
WIB = timezone(timedelta(hours=7))
CACHE_SECONDS = 60
MAX_CACHE_ITEMS = 24
RANGES = {
    "1d": ("5d", "5m", "1 hari perdagangan", "5 menit"),
    "5d": ("5d", "5m", "5 hari perdagangan", "5 menit"),
    "1m": ("1mo", "30m", "1 bulan", "30 menit"),
    "3m": ("3mo", "1d", "3 bulan", "1 hari"),
    "6m": ("6mo", "1d", "6 bulan", "1 hari"),
    "1y": ("1y", "1d", "1 tahun", "1 hari"),
}
INTERVAL_LABELS = {
    "1m": "1 menit", "5m": "5 menit", "15m": "15 menit",
    "30m": "30 menit", "60m": "1 jam", "1d": "1 hari", "1wk": "1 minggu",
}
ALLOWED_INTERVALS = {
    "1d": ("1m", "5m", "15m", "30m"),
    "5d": ("5m", "15m", "30m", "60m"),
    "1m": ("30m", "60m", "1d"),
    "3m": ("1d", "1wk"), "6m": ("1d", "1wk"), "1y": ("1d", "1wk"),
}
cache = OrderedDict()
data_lock = threading.Lock()


def make_payload(frame, symbol, range_key, fetched_at, interval=None):
    """Keep prices and candle timestamps faithful to the provider response."""
    if frame is None or frame.empty:
        raise ValueError("Data belum tersedia. Periksa kode saham atau coba lagi nanti.")
    frame = frame.sort_index()
    frame = frame.loc[~frame.index.duplicated(keep="last")]
    info = instrument(symbol)
    records = []
    for timestamp, row in frame.iterrows():
        prices = [float(row[name]) for name in ("Open", "High", "Low", "Close")]
        if not all(math.isfinite(value) for value in prices):
            continue
        moment = timestamp.to_pydatetime()
        moment = moment.replace(tzinfo=WIB) if moment.tzinfo is None else moment.astimezone(WIB)
        raw_volume = float(row.get("Volume", 0))
        records.append({
            "timestamp": moment.isoformat(),
            # Plotly date coordinates deliberately use local exchange time.
            "chart_time": moment.strftime("%Y-%m-%dT%H:%M:%S"),
            "open": prices[0], "high": prices[1],
            "low": prices[2], "close": prices[3],
            "volume": (max(0, int(raw_volume)) if math.isfinite(raw_volume) else 0) if info["show_volume"] else None,
        })
    if not records:
        raise ValueError("Respons penyedia tidak berisi candle yang valid. Coba lagi nanti.")
    if range_key == "1d":
        latest_day = records[-1]["chart_time"][:10]
        records = [row for row in records if row["chart_time"][:10] == latest_day]
    _, default_interval, label, _ = RANGES[range_key]
    interval = interval or default_interval
    interval_label = INTERVAL_LABELS[interval]
    return {
        **info, "range": range_key,
        "range_label": label, "interval": interval, "interval_label": interval_label,
        "fetched_at": fetched_at, "source": "Yahoo Finance via yfinance",
        "candles": records,
        "summary": {
            "last": records[-1]["close"], "open": records[0]["open"],
            "high": max(row["high"] for row in records),
            "low": min(row["low"] for row in records),
            "volume": sum(row["volume"] for row in records) if info["show_volume"] else None,
            "last_timestamp": records[-1]["timestamp"],
        },
    }


@app.get("/")
def index():
    return render_template("index.html", instrument_config=browser_config())


@app.get("/api/quotes")
def watchlist_quotes():
    try:
        raw = request.args.get("symbols", "BBCA,BBRI,BMRI,TLKM,ASII")
        if len(raw) > 150:
            raise ValueError("Watchlist maksimal 12 kode saham/indeks.")
        tickers = list(dict.fromkeys(normalise_symbol(value) for value in raw.split(",") if value.strip()))
        if len(tickers) > MAX_WATCHLIST:
            raise ValueError("Watchlist maksimal 12 kode saham/indeks.")
    except ValueError as error:
        return jsonify(error=str(error)), 400
    return jsonify(get_quotes(tickers))


@app.get("/api/news")
def issuer_news():
    try:
        ticker = normalise_symbol(request.args.get("symbol", "BBCA"))
    except ValueError as error:
        return jsonify(error=str(error)), 400
    payload = get_news(ticker)
    return jsonify(payload), 502 if payload["error"] and not payload["items"] else 200


@app.get("/api/history")
def history():
    try:
        symbol = normalise_symbol(request.args.get("symbol", "BBCA"))
        range_key = request.args.get("range", "1d")
        if range_key not in RANGES:
            raise ValueError("Rentang grafik tidak dikenal.")
        interval = request.args.get("interval", RANGES[range_key][1])
        if interval not in ALLOWED_INTERVALS[range_key]:
            raise ValueError("Interval candle tidak tersedia untuk rentang ini.")
    except ValueError as error:
        return jsonify(error=str(error)), 400

    key = (symbol, range_key, interval)
    # Serialize upstream calls; cache successful and failed attempts to avoid
    # hammering Yahoo when several browser tabs refresh at once.
    with data_lock:
        cached = cache.get(key)
        if cached and time.monotonic() - cached[0] < CACHE_SECONDS:
            cache.move_to_end(key)
            return jsonify(cached[1]), cached[2]
        period = RANGES[range_key][0]
        try:
            frame = yf.Ticker(symbol).history(
                period=period, interval=interval, auto_adjust=False,
                actions=False, timeout=15, raise_errors=True,
            )
            payload = make_payload(frame, symbol, range_key, datetime.now(WIB).isoformat(), interval)
            status = 200
        except ValueError as error:
            app.logger.warning("Data tidak tersedia untuk %s: %s", symbol, error)
            payload = {"error": "Data belum tersedia. Periksa kode saham dan koneksi, lalu coba lagi setelah satu menit."}
            status = 502
        except Exception:
            app.logger.exception("Gagal mengambil data untuk %s", symbol)
            payload = {"error": "Yahoo Finance belum dapat dihubungi atau sedang membatasi permintaan. Tunggu satu menit, lalu coba lagi."}
            status = 502
        cache[key] = (time.monotonic(), payload, status)
        cache.move_to_end(key)
        while len(cache) > MAX_CACHE_ITEMS:
            cache.popitem(last=False)
        return jsonify(payload), status


@app.after_request
def response_headers(response):
    if request.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Terminal saham lokal")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5000)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    url = f"http://127.0.0.1:{args.port}"
    print(f"\nTerminal saham: {url}\nBiarkan jendela ini terbuka. Tekan Ctrl+C untuk berhenti.\n", flush=True)
    if not args.no_browser:
        opener = threading.Timer(1.5, lambda: webbrowser.open(url))
        opener.daemon = True
        opener.start()
    app.run(host=args.host, port=args.port, debug=False, use_reloader=False)
