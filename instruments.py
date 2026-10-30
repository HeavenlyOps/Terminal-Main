"""Display codes, provider symbols, and units shared by all data endpoints."""
import re


COMPANIES = {
    "IHSG": {"name": "Indeks Harga Saham Gabungan", "aliases": ["Indeks Harga Saham Gabungan", "Jakarta Composite", "IDX Composite", "JKSE"]},
    "BBCA": {"name": "Bank Central Asia", "aliases": ["Bank Central Asia", "BCA"]},
    "BBRI": {"name": "Bank Rakyat Indonesia", "aliases": ["Bank Rakyat Indonesia", "Bank BRI", "saham BRI"]},
    "BMRI": {"name": "Bank Mandiri", "aliases": ["Bank Mandiri"]},
    "TLKM": {"name": "Telkom Indonesia", "aliases": ["Telkom Indonesia", "Telkom"]},
    "ASII": {"name": "Astra International", "aliases": ["Astra International", "saham Astra"]},
}
CODE_ALIASES = {"IHSG": "IHSG", "JKSE": "IHSG", "^JKSE": "IHSG"}


def normalise_symbol(value):
    code = value.strip().upper().removesuffix(".JK")
    if code in CODE_ALIASES:
        return "^JKSE"
    if not re.fullmatch(r"[A-Z][A-Z0-9]{1,7}", code):
        raise ValueError("Isi IHSG atau kode saham BEI, misalnya BBCA atau BBRI.")
    return code + ".JK"


def instrument(value):
    symbol = normalise_symbol(value)
    is_index = symbol == "^JKSE"
    code = "IHSG" if is_index else symbol.removesuffix(".JK")
    return {
        "code": code, "symbol": symbol,
        "name": COMPANIES.get(code, {}).get("name", code),
        "kind": "index" if is_index else "stock",
        "unit": "poin" if is_index else "IDR",
        "currency": None if is_index else "IDR",
        "suffix": "" if is_index else ".JK",
        "show_volume": not is_index,
    }


def browser_config():
    return {"instruments": {code: instrument(code) for code in COMPANIES}, "aliases": CODE_ALIASES}
