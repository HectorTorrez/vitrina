import type { CSSProperties } from "react";
import type { ShopStyle } from "./catalog";

export interface StoreTheme {
  value: string;
  label: string;
  description: string;
  colors: {
    bg: string;
    surface: string;
    ink: string;
    muted: string;
    rule: string;
    accent: string;
    accentInk: string;
    soft: string;
  };
  display: "serif" | "sans";
  dark?: boolean;
}

/** Keep in sync with the theme list accepted by the API (api/panel.go). */
export const themes: StoreTheme[] = [
  {
    value: "costa", label: "Costa", description: "Verde salvia, sereno y natural",
    colors: { bg: "#eef4eb", surface: "#ffffff", ink: "#194e47", muted: "#557169", rule: "#c9d8cd", accent: "#194e47", accentInk: "#ffffff", soft: "#dfeadf" },
    display: "serif",
  },
  {
    value: "arena", label: "Arena", description: "Tonos cálidos de terracota",
    colors: { bg: "#f8efe2", surface: "#fffaf3", ink: "#5b3226", muted: "#8a6455", rule: "#e6d2bf", accent: "#b4532a", accentInk: "#ffffff", soft: "#f1e2cf" },
    display: "serif",
  },
  {
    value: "noche", label: "Noche", description: "Oscuro y elegante, con lila",
    colors: { bg: "#16161d", surface: "#21212b", ink: "#ece7ff", muted: "#a59fbf", rule: "#34343f", accent: "#b9a6ff", accentInk: "#16161d", soft: "#2a2a36" },
    display: "sans", dark: true,
  },
  {
    value: "lienzo", label: "Lienzo", description: "Blanco y negro, minimalista",
    colors: { bg: "#ffffff", surface: "#f6f6f5", ink: "#111111", muted: "#6b6b6b", rule: "#e7e5e4", accent: "#111111", accentInk: "#ffffff", soft: "#f1f1ef" },
    display: "sans",
  },
  {
    value: "rosa", label: "Rosa", description: "Fresco y femenino",
    colors: { bg: "#fff3f5", surface: "#ffffff", ink: "#4a1d2b", muted: "#8c5866", rule: "#f6cfd8", accent: "#db2763", accentInk: "#ffffff", soft: "#fde2e8" },
    display: "serif",
  },
  {
    value: "sol", label: "Sol", description: "Amarillo vibrante y alegre",
    colors: { bg: "#fff8e6", surface: "#ffffff", ink: "#33270a", muted: "#7a6634", rule: "#f1dfa8", accent: "#f2a90c", accentInk: "#241a00", soft: "#fdecc0" },
    display: "sans",
  },
  {
    value: "cielo", label: "Cielo", description: "Celeste y azul profundo",
    colors: { bg: "#eff6ff", surface: "#ffffff", ink: "#183758", muted: "#4d6680", rule: "#c8daed", accent: "#245fa3", accentInk: "#ffffff", soft: "#dceafa" },
    display: "sans",
  },
  {
    value: "lavanda", label: "Lavanda", description: "Lila suave y violeta",
    colors: { bg: "#f6f1fb", surface: "#fffcff", ink: "#402c52", muted: "#6c5779", rule: "#ddcfe8", accent: "#714497", accentInk: "#ffffff", soft: "#eadff3" },
    display: "serif",
  },
  {
    value: "bosque", label: "Bosque", description: "Verde oscuro y menta",
    colors: { bg: "#10251f", surface: "#1a322a", ink: "#e8f7eb", muted: "#adc8b7", rule: "#395447", accent: "#a2deb2", accentInk: "#153220", soft: "#254335" },
    display: "sans", dark: true,
  },
];

export function getTheme(value: string | undefined) {
  return themes.find((theme) => theme.value === value) ?? themes[0];
}

export const fontChoices: { value: NonNullable<ShopStyle["font"]>; label: string; family: string }[] = [
  { value: "", label: "Default", family: "" },
  { value: "fraunces", label: "Fraunces", family: '"Fraunces", Georgia, serif' },
  { value: "bricolage", label: "Bricolage", family: '"Bricolage Grotesque", Inter, system-ui, sans-serif' },
  { value: "playfair", label: "Playfair", family: '"Playfair Display", Georgia, serif' },
  { value: "dm-sans", label: "DM Sans", family: '"DM Sans", Inter, system-ui, sans-serif' },
  { value: "space-grotesk", label: "Space Grotesk", family: '"Space Grotesk", Inter, system-ui, sans-serif' },
];

export function relativeLuminance(hex: string) {
  const linear = (start: number) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(1) + 0.7152 * linear(3) + 0.0722 * linear(5);
}

export function contrastRatio(hexA: string, hexB: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hexA) || !/^#[0-9a-f]{6}$/i.test(hexB)) return 21;
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function contrastingText(hex: string) {
  const luminance = relativeLuminance(hex);
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? "#000000" : "#ffffff";
}

export function isDarkColor(hex: string) {
  return /^#[0-9a-f]{6}$/i.test(hex) && relativeLuminance(hex) < 0.18;
}

/** CSS variables consumed by the `store-*` Tailwind colors and `font-store`. */
export function themeStyle(value: string | undefined, accentColor?: string, style?: ShopStyle): CSSProperties {
  const { colors, display } = getTheme(value);
  const bg = style?.bgColor || colors.bg;
  const surface = style?.surfaceColor || colors.surface;
  const ink = style?.inkColor || colors.ink;
  const accent = accentColor || colors.accent;
  const fontChoice = style?.font ? fontChoices.find((f) => f.value === style.font)?.family : undefined;
  const veil = style?.veilOpacity ? `${style.veilOpacity}%` : "82%";
  return {
    "--s-bg": bg,
    "--s-surface": surface,
    "--s-ink": ink,
    "--s-muted": style?.inkColor ? `color-mix(in srgb, ${ink} 65%, ${bg})` : colors.muted,
    "--s-rule": style?.bgColor || style?.inkColor ? `color-mix(in srgb, ${ink} 18%, ${bg})` : colors.rule,
    "--s-accent": accent,
    "--s-accent-ink": accentColor ? contrastingText(accentColor) : colors.accentInk,
    "--s-soft": style?.bgColor || style?.inkColor ? `color-mix(in srgb, ${ink} 9%, ${bg})` : colors.soft,
    "--s-display": fontChoice || (display === "serif" ? '"Fraunces", Georgia, serif' : '"Bricolage Grotesque", Inter, system-ui, sans-serif'),
    "--store-veil": `color-mix(in srgb, ${bg} ${veil}, transparent)`,
  } as CSSProperties;
}

export function cardRadiusClass(radius?: ShopStyle["radius"]) {
  if (radius === "sharp") return "rounded-md";
  if (radius === "pill") return "rounded-3xl";
  return "rounded-2xl";
}

export function buttonRadiusClass(radius?: ShopStyle["radius"]) {
  if (radius === "sharp") return "rounded-md";
  if (radius === "soft") return "rounded-xl";
  return "rounded-full";
}

export function cardAspectClass(aspect?: ShopStyle["cardAspect"]) {
  if (aspect === "1/1") return "aspect-square";
  if (aspect === "4/3") return "aspect-[4/3]";
  return "aspect-[4/5]";
}

export function primaryButtonClass(buttonStyle?: ShopStyle["buttonStyle"]) {
  if (buttonStyle === "outline") return "border-2 border-store-accent text-store-ink hover:bg-store-accent hover:text-store-accent-ink";
  if (buttonStyle === "soft") return "bg-store-soft text-store-ink hover:bg-store-accent hover:text-store-accent-ink";
  return "bg-store-accent text-store-accent-ink hover:opacity-90";
}
