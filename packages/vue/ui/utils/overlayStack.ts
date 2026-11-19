const overlayStack: HTMLElement[] = [];

export function pushOverlay(el: HTMLElement): void {
  removeOverlay(el);
  overlayStack.push(el);
}

export function removeOverlay(el: HTMLElement): void {
  const index = overlayStack.indexOf(el);
  if (index >= 0) overlayStack.splice(index, 1);
}

export function isTopOverlay(el: HTMLElement | null): boolean {
  return !!el && overlayStack[overlayStack.length - 1] === el;
}