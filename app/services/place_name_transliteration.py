"""
app/services/place_name_transliteration.py — Latin-letter readability for non-Latin place names.

This is transliteration (same name, readable letters), NOT translation (meaning).
"""
from __future__ import annotations

import re

# ISO 9–style Russian/Cyrillic → Latin (place-name friendly).
_CYRILLIC_MAP: dict[str, str] = {
    "а": "a",
    "б": "b",
    "в": "v",
    "г": "g",
    "д": "d",
    "е": "e",
    "ё": "yo",
    "ж": "zh",
    "з": "z",
    "и": "i",
    "й": "y",
    "к": "k",
    "л": "l",
    "м": "m",
    "н": "n",
    "о": "o",
    "п": "p",
    "р": "r",
    "с": "s",
    "т": "t",
    "у": "u",
    "ф": "f",
    "х": "kh",
    "ц": "ts",
    "ч": "ch",
    "ш": "sh",
    "щ": "shch",
    "ъ": "",
    "ы": "y",
    "ь": "",
    "э": "e",
    "ю": "yu",
    "я": "ya",
    "і": "i",
    "ї": "yi",
    "є": "ye",
    "ґ": "g",
}

_GREEK_MAP: dict[str, str] = {
    "α": "a",
    "β": "v",
    "γ": "g",
    "δ": "d",
    "ε": "e",
    "ζ": "z",
    "η": "i",
    "θ": "th",
    "ι": "i",
    "κ": "k",
    "λ": "l",
    "μ": "m",
    "ν": "n",
    "ξ": "x",
    "ο": "o",
    "π": "p",
    "ρ": "r",
    "σ": "s",
    "ς": "s",
    "τ": "t",
    "υ": "y",
    "φ": "f",
    "χ": "ch",
    "ψ": "ps",
    "ω": "o",
}


def _latin_letter_ratio(text: str) -> float:
    letters = [char for char in text if char.isalpha()]
    if not letters:
        return 1.0
    latin = sum(1 for char in letters if "A" <= char <= "Z" or "a" <= char <= "z")
    return latin / len(letters)


def is_mostly_latin(text: str) -> bool:
    cleaned = text.strip()
    if not cleaned:
        return True
    return _latin_letter_ratio(cleaned) >= 0.85


def _apply_char_map(text: str, mapping: dict[str, str]) -> str:
    out: list[str] = []
    for char in text:
        lower = char.lower()
        if lower in mapping:
            converted = mapping[lower]
            if char.isupper() and converted:
                if len(converted) == 1:
                    converted = converted.upper()
                else:
                    converted = converted[0].upper() + converted[1:]
            out.append(converted)
        else:
            out.append(char)
    return "".join(out)


def transliterate_cyrillic(text: str) -> str:
    return _apply_char_map(text, _CYRILLIC_MAP)


def transliterate_greek(text: str) -> str:
    return _apply_char_map(text, _GREEK_MAP)


def _dominant_script(text: str) -> str | None:
    counts = {"cyrillic": 0, "greek": 0, "arabic": 0, "cjk": 0}
    for char in text:
        code = ord(char)
        if 0x0400 <= code <= 0x04FF:
            counts["cyrillic"] += 1
        elif 0x0370 <= code <= 0x03FF:
            counts["greek"] += 1
        elif 0x0600 <= code <= 0x06FF:
            counts["arabic"] += 1
        elif 0x4E00 <= code <= 0x9FFF or 0x3040 <= code <= 0x30FF or 0xAC00 <= code <= 0xD7AF:
            counts["cjk"] += 1
    dominant = max(counts, key=counts.get)
    return dominant if counts[dominant] > 0 else None


def transliterate_to_latin(text: str) -> str | None:
    cleaned = text.strip()
    if not cleaned or is_mostly_latin(cleaned):
        return None

    script = _dominant_script(cleaned)
    if script == "cyrillic":
        result = transliterate_cyrillic(cleaned)
    elif script == "greek":
        result = transliterate_greek(cleaned)
    else:
        # Unsupported script — keep original rather than guessing.
        return None

    result = re.sub(r"\s+", " ", result).strip()
    if not result or result.casefold() == cleaned.casefold():
        return None
    if not is_mostly_latin(result):
        return None
    return result
