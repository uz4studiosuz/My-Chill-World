import { t } from '../i18n/i18n';

/** Enhance existing windows without replacing their controllers or keyboard shortcuts. */
export function installAccessibility() {
  const root = document.getElementById('ui');
  if (!root) return;
  const enhance = () => {
    for (const button of root.querySelectorAll<HTMLButtonElement>('button')) {
      if (!button.textContent?.trim() && !button.hasAttribute('aria-label')) {
        const close = button.matches('.info-x,.side-x,.ml-x,.close,.stats-close');
        if (button.title || close) button.setAttribute('aria-label', button.title || t('Close'));
      }
    }
    for (const window of root.querySelectorAll<HTMLElement>('.menu .panel,.respanel,.embassy,.stats,.goals,.inspector')) {
      window.setAttribute('role', 'dialog');
      const title = window.querySelector('h1,h2,.emb-head b,.rp-titles b,.stats-head b');
      if (title?.textContent) window.setAttribute('aria-label', title.textContent);
    }
    for (const svg of root.querySelectorAll('button svg')) { svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false'); }
  };
  let frame = 0;
  new MutationObserver(() => {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; enhance(); });
  }).observe(root, { childList: true, subtree: true });
  enhance();
}
