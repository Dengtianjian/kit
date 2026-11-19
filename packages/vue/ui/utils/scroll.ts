export type KScrollTarget =
  | string
  | HTMLElement
  | (() => HTMLElement | null | undefined)
  | null
  | undefined;

export function resolveScrollTarget(
  target?: KScrollTarget,
): HTMLElement | Window {
  if (!target) return window;
  if (typeof target === 'string') return document.querySelector<HTMLElement>(target) ?? window;
  if (typeof target === 'function') return target() ?? window;
  return target;
}

export function getScrollTop(target: HTMLElement | Window): number {
  return target === window ? window.scrollY : target.scrollTop;
}

export function getScrollViewport(target: HTMLElement | Window): {
  top: number;
  bottom: number;
  height: number;
} {
  if (target === window) {
    return { top: 0, bottom: window.innerHeight, height: window.innerHeight };
  }
  const rect = target.getBoundingClientRect();
  return { top: rect.top, bottom: rect.bottom, height: rect.height };
}

export function addScrollListener(
  target: HTMLElement | Window,
  handler: () => void,
): () => void {
  target.addEventListener('scroll', handler, { passive: true });
  return () => target.removeEventListener('scroll', handler);
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && !!window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function scrollToY(
  target: HTMLElement | Window,
  top: number,
  smooth = true,
): void {
  const behavior: ScrollBehavior = smooth && !prefersReducedMotion() ? 'smooth' : 'auto';
  if (target === window) {
    window.scrollTo({ top, behavior });
  } else {
    target.scrollTo({ top, behavior });
  }
}