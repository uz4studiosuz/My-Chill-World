import { UZ } from './uz';

export type Lang = 'en' | 'uz';
const KEY = 'mcw_lang';

let lang: Lang = (() => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'en' || v === 'uz') return v;
  } catch { /* storage blocked */ }
  return navigator.language?.toLowerCase().startsWith('uz') ? 'uz' : 'en';
})();

export const getLang = () => lang;

export function setLang(l: Lang) {
  lang = l;
  try { localStorage.setItem(KEY, l); } catch { /* storage blocked */ }
  document.documentElement.lang = l;
}

/**
 * Translate an English UI string. The English text is the key; `{name}` placeholders are filled from `vars`.
 * Missing translations fall back to English.
 */
export function t(s: string, vars?: Record<string, string | number>) {
  let out = lang === 'uz' ? UZ[s] ?? s : s;
  // development: remember texts that still have no Uzbek translation
  if (import.meta.env.DEV && lang === 'uz' && UZ[s] === undefined && /[a-z]/i.test(s)) ((window as unknown as { __missing?: Set<string> }).__missing ??= new Set()).add(s);
  if (vars) for (const k in vars) out = out.split(`{${k}}`).join(String(vars[k]));
  return out;
}
