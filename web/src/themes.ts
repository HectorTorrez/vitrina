import type { CSSProperties } from "react";

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
];

export function getTheme(value: string | undefined) {
  return themes.find((theme) => theme.value === value) ?? themes[0];
}

/** CSS variables consumed by the `store-*` Tailwind colors and `font-store`. */
export function themeStyle(value: string | undefined): CSSProperties {
  const { colors, display } = getTheme(value);
  return {
    "--s-bg": colors.bg,
    "--s-surface": colors.surface,
    "--s-ink": colors.ink,
    "--s-muted": colors.muted,
    "--s-rule": colors.rule,
    "--s-accent": colors.accent,
    "--s-accent-ink": colors.accentInk,
    "--s-soft": colors.soft,
    "--s-display": display === "serif" ? '"Fraunces", Georgia, serif' : '"Bricolage Grotesque", Inter, system-ui, sans-serif',
  } as CSSProperties;
}
