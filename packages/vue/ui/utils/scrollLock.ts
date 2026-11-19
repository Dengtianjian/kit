let lockCount = 0;

export function lockBody(): void {
  if (lockCount++ === 0 && typeof document !== 'undefined') {
    document.body.style.overflow = 'hidden';
  }
}

export function unlockBody(): void {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0 && typeof document !== 'undefined') {
    document.body.style.overflow = '';
  }
}