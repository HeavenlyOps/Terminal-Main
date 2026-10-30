"""Run from the app folder: python -m unittest discover -s tests -v"""
from datetime import datetime
import json
import unittest
from unittest.mock import Mock, patch

import pandas as pd

import app
import market_data as market


class WidgetTests(unittest.TestCase):
    def setUp(self):
        market._cache.clear()

    def test_quote_compares_previous_session_and_uses_wib(self):
        frame = pd.DataFrame({"Close": [100, 110]}, index=pd.to_datetime(["2026-10-20T17:00:00Z", "2026-10-21T17:00:00Z"]))
        value = market.quote_from_frame(frame, "BBCA.JK")
        self.assertEqual(value["change_percent"], 10)
        self.assertEqual(value["previous_close"], 100)
        self.assertEqual(value["session_date"], "2026-10-22")
        json.dumps(value, allow_nan=False)

    def test_one_session_does_not_invent_percentage(self):
        frame = pd.DataFrame({"Close": [110]}, index=pd.to_datetime(["2026-10-22"]))
        self.assertIsNone(market.quote_from_frame(frame, "BBCA.JK")["change_percent"])

    def test_expired_cache_failure_preserves_retrieval_time(self):
        source = Mock(return_value={"price": 110, "fetched_at": "2026-10-22T10:00:00+07:00"})
        with patch.object(market.time, "monotonic", return_value=0):
            first = market.cached("quote:test", 60, source)
        with patch.object(market.time, "monotonic", return_value=10):
            self.assertEqual(market.cached("quote:test", 60, source), first)
        source.assert_called_once()
        source.side_effect = TimeoutError("test provider failure")
        with patch.object(market.time, "monotonic", return_value=61):
            stale = market.cached("quote:test", 60, source)
        self.assertTrue(stale["stale"])
        self.assertEqual(stale["price"], 110)
        self.assertEqual(stale["fetched_at"], first["fetched_at"])
        self.assertIsNotNone(stale["error"])

    def test_rss_normalization_relevance_order_and_deduplication(self):
        xml = b'''<rss><channel>
          <item><title>BBCA laba naik - Media A</title><link>https://example.com/a</link><source>Media A</source><pubDate>Thu, 22 Oct 2026 03:00:00 GMT</pubDate></item>
          <item><title>BBRI laba naik</title><link>https://example.com/b</link><pubDate>Thu, 22 Oct 2026 04:00:00 GMT</pubDate></item>
          <item><title>BBCA laba naik - Media B</title><link>https://example.com/c</link><source>Media B</source><pubDate>Thu, 22 Oct 2026 04:00:00 GMT</pubDate></item>
          <item><title>ABBCAX tidak relevan</title><link>https://example.com/d</link><pubDate>Thu, 22 Oct 2026 05:00:00 GMT</pubDate></item>
          <item><title>Bank Central Asia buka layanan</title><link>https://example.com/e</link><pubDate>Thu, 22 Oct 2026 05:00:00 GMT</pubDate></item>
          <item><title>BBCA berita lama</title><link>https://example.com/old</link><pubDate>Thu, 22 Oct 2020 05:00:00 GMT</pubDate></item>
          <item><title>BBCA belum terbit</title><link>https://example.com/future</link><pubDate>Fri, 23 Oct 2026 05:00:00 GMT</pubDate></item>
          <item><title>BBCA tanpa tanggal</title><link>https://example.com/no-date</link></item>
          <item><title>BBCA tautan tidak aman</title><link>javascript:alert(1)</link><pubDate>Thu, 22 Oct 2026 05:00:00 GMT</pubDate></item>
        </channel></rss>'''
        parsed = market.parse_feed(xml, "Feed")
        selected = market.select_news(parsed, "BBCA", datetime.fromisoformat("2026-10-22T13:00:00+07:00"))
        self.assertEqual([item["url"] for item in selected], ["https://example.com/e", "https://example.com/c"])
        self.assertEqual(selected[-1]["title"], "BBCA laba naik")
        self.assertNotIn("description", selected[0])
        self.assertEqual(len(market.select_news(parsed, "BBRI", datetime.fromisoformat("2026-10-22T13:00:00+07:00"))), 1)

    def test_non_rss_and_entities_are_rejected(self):
        for content in [b"<html>not a feed</html>", b'<!DOCTYPE rss [<!ENTITY x "test">]><rss><channel/></rss>']:
            with self.assertRaises(ValueError):
                market.parse_feed(content, "Feed")

    def test_invalid_api_inputs_do_not_call_sources(self):
        with patch.object(app, "get_quotes") as quotes, patch.object(app, "get_news") as news, app.app.test_client() as client:
            self.assertEqual(client.get('/api/news?symbol=../../etc/passwd').status_code, 400)
            self.assertEqual(client.get('/api/quotes?symbols=BBCA,AAPL.US').status_code, 400)
            codes = ",".join("TEST" + str(i) for i in range(13))
            self.assertEqual(client.get('/api/quotes?symbols=' + codes).status_code, 400)
            quotes.assert_not_called(); news.assert_not_called()

    def test_news_failure_can_preserve_old_articles(self):
        payload = {"symbol": "BBCA.JK", "items": [{"title": "Old article"}], "error": "Provider offline"}
        with patch.object(app, "get_news", return_value=payload), app.app.test_client() as client:
            response = client.get('/api/news?symbol=BBCA')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.get_json()["error"], "Provider offline")
        payload["items"] = []
        with patch.object(app, "get_news", return_value=payload), app.app.test_client() as client:
            self.assertEqual(client.get('/api/news?symbol=BBCA').status_code, 502)


if __name__ == "__main__":
    unittest.main()
