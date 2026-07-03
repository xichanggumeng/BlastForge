export type ThemeMode = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "blastforge.theme";

export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var raw = window.localStorage.getItem('${THEME_STORAGE_KEY}');
    var mode = raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'light';
    var resolved = mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;
    var root = document.documentElement;
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
  } catch (e) {
    document.documentElement.dataset.theme = 'light';
  }
})();
`.trim();

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
}