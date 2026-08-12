/** Transliteration helpers — same name in Latin letters, not meaning translation. */

const CYRILLIC_MAP: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
  і: "i",
  ї: "yi",
  є: "ye",
  ґ: "g",
};

const GREEK_MAP: Record<string, string> = {
  α: "a",
  β: "v",
  γ: "g",
  δ: "d",
  ε: "e",
  ζ: "z",
  η: "i",
  θ: "th",
  ι: "i",
  κ: "k",
  λ: "l",
  μ: "m",
  ν: "n",
  ξ: "x",
  ο: "o",
  π: "p",
  ρ: "r",
  σ: "s",
  ς: "s",
  τ: "t",
  υ: "y",
  φ: "f",
  χ: "ch",
  ψ: "ps",
  ω: "o",
};

function applyCharMap(text: string, mapping: Record<string, string>): string {
  let out = "";
  for (const char of text) {
    const lower = char.toLowerCase();
    if (mapping[lower] !== undefined) {
      let converted = mapping[lower]!;
      if (char !== lower && converted.length > 0) {
        converted =
          converted.length === 1
            ? converted.toUpperCase()
            : converted[0]!.toUpperCase() + converted.slice(1);
      }
      out += converted;
    } else {
      out += char;
    }
  }
  return out;
}

/** True when the label is mostly Latin letters — already readable for you. */
export function isMostlyLatinPlaceName(name: string): boolean {
  const letters = [...name].filter((char) => /\p{L}/u.test(char));
  if (letters.length === 0) return true;
  const latin = letters.filter((char) => /[A-Za-z]/.test(char)).length;
  return latin / letters.length >= 0.85;
}

function dominantScript(text: string): "cyrillic" | "greek" | null {
  let cyrillic = 0;
  let greek = 0;
  for (const char of text) {
    if (/[\u0400-\u04FF]/.test(char)) cyrillic += 1;
    else if (/[\u0370-\u03FF]/.test(char)) greek += 1;
  }
  if (cyrillic >= greek && cyrillic > 0) return "cyrillic";
  if (greek > 0) return "greek";
  return null;
}

/** Convert non-Latin place name to Latin letters (same pronunciation, not meaning). */
export function transliteratePlaceNameToLatin(text: string): string | null {
  const cleaned = text.trim();
  if (!cleaned || isMostlyLatinPlaceName(cleaned)) return null;

  const script = dominantScript(cleaned);
  let result: string;
  if (script === "cyrillic") {
    result = applyCharMap(cleaned, CYRILLIC_MAP);
  } else if (script === "greek") {
    result = applyCharMap(cleaned, GREEK_MAP);
  } else {
    return null;
  }

  result = result.replace(/\s+/g, " ").trim();
  if (!result || result.toLowerCase() === cleaned.toLowerCase()) return null;
  if (!isMostlyLatinPlaceName(result)) return null;
  return result;
}
