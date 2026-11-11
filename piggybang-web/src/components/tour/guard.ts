/**
 * Radix dialogs/sheets close on any pointer-down outside them. The tour's tooltip lives outside (its own layer
 * above everything), so clicks on it must not count as "outside" or the form being explained would close.
 */
export function keepOpenForTour<E extends { target: EventTarget | null; preventDefault(): void }>(handler?: (e: E) => void) {
  return (e: E) => {
    if ((e.target as Element | null)?.closest?.("[data-tour-ui]")) e.preventDefault();
    else handler?.(e);
  };
}
