/**
 * On the website, public/index.html shows a small loading screen until the app
 * draws its first real screen (and explains what went wrong if it never does).
 * The app calls this once it's ready. On the phone it does nothing.
 */
export function hideBootScreen(): void {
  if (typeof document === 'undefined') return;
  document.getElementById('boot')?.remove();
}
