"""IHSG identity must stay consistent across history, quotes and news."""
from datetime import datetime
from unittest import TestCase
from unittest.mock import patch

import pandas as pd
import app
import market_data as market
from instruments import instrument, normalise_symbol


class IHSGTests(TestCase):
    def setUp(self):
        app.cache.clear()
        market._cache.clear()
        self.frame = pd.DataFrame(
            {"Open": [5200.25, 5300.5], "High": [5300.5, 5400.75],
             "Low": [5150.25, 5250.5], "Close": [5250.5, 5385.69677734375],
             "Volume": [0, 0]},
            index=pd.to_datetime(["2026-10-21T09:00:00+07:00", "2026-10-22T09:00:00+07:00"]),
        )

    def test_aliases_share_provider_symbol_and_cache(self):
        with patch.object(app.yf, "Ticker") as ticker, app.app.test_client() as client:
            ticker.return_value.history.return_value = self.frame
            payloads = [client.get('/api/history', query_string={"symbol":alias,"range":"1d"}).get_json()
                        for alias in ("IHSG", "jkse", "^JKSE")]
            ticker.assert_called_once_with("^JKSE")
        self.assertTrue(all(data == payloads[0] for data in payloads))
        value = payloads[0]
        self.assertEqual((value["symbol"], value["code"], value["unit"]), ("^JKSE", "IHSG", "poin"))
        self.assertIsNone(value["currency"])
        self.assertEqual(value["summary"]["last"], 5385.69677734375)
        self.assertFalse(value["show_volume"])
        self.assertIsNone(value["summary"]["volume"])

    def test_stock_mapping_and_validation_are_preserved(self):
        self.assertEqual(normalise_symbol(" bbca.jk "), "BBCA.JK")
        self.assertEqual(instrument("BBCA")["unit"], "IDR")
        for invalid in ("^GSPC", "AAPL.US", "../../IHSG", "^JKSE.JK/", ""):
            with self.assertRaises(ValueError): normalise_symbol(invalid)

    def test_quotes_deduplicate_index_aliases_before_fetching(self):
        with patch.object(app, "get_quotes", return_value={"quotes": []}) as quotes, app.app.test_client() as client:
            response = client.get('/api/quotes', query_string={"symbols":"IHSG,^JKSE,JKSE,BBCA"})
            self.assertEqual(response.status_code, 200)
            quotes.assert_called_once_with(["^JKSE", "BBCA.JK"])

    def test_index_quote_has_canonical_code_and_previous_session_change(self):
        quote = market.quote_from_frame(self.frame, "^JKSE")
        self.assertEqual(quote["code"], "IHSG")
        self.assertEqual(quote["unit"], "poin")
        self.assertEqual(quote["previous_close"], 5250.5)
        self.assertAlmostEqual(quote["change_percent"], (5385.69677734375/5250.5-1)*100)

    def test_quote_failure_still_identifies_ihsg(self):
        with patch.object(market.yf, "Ticker") as ticker:
            ticker.return_value.history.side_effect = TimeoutError()
            value = market.get_quote("^JKSE")
        self.assertEqual((value["code"], value["symbol"]), ("IHSG", "^JKSE"))
        self.assertIsNotNone(value["error"])

    def test_news_query_and_relevance_use_index_names(self):
        def article(title, n):
            return {"title":title,"description":"","url":f"https://example.com/{n}","source":"Test",
                    "published_at":"2026-10-22T10:00:00+07:00"}
        candidates = [article(title,n) for n,title in enumerate([
            "IHSG menguat di akhir sesi", "Indeks Harga Saham Gabungan terkoreksi",
            "Jakarta Composite rebounds", "BBCA membuka kantor baru", "JKSEXP bukan indeks",
        ])]
        selected = market.select_news(candidates,"IHSG",datetime.fromisoformat("2026-10-22T12:00:00+07:00"))
        self.assertEqual(len(selected), 3)
        with patch.object(market, "fetch_feed", return_value={"items":[],"fetched_at":"test","error":None}) as feeds:
            payload = market.get_news("^JKSE")
        self.assertEqual((payload["code"], payload["symbol"]), ("IHSG", "^JKSE"))
        urls = [call.args[0] for call in feeds.call_args_list]
        google = next(url for url in urls if "news.google.com" in url)
        self.assertIn("IHSG", google)
        self.assertNotIn("IHSG.JK", google)

    def test_news_route_normalizes_ihsg(self):
        with patch.object(app, "get_news", return_value={"symbol":"^JKSE","items":[],"error":None}) as news, app.app.test_client() as client:
            self.assertEqual(client.get('/api/news?symbol=IHSG').status_code, 200)
            news.assert_called_once_with("^JKSE")
