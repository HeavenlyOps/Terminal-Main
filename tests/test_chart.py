"""Chart regressions: interval cache separation and faithful provider candles."""
import unittest
from unittest.mock import patch

import pandas as pd
import app as terminal


def sample_frame():
    return pd.DataFrame(
        {"Open": [24, 25, 26], "High": [25, 26, 26],
         "Low": [24, 25, 26], "Close": [25, 25, 26], "Volume": [30, 40, 50]},
        index=pd.to_datetime(["2026-10-21T09:00:00+07:00", "2026-10-22T09:00:00+07:00",
                              "2026-10-22T13:30:00+07:00"]),
    )


class ChartTests(unittest.TestCase):
    def setUp(self):
        terminal.cache.clear()
        self.client = terminal.app.test_client()

    def test_interval_selection_reaches_provider_and_has_its_own_cache(self):
        with patch.object(terminal.yf, "Ticker") as ticker:
            ticker.return_value.history.return_value = sample_frame()
            first = self.client.get("/api/history?symbol=GOTO&range=1d").get_json()
            detail = self.client.get("/api/history?symbol=GOTO&range=1d&interval=1m").get_json()
            again = self.client.get("/api/history?symbol=GOTO&range=1d").get_json()
        calls = ticker.return_value.history.call_args_list
        self.assertEqual([call.kwargs["interval"] for call in calls], ["5m", "1m"])
        self.assertEqual(first["interval"], "5m")
        self.assertEqual(detail["interval"], "1m")
        self.assertEqual(again, first)

    def test_invalid_range_interval_combination_does_not_fetch(self):
        with patch.object(terminal.yf, "Ticker") as ticker:
            self.assertEqual(self.client.get("/api/history?range=1y&interval=1m").status_code, 400)
            ticker.assert_not_called()

    def test_latest_session_preserves_flat_candles_and_missing_periods(self):
        data = terminal.make_payload(sample_frame(), "GOTO.JK", "1d", "fetch-time", "1m")
        self.assertEqual(len(data["candles"]), 2)
        first, last = data["candles"]
        self.assertEqual((first["open"], first["high"], first["low"], first["close"]), (25, 26, 25, 25))
        self.assertEqual((last["open"], last["high"], last["low"], last["close"]), (26, 26, 26, 26))
        self.assertEqual(last["timestamp"], "2026-10-22T13:30:00+07:00")
        self.assertEqual(data["summary"]["volume"], 90)

    def test_daily_and_weekly_intervals_remain_distinct(self):
        with patch.object(terminal.yf, "Ticker") as ticker:
            ticker.return_value.history.return_value = sample_frame()
            daily = self.client.get("/api/history?symbol=GOTO&range=1y").get_json()
            weekly = self.client.get("/api/history?symbol=GOTO&range=1y&interval=1wk").get_json()
        self.assertEqual(daily["interval_label"], "1 hari")
        self.assertEqual(weekly["interval_label"], "1 minggu")
        self.assertEqual([call.kwargs["interval"] for call in ticker.return_value.history.call_args_list], ["1d", "1wk"])


if __name__ == "__main__":
    unittest.main()
