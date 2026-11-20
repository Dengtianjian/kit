export interface KTimeParts {
  hour: number;
  minute: number;
  second: number;
}

export function clampTimePart(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.round(value)));
}

export function timeToSeconds(parts: KTimeParts): number {
  return parts.hour * 3600 + parts.minute * 60 + parts.second;
}

export function normalizeTimeParts(parts: Partial<KTimeParts> | null | undefined): KTimeParts {
  return {
    hour: clampTimePart(Number(parts?.hour ?? 0), 23),
    minute: clampTimePart(Number(parts?.minute ?? 0), 59),
    second: clampTimePart(Number(parts?.second ?? 0), 59),
  };
}

export function parseTimeString(value: string | null | undefined): KTimeParts | null {
  if (!value || typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return { hour, minute, second };
}

export function formatTimeString(parts: KTimeParts, withSeconds = true): string {
  const p = normalizeTimeParts(parts);
  const hh = String(p.hour).padStart(2, '0');
  const mm = String(p.minute).padStart(2, '0');
  if (!withSeconds) return `${hh}:${mm}`;
  return `${hh}:${mm}:${String(p.second).padStart(2, '0')}`;
}

export function buildTimeList(step: number, max: number): number[] {
  const safeStep = Math.max(1, Math.round(step) || 1);
  const list: number[] = [];
  for (let value = 0; value <= max; value += safeStep) list.push(value);
  return list;
}

export function formatTimeLabel(value: number): string {
  return String(value).padStart(2, '0');
}