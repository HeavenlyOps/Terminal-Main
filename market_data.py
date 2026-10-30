"""Watchlist quotes and issuer-specific RSS news; no example prices/articles."""

from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import unescape
import logging
import math
import re
import threading
import time
from urllib.parse import urlencode, urlparse
import xml.etree.ElementTree as ET

from curl_cffi import requests
import yfinance as yf
from instruments import COMPANIES, instrument

WIB = timezone(timedelta(hours=7))
QUOTE_TTL = 60
NEWS_TTL = 120
MAX_WATCHLIST = 12
DIRECT_FEEDS = (
    ("ANTARA Bursa", "https://www.antaranews.com/rss/ekonomi-bursa.xml"),
    ("ANTARA Finansial", "https://www.antaranews.com/rss/ekonomi-finansial.xml"),
)
_cache = OrderedDict()
_cache_lock = threading.Lock()
_locks = [threading.RLock() for _ in range(32)]
logger = logging.getLogger(__name__)


def now_iso():
    return datetime.now(WIB).isoformat()


def cached(key, ttl, loader):
    """Bound memory and coalesce repeated requests, including failures."""
    lock = _locks[sum(key.encode()) % len(_locks)]
    with lock:
        with _cache_lock:
            previous = _cache.get(key)
            if previous and time.monotonic() - previous[0] < ttl:
                _cache.move_to_end(key)
                return previous[1]
        try:
            value = {**loader(), "stale": False, "error": None}
        except Exception as error:
            logger.warning("%s: %s", key, type(error).__name__)
            old = previous[1] if previous else {}
            # Keep the ORIGINAL retrieval timestamp when retaining old data.
            value = {**old, "stale": bool(old.get("fetched_at")), "error": "Sumber belum dapat dihubungi atau belum memiliki data.", "attempted_at": now_iso()}
        with _cache_lock:
            _cache[key] = (time.monotonic(), value)
            _cache.move_to_end(key)
            while len(_cache) > 100:
                _cache.popitem(last=False)
        return value


def quote_from_frame(frame, ticker):
    if frame is None or frame.empty:
        raise ValueError("No quote data")
    frame = frame.sort_index()
    frame = frame.loc[~frame.index.duplicated(keep="last")]
    closes = [(index, float(row["Close"])) for index, row in frame.iterrows()
              if math.isfinite(float(row["Close"])) and float(row["Close"]) > 0]
    if not closes:
        raise ValueError("No valid closing prices")
    last_index, price = closes[-1]
    moment = last_index.to_pydatetime()
    moment = moment.replace(tzinfo=WIB) if moment.tzinfo is None else moment.astimezone(WIB)
    previous_close = closes[-2][1] if len(closes) > 1 else None
    change = price - previous_close if previous_close else None
    info = instrument(ticker)
    return {
        **info,
        "price": price, "previous_close": previous_close, "change": change,
        "change_percent": change / previous_close * 100 if previous_close else None,
        "session_date": moment.strftime("%Y-%m-%d"),
        "fetched_at": now_iso(),
    }


def get_quote(ticker):
    def load():
        frame = yf.Ticker(ticker).history(period="5d", interval="1d", auto_adjust=False, actions=False, timeout=20, raise_errors=True)
        return quote_from_frame(frame, ticker)
    value = cached("quote:" + ticker, QUOTE_TTL, load)
    return {**instrument(ticker), **value}


def get_quotes(tickers):
    if not tickers:
        return {"quotes": [], "refresh_seconds": QUOTE_TTL}
    with ThreadPoolExecutor(max_workers=min(2, len(tickers))) as pool:
        quotes = list(pool.map(get_quote, tickers))
    return {"quotes": quotes, "refresh_seconds": QUOTE_TTL, "source": "Yahoo Finance via yfinance"}


def safe_url(value):
    if not isinstance(value, str):
        return None
    try:
        parsed = urlparse(value.strip())
        if parsed.scheme in ("https", "http") and parsed.hostname and not parsed.username and not parsed.password:
            return value.strip()
    except ValueError:
        pass
    return None


def plain_text(value):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]*>", " ", unescape(value or ""))).strip()


def parse_feed(content, fallback_source):
    if len(content) > 2_000_000 or b"<!DOCTYPE" in content.upper() or b"<!ENTITY" in content.upper():
        raise ValueError("Unsupported RSS payload")
    root = ET.fromstring(content)
    if root.tag != "rss" or root.find("channel") is None:
        raise ValueError("Response is not an RSS feed")
    articles = []
    for item in root.findall("./channel/item")[:200]:
        title = plain_text(item.findtext("title"))
        link = safe_url(item.findtext("link"))
        source = plain_text(item.findtext("source")) or fallback_source
        if source and title.endswith(" - " + source):
            title = title[:-(len(source) + 3)].strip()
        if not title or not link:
            continue
        try:
            published = parsedate_to_datetime(item.findtext("pubDate") or "")
            if published.tzinfo is None:
                published = published.replace(tzinfo=timezone.utc)
        except (TypeError, ValueError, OverflowError):
            # Never label an unknown publication time as "just now".
            continue
        articles.append({
            "title": title[:350], "url": link, "source": source[:100],
            "published_at": published.astimezone(WIB).isoformat(),
            "description": plain_text(item.findtext("description"))[:2500],
        })
    return articles


def fetch_feed(url, source):
    def load():
        response = requests.get(url, timeout=15, headers={"User-Agent": "NusantaraTerminal/0.5", "Accept": "application/rss+xml, application/xml, text/xml"})
        response.raise_for_status()
        return {"items": parse_feed(response.content, source), "fetched_at": now_iso()}
    return cached("feed:" + url, NEWS_TTL, load)


def matches_issuer(article, code):
    aliases = [code] + COMPANIES.get(code, {}).get("aliases", [])
    # Feed descriptions can establish relevance even when a headline is broad.
    text = article["title"] + " " + article.get("description", "")
    return any(re.search(r"(?<!\w)" + re.escape(alias) + r"(?!\w)", text, re.I) for alias in aliases)


def select_news(articles, code, now=None):
    now = now or datetime.now(WIB)
    selected = []
    seen_titles, seen_urls = set(), set()
    for article in sorted(articles, key=lambda item: item["published_at"], reverse=True):
        published = datetime.fromisoformat(article["published_at"])
        if not now - timedelta(days=30) <= published <= now + timedelta(minutes=5):
            continue
        title_key = re.sub(r"\W+", "", article["title"].casefold())
        if not matches_issuer(article, code) or title_key in seen_titles or article["url"] in seen_urls:
            continue
        seen_titles.add(title_key)
        seen_urls.add(article["url"])
        # Only headline, timestamp, source and link leave the backend.
        selected.append({key: article[key] for key in ("title", "url", "source", "published_at")})
    return selected[:20]


def get_news(ticker):
    info = instrument(ticker)
    code = info["code"]
    company = COMPANIES.get(code, {}).get("name")
    query_terms = [code] + ([f'"{company}"'] if company else [])
    if code == "BBCA":
        query_terms += ['"bank BCA"', '"saham BCA"']
    elif code == "IHSG":
        query_terms += ['"Jakarta Composite"', '"IDX Composite"', 'JKSE']
    query = "(" + " OR ".join(query_terms) + ") when:30d"
    google_url = "https://news.google.com/rss/search?" + urlencode({"q": query, "hl": "id", "gl": "ID", "ceid": "ID:id"})
    sources = [("Google News", google_url), *DIRECT_FEEDS]
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(lambda entry: fetch_feed(entry[1], entry[0]), sources))
    all_articles = []
    source_status = []
    for (name, _), result in zip(sources, results):
        all_articles.extend(result.get("items", []))
        source_status.append({"name": name, "ok": not result.get("error"), "stale": result.get("stale", False), "fetched_at": result.get("fetched_at")})
    success = sum(status["ok"] for status in source_status)
    items = select_news(all_articles, code)
    warnings = []
    if success < len(sources):
        warnings.append("Sebagian sumber belum dapat diperbarui. Periksa status sumber di bawah.")
    if any(status["stale"] for status in source_status):
        warnings.append("Hasil yang masih tersedia dapat memuat data dari pengambilan sebelumnya.")
    return {
        **info, "company": company or code, "items": items,
        "checked_at": now_iso(), "sources": source_status,
        "warning": " ".join(warnings), "stale": success == 0,
        "error": "Semua sumber berita belum dapat dihubungi. Coba lagi setelah dua menit." if success == 0 else None,
        "refresh_seconds": NEWS_TTL, "lookback_days": 30,
        "search_url": "https://news.google.com/search?" + urlencode({"q": " OR ".join(query_terms), "hl": "id", "gl": "ID", "ceid": "ID:id"}),
    }
