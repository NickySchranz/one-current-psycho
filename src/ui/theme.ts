import { Platform } from "react-native";
import { useAppStore } from "@/stores/app-store";

/**
 * The practice app wears two of the client app's moods: riverbed (light)
 * and duskwood (dark). Tokens are plain hex so they work in
 * react-native-svg and StyleSheet alike.
 */
export const THEMES = [
  {
    id: "riverbed",
    name: "Riverbed",
    hint: "Warm paper, moss green, a slow steady current.",
    mode: "light",
    paper: "#faf9f6",
    accent: "#3f6f5f",
  },
  {
    id: "duskwood",
    name: "Duskwood",
    hint: "Forest dark with amber fireflies.",
    mode: "dark",
    paper: "#131a14",
    accent: "#d9a14e",
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export function isThemeId(value: string): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

export type ThemeTokens = {
  id: ThemeId;
  mode: "light" | "dark";
  bg: string;
  bgRaised: string;
  bgSunken: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  lineMain: string;
  lineAxis: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  danger: string;
  focus: string;
  radius: number;
  radiusLg: number;
  btnRadius: number;
  /** Font stacks: full CSS stacks on web, closest single family on native. */
  fontBody: string | undefined;
  fontDisplay: string | undefined;
  /** Directional flow dashes on thread lines, as in the client app. */
  flowDuration: number;
  flowDash: [number, number];
  /** … and on the main line. */
  mainFlowDuration: number;
  mainFlowDash: [number, number];
  /** Whether surfaces cast shadows. */
  shadows: boolean;
};

const webFont = (stack: string) => (Platform.OS === "web" ? stack : undefined);

const FONT_SANS = webFont(
  '"Seravek", "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", source-sans-pro, -apple-system, sans-serif',
);
const FONT_ROUNDED = webFont(
  'ui-rounded, "Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif',
);

export const THEME_TOKENS: Record<ThemeId, ThemeTokens> = {
  riverbed: {
    id: "riverbed",
    mode: "light",
    bg: "#faf9f6",
    bgRaised: "#ffffff",
    bgSunken: "#f1efe9",
    ink: "#26251f",
    inkSoft: "#6b6a61",
    inkFaint: "#a3a196",
    lineMain: "#3d3c35",
    lineAxis: "#dedbd2",
    accent: "#3f6f5f",
    accentInk: "#ffffff",
    accentSoft: "#e4ede9",
    danger: "#9c4a3c",
    focus: "#2f5fa8",
    radius: 10,
    radiusLg: 16,
    btnRadius: 6,
    fontBody: FONT_SANS,
    fontDisplay: FONT_SANS,
    flowDuration: 2400,
    flowDash: [1, 14],
    mainFlowDuration: 3200,
    mainFlowDash: [2, 26],
    shadows: true,
  },
  duskwood: {
    id: "duskwood",
    mode: "dark",
    bg: "#131a14",
    bgRaised: "#1b241c",
    bgSunken: "#0d120e",
    ink: "#e3e4d3",
    inkSoft: "#9aa38c",
    inkFaint: "#626b58",
    lineMain: "#cfd3b8",
    lineAxis: "#2a352b",
    accent: "#d9a14e",
    accentInk: "#221703",
    accentSoft: "#33301c",
    danger: "#cd7a5f",
    focus: "#9ec37a",
    radius: 12,
    radiusLg: 20,
    btnRadius: 10,
    fontBody: FONT_ROUNDED,
    fontDisplay: FONT_ROUNDED,
    flowDuration: 3600,
    flowDash: [1, 10],
    mainFlowDuration: 4200,
    mainFlowDash: [2, 20],
    shadows: true,
  },
};

/** The active theme's tokens, reactive to the theme picked in the header. */
export function useTheme(): ThemeTokens {
  const id = useAppStore((s) => s.theme);
  return THEME_TOKENS[id];
}
