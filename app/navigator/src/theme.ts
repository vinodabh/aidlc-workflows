export interface Palette {
  bg: string;
  text: string;
  muted: string;
  line: string;
  panel: string;
  accent: string;
  accentText: string;
}

export const themes: { light: Palette; dark: Palette } = {
  light: {
    bg: "#f6f4ef",
    text: "#1c1915",
    muted: "#5c564c",
    line: "#ddd6c8",
    panel: "#fffdf8",
    accent: "#1f4d3a",
    accentText: "#f6f4ef",
  },
  dark: {
    bg: "#1a1916",
    text: "#f3efe6",
    muted: "#c4bbaa",
    line: "#3f3a32",
    panel: "#242320",
    accent: "#d7e36a",
    accentText: "#1a1915",
  },
};

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const color = Number.parseInt(hex.slice(1), 16);
  const red = channel((color >> 16) & 255);
  const green = channel((color >> 8) & 255);
  const blue = channel(color & 255);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** WCAG contrast ratio for two #rrggbb colors. */
export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}
