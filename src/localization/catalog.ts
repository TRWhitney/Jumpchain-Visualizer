import i18next, { type TOptions } from "i18next";

export type TextDirection = "ltr" | "rtl";
export type TranslationMessages = Record<string, unknown>;

export type TranslationPackSource = {
  schemaVersion: unknown;
  languageTag: unknown;
  direction: unknown;
  messages: unknown;
};

export type TranslationPackManifest = Omit<TranslationPackSource, "messages">;

export type TranslationPack = {
  fileName: string;
  name: string;
  languageTag: string;
  direction: TextDirection;
  messages: TranslationMessages;
};

export type TranslationCatalog = {
  english: TranslationPack;
  languages: readonly TranslationPack[];
  byTag: ReadonlyMap<string, TranslationPack>;
};

const PACK_MAX_BYTES = 4 * 1024 * 1024;
const PACK_MAX_MESSAGES = 10_000;
const PACK_MAX_DEPTH = 8;
const MESSAGE_MAX_LENGTH = 16_384;
const FILE_NAME_MAX_LENGTH = 80;
const ALLOWED_TRANS_COMPONENTS = new Set<string>();

const canonicalLanguageTag = (value: unknown) => {
  if (typeof value !== "string" || !value || value.length > 64) return null;
  try {
    return Intl.getCanonicalLocales(value)[0] ?? null;
  } catch {
    return null;
  }
};

function flattenMessages(
  value: unknown,
  prefix = "",
  depth = 0,
  result: Record<string, string> = {},
): Record<string, string> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    depth > PACK_MAX_DEPTH
  )
    throw new Error("translation.messages.invalid");
  for (const [key, child] of Object.entries(value)) {
    if (!key || key.includes(":")) throw new Error("translation.key.invalid");
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") {
      if (child.length > MESSAGE_MAX_LENGTH)
        throw new Error("translation.message.too_long");
      if (/\b(?:https?|javascript|data):\/\//i.test(child))
        throw new Error("translation.message.url_forbidden");
      for (const match of child.matchAll(/<\/?([A-Za-z][\w-]*)\b[^>]*>/g))
        if (!ALLOWED_TRANS_COMPONENTS.has(match[1]))
          throw new Error("translation.message.component_forbidden");
      result[path] = child;
      if (Object.keys(result).length > PACK_MAX_MESSAGES)
        throw new Error("translation.messages.too_many");
    } else {
      flattenMessages(child, path, depth + 1, result);
    }
  }
  return result;
}

const tokens = (value: string) =>
  [...value.matchAll(/{{\s*([\w.]+)\s*}}|<\/?([A-Za-z][\w-]*)\s*\/?>/g)]
    .map((match) => match[1] ?? match[2])
    .sort();

export function validateTranslationPack(
  fileName: string,
  source: TranslationPackSource,
  englishMessages?: TranslationMessages,
): TranslationPack {
  const encodedBytes = new TextEncoder().encode(JSON.stringify(source)).length;
  if (encodedBytes > PACK_MAX_BYTES)
    throw new Error("translation.pack.too_large");
  const stem = fileName.replace(/\.json$/i, "");
  if (!stem || [...stem].length > FILE_NAME_MAX_LENGTH)
    throw new Error("translation.name.invalid");
  if (source.schemaVersion !== 1)
    throw new Error("translation.schema.unsupported");
  const languageTag = canonicalLanguageTag(source.languageTag);
  if (!languageTag) throw new Error("translation.language_tag.invalid");
  if (source.direction !== "ltr" && source.direction !== "rtl")
    throw new Error("translation.direction.invalid");
  const flat = flattenMessages(source.messages);
  if (englishMessages) {
    const english = flattenMessages(englishMessages);
    for (const [key, message] of Object.entries(flat)) {
      if (!(key in english)) throw new Error(`translation.key.unknown:${key}`);
      if (tokens(message).join("\0") !== tokens(english[key]).join("\0"))
        throw new Error(`translation.tokens.mismatch:${key}`);
    }
  }
  return {
    fileName,
    name: stem,
    languageTag,
    direction: source.direction,
    messages: source.messages as TranslationMessages,
  };
}

export function createTranslationCatalog(
  sources: Readonly<Record<string, TranslationPackSource>>,
): TranslationCatalog {
  const packName = (packPath: string) =>
    packPath
      .split("/")
      .at(-1)!
      .replace(/\.json$/i, "");
  const englishEntry = Object.entries(sources).find(
    ([packPath]) => packName(packPath).toLocaleLowerCase("en") === "english",
  );
  if (!englishEntry) throw new Error("translation.english.missing");
  const english = validateTranslationPack(
    packName(englishEntry[0]),
    englishEntry[1],
  );
  if (new Intl.Locale(english.languageTag).language !== "en")
    throw new Error("translation.english.invalid_tag");

  const byTag = new Map<string, TranslationPack>();
  const fileNames = new Set<string>();
  const languages = Object.entries(sources).map(([path, source]) => {
    const fileName = packName(path);
    const comparableFileName = fileName.toLocaleLowerCase("en");
    if (fileNames.has(comparableFileName))
      throw new Error(`translation.file_name.duplicate:${fileName}`);
    fileNames.add(comparableFileName);
    const pack =
      source === englishEntry[1]
        ? english
        : validateTranslationPack(fileName, source, english.messages);
    if (byTag.has(pack.languageTag))
      throw new Error(`translation.language_tag.duplicate:${pack.languageTag}`);
    byTag.set(pack.languageTag, pack);
    return pack;
  });
  languages.sort((left, right) => {
    if (left === english) return -1;
    if (right === english) return 1;
    return left.name.localeCompare(right.name, english.languageTag);
  });
  return { english, languages, byTag };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

function mergeMessageFile(
  target: Record<string, unknown>,
  incoming: Record<string, unknown>,
  prefix = "",
) {
  for (const [key, value] of Object.entries(incoming)) {
    const messageKey = prefix ? `${prefix}.${key}` : key;
    if (!(key in target)) {
      target[key] = structuredClone(value);
      continue;
    }
    if (isRecord(target[key]) && isRecord(value)) {
      mergeMessageFile(target[key], value, messageKey);
      continue;
    }
    throw new Error(`translation.key.duplicate:${messageKey}`);
  }
}

export function assembleTranslationSources(
  files: Readonly<Record<string, unknown>>,
): Record<string, TranslationPackSource> {
  const folders = new Map<
    string,
    { manifest?: TranslationPackManifest; messages: Record<string, unknown> }
  >();
  for (const [filePath, contents] of Object.entries(files)) {
    const parts = filePath.replaceAll("\\", "/").split("/");
    const fileName = parts.at(-1)!;
    const folderName = parts.at(-2);
    if (!folderName || !fileName.endsWith(".json"))
      throw new Error("translation.file_path.invalid");
    const folder = folders.get(folderName) ?? { messages: {} };
    folders.set(folderName, folder);
    if (fileName.toLocaleLowerCase("en") === "manifest.json") {
      if (folder.manifest) throw new Error("translation.manifest.duplicate");
      if (!isRecord(contents)) throw new Error("translation.manifest.invalid");
      folder.manifest = contents as TranslationPackManifest;
    } else {
      if (!isRecord(contents)) throw new Error("translation.messages.invalid");
      mergeMessageFile(folder.messages, contents);
    }
  }
  return Object.fromEntries(
    [...folders.entries()].map(([folderName, folder]) => {
      if (!folder.manifest)
        throw new Error(`translation.manifest.missing:${folderName}`);
      return [folderName, { ...folder.manifest, messages: folder.messages }];
    }),
  );
}

const productionFiles = import.meta.glob<unknown>("./languages/*/*.json", {
  eager: true,
  import: "default",
});
const testLanguageFiles = import.meta.glob<unknown>(
  "./test-languages/*/*.json",
  {
    eager: true,
    import: "default",
  },
);
const bundledFiles = {
  ...productionFiles,
  ...(import.meta.env?.VITE_E2E_LOCALES === "1" ? testLanguageFiles : {}),
};

export const translationCatalog = createTranslationCatalog(
  assembleTranslationSources(bundledFiles),
);

export const normalizeAvailableLanguage = (languageTag: unknown) => {
  const canonical = canonicalLanguageTag(languageTag);
  return canonical && translationCatalog.byTag.has(canonical)
    ? canonical
    : translationCatalog.english.languageTag;
};

export const packForLanguage = (languageTag: string) =>
  translationCatalog.byTag.get(normalizeAvailableLanguage(languageTag)) ??
  translationCatalog.english;

export function initializeLocalization() {
  if (i18next.isInitialized) return i18next;
  const resources = Object.fromEntries(
    translationCatalog.languages.map((pack) => [
      pack.languageTag,
      { translation: pack.messages },
    ]),
  );
  void i18next.init({
    resources,
    lng: translationCatalog.english.languageTag,
    fallbackLng: translationCatalog.english.languageTag,
    supportedLngs: translationCatalog.languages.map((pack) => pack.languageTag),
    initAsync: false,
    returnNull: false,
    interpolation: { escapeValue: false, skipOnVariables: true },
  });
  applyDocumentLanguage(translationCatalog.english.languageTag);
  return i18next;
}

export function applyDocumentLanguage(languageTag: string) {
  if (typeof document === "undefined") return;
  const pack = packForLanguage(languageTag);
  document.documentElement.lang = pack.languageTag;
  document.documentElement.dir = pack.direction;
}

export async function changeLanguage(languageTag: string) {
  const pack = packForLanguage(languageTag);
  await i18next.changeLanguage(pack.languageTag);
  applyDocumentLanguage(pack.languageTag);
  return pack.languageTag;
}

export const translate = (key: string, options?: TOptions) =>
  String(i18next.t(key, options)).replace(/ {2,}/g, " ");

export const localeNumber = (
  value: number,
  options?: Intl.NumberFormatOptions,
) => new Intl.NumberFormat(i18next.resolvedLanguage, options).format(value);

export const localeDate = (
  value: Date | number,
  options?: Intl.DateTimeFormatOptions,
) => new Intl.DateTimeFormat(i18next.resolvedLanguage, options).format(value);

export const localeList = (
  values: readonly string[],
  options?: Intl.ListFormatOptions,
) => new Intl.ListFormat(i18next.resolvedLanguage, options).format(values);

export const localeCompare = (left: string, right: string) =>
  new Intl.Collator(i18next.resolvedLanguage).compare(left, right);

export const localeLowerCase = (value: string) =>
  value.toLocaleLowerCase(i18next.resolvedLanguage);

export type StructuredCommandError = {
  code: string;
  parameters?: Record<string, unknown>;
};

export const isStructuredCommandError = (
  value: unknown,
): value is StructuredCommandError =>
  Boolean(
    value &&
    typeof value === "object" &&
    "code" in value &&
    typeof value.code === "string",
  );

export function translateError(error: unknown) {
  if (isStructuredCommandError(error))
    return translate(`errors.${error.code}`, {
      ...error.parameters,
      defaultValue: translate("errors.UNKNOWN_COMMAND_ERROR"),
    });
  return error instanceof Error
    ? error.message
    : translate("errors.UNKNOWN_COMMAND_ERROR");
}

initializeLocalization();
