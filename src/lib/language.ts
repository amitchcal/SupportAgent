import type { ConversationMessage, SupportedLanguage } from "./domain";
import { supportedLanguages } from "./domain";

export const languageLabels: Record<SupportedLanguage, string> = {
  en: "English", hi: "हिन्दी", hinglish: "Hinglish", de: "Deutsch", fr: "Français", es: "Español", zh: "中文（普通话）", ja: "日本語",
};

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return (supportedLanguages as readonly string[]).includes(value);
}

// Model numbers, error codes, standards and common engineering abbreviations must survive translation verbatim.
export function technicalTerms(text: string) {
  const matches = text.match(/\b(?:[A-Z]{2,}[A-Z0-9/-]*|[A-Z]{0,4}\d[A-Z0-9./_-]*|ISO[- ]?\d+|IEC[- ]?\d+)\b/g) ?? [];
  return [...new Set(matches)];
}

export interface TranslationAdapter {
  translate(text: string, source: SupportedLanguage, target: SupportedLanguage, preservedTerms: string[]): Promise<string>;
}

export class CustomTranslationAdapter implements TranslationAdapter {
  constructor(private endpoint = process.env.TRANSLATION_API_URL ?? "", private apiKey = process.env.TRANSLATION_API_KEY ?? "", private fetcher: typeof fetch = fetch) {}
  async translate(text: string, source: SupportedLanguage, target: SupportedLanguage, preservedTerms: string[]) {
    if (!this.endpoint) return text;
    const url = new URL(this.endpoint);
    if (url.protocol !== "https:") throw new Error("Translation endpoint must use HTTPS.");
    const response = await this.fetcher(url, { method: "POST", headers: { "content-type": "application/json", ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}) }, body: JSON.stringify({ text, source, target, preservedTerms }), signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Translation provider returned HTTP ${response.status}.`);
    const payload = await response.json() as { translation?: string; translatedText?: string };
    const translated = String(payload.translation ?? payload.translatedText ?? "").trim();
    if (!translated) throw new Error("Translation provider returned no translated text.");
    for (const term of preservedTerms) if (!translated.includes(term)) throw new Error(`Translation changed protected technical term: ${term}`);
    return translated;
  }
}

export async function localizedMessage(input: Omit<ConversationMessage, "originalContent" | "translatedContent" | "originalLanguage" | "translatedLanguage" | "preservedTerms">, source: SupportedLanguage, target: SupportedLanguage = "en", adapter: TranslationAdapter = new CustomTranslationAdapter()): Promise<ConversationMessage> {
  const preservedTerms = technicalTerms(input.content);
  const translatedContent = source === target ? input.content : await adapter.translate(input.content, source, target, preservedTerms);
  for (const term of preservedTerms) if (!translatedContent.includes(term)) throw new Error(`Translation changed protected technical term: ${term}`);
  return { ...input, originalContent: input.content, translatedContent, originalLanguage: source, translatedLanguage: target, preservedTerms };
}
