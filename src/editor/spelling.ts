export type SpellingEngine = {
  correct: (word: string) => boolean;
  suggest: (word: string) => string[];
};

export type SpellingCorrection = {
  word: string;
  from: number;
  to: number;
  suggestions: readonly string[];
};

const wordPattern = /\p{L}+(?:['’]\p{L}+)*/gu;
let englishEngine: SpellingEngine | null = null;
let englishEngineRequest: Promise<SpellingEngine | null> | null = null;

function interpolationContains(value: string, from: number, to: number) {
  const opening = value.lastIndexOf("{{", from);
  const closingBefore = value.lastIndexOf("}}", from);
  return opening > closingBefore && value.indexOf("}}", to) >= to;
}

export function spellingWordRange(
  value: string,
  selectionStart: number,
  selectionEnd: number,
) {
  const selected = value.slice(selectionStart, selectionEnd);
  if (
    selectionEnd > selectionStart &&
    selected.match(/^\p{L}+(?:['’]\p{L}+)*$/u)
  )
    return interpolationContains(value, selectionStart, selectionEnd)
      ? null
      : { word: selected, from: selectionStart, to: selectionEnd };

  const caret =
    selectionStart > 0 &&
    !value.slice(selectionStart, selectionStart + 1).match(/\p{L}/u)
      ? selectionStart - 1
      : selectionStart;
  wordPattern.lastIndex = 0;
  for (const match of value.matchAll(wordPattern)) {
    const from = match.index;
    const to = from + match[0].length;
    if (caret < from) break;
    if (caret >= from && caret < to)
      return interpolationContains(value, from, to)
        ? null
        : { word: match[0], from, to };
  }
  return null;
}

function suggestionCase(word: string, suggestion: string) {
  if (word === word.toUpperCase()) return suggestion.toUpperCase();
  if (/^\p{Lu}/u.test(word))
    return suggestion.slice(0, 1).toUpperCase() + suggestion.slice(1);
  return suggestion;
}

export function spellingCorrectionAt(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  engine: SpellingEngine,
): SpellingCorrection | null {
  const range = spellingWordRange(value, selectionStart, selectionEnd);
  if (!range || engine.correct(range.word)) return null;
  const suggestions = [
    ...new Set(
      engine
        .suggest(range.word)
        .map((suggestion) => suggestionCase(range.word, suggestion))
        .filter((suggestion) => suggestion !== range.word),
    ),
  ].slice(0, 5);
  return suggestions.length ? { ...range, suggestions } : null;
}

async function dictionaryText(path: string) {
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
  if (!response.ok) throw new Error(`Unable to load ${path}`);
  return response.text();
}

export async function loadEnglishSpellingEngine() {
  if (englishEngine) return englishEngine;
  englishEngineRequest ??= Promise.all([
    import("nspell"),
    dictionaryText("dictionaries/en.aff"),
    dictionaryText("dictionaries/en.dic"),
  ])
    .then(([module, aff, dic]) => {
      englishEngine = module.default(aff, dic);
      return englishEngine;
    })
    .catch(() => null);
  return englishEngineRequest;
}
