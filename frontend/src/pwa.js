export function registerHolaPwa() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
      registration.update().catch(() => {});
      // Never reload automatically: editors may have an unsaved contribution.
      // The next navigation will use the current application bundle.
    } catch (error) {
      console.warn('[Hola Maps] Service worker registration failed:', error);
    }
  }, { once: true });
}
