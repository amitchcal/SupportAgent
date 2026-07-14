import { defaultTheme, type TenantTheme } from "./domain";

const hex = /^#[0-9a-f]{6}$/i;
const modes = new Set(["light", "dark", "system"]);
const radii = new Set(["none", "small", "medium", "large", "rounded"]);
const fonts = new Set(["Inter", "Arial", "Georgia", "system-ui"]);
export function validateThemeColors(values:unknown[]){if(values.some(value=>typeof value!=="string"||!hex.test(value)))throw new Error("Theme colors must use six-digit hexadecimal values.");return true;}

export function sanitizeTheme(value: Partial<TenantTheme> | null | undefined): TenantTheme {
  const color = (candidate: unknown, fallback: string) => typeof candidate === "string" && hex.test(candidate) ? candidate : fallback;
  return {
    mode: typeof value?.mode === "string" && modes.has(value.mode) ? value.mode : defaultTheme.mode,
    primary: color(value?.primary, defaultTheme.primary),
    secondary: color(value?.secondary, defaultTheme.secondary),
    accent: color(value?.accent, defaultTheme.accent),
    background: color(value?.background, defaultTheme.background),
    surface: color(value?.surface, defaultTheme.surface),
    text: color(value?.text, defaultTheme.text),
    mutedText: color(value?.mutedText, defaultTheme.mutedText),
    border: color(value?.border, defaultTheme.border),
    radius: typeof value?.radius === "string" && radii.has(value.radius) ? value.radius : defaultTheme.radius,
    fontFamily: typeof value?.fontFamily === "string" && fonts.has(value.fontFamily) ? value.fontFamily : defaultTheme.fontFamily,
  } as TenantTheme;
}

const radiusValues = { none: "0", small: ".25rem", medium: ".6rem", large: "1rem", rounded: "999px" };

export function themeStyle(themeInput: Partial<TenantTheme>) {
  const theme = sanitizeTheme(themeInput);
  return {
    "--color-primary": theme.primary,
    "--color-secondary": theme.secondary,
    "--color-accent": theme.accent,
    "--color-background": theme.background,
    "--color-surface": theme.surface,
    "--color-text": theme.text,
    "--color-muted-text": theme.mutedText,
    "--color-border": theme.border,
    "--radius-default": radiusValues[theme.radius],
    "--font-family": theme.fontFamily,
  } as React.CSSProperties;
}
