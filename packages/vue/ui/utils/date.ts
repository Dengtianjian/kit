import dayjs from 'dayjs';
import type { ConfigType, Dayjs, OpUnitType } from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear.js';
import weekOfYear from 'dayjs/plugin/weekOfYear.js';
import weekYear from 'dayjs/plugin/weekYear.js';
import advancedFormat from 'dayjs/plugin/advancedFormat.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import 'dayjs/locale/zh-cn.js';

/**
 * KDatePicker 日期引擎（dayjs 单例 + 插件全局 extend 一次）。
 * locale 不做全局切换：kDayjs() 逐实例 .locale('zh-cn')，避免污染宿主应用的 dayjs。
 * 周起点随 zh-cn = 周一；周格式年份用 weekYear()（跨年周如 2027-01-01 属 2026 年第 53 周）。
 */

dayjs.extend(quarterOfYear);
dayjs.extend(weekOfYear);
dayjs.extend(weekYear);
dayjs.extend(advancedFormat);
dayjs.extend(customParseFormat);

export type KPickerMode = 'date' | 'week' | 'month' | 'quarter' | 'year';
export type KDateViewLevel = 'date' | 'month' | 'year';

export interface KDateCell {
  /** 单元格周期起点（date 层 = 当日 0 点；month 层 = 月/季首；year 层 = 年首） */
  date: Dayjs;
  ts: number;
  label: string;
  /** 是否属于当前视图周期（date 层 = 本月；year 层 = 本十年；month/quarter 恒 true） */
  inView: boolean;
  today: boolean;
  selected: boolean;
  disabled: boolean;
}

export function kDayjs(v?: ConfigType): Dayjs {
  return dayjs(v).locale('zh-cn');
}

export const PICKER_FORMAT: Record<KPickerMode, string> = {
  date: 'YYYY-MM-DD',
  week: 'YYYY-wo',
  month: 'YYYY-MM',
  quarter: 'YYYY-[Q]Q',
  year: 'YYYY',
};

/** 按候选格式严格解析文本；全部失败返回 null */
export function parsePicker(text: string, formats: string[]): Dayjs | null {
  const value = text.trim();
  if (!value) return null;
  for (const format of formats) {
    const d = dayjs(value, format, true);
    if (d.isValid()) return d.locale('zh-cn');
  }
  return null;
}

export function formatPicker(d: Dayjs, picker: KPickerMode, format?: string): string {
  if (format) return d.format(format);
  // 'YYYY-wo' 的 YYYY 是日历年，跨年周会错位：年份部分换 weekYear
  if (picker === 'week') return `${d.weekYear()}-${d.format('wo')}`;
  return d.format(PICKER_FORMAT[picker]);
}

const UNIT: Record<KPickerMode, OpUnitType> = {
  date: 'day',
  week: 'week',
  month: 'month',
  quarter: 'quarter',
  year: 'year',
};

export function startOfPicker(d: Dayjs, picker: KPickerMode): Dayjs {
  return d.startOf(UNIT[picker]);
}
export function isSamePicker(a: Dayjs, b: Dayjs, picker: KPickerMode): boolean {
  return a.isSame(b, UNIT[picker]);
}
export function addPicker(d: Dayjs, picker: KPickerMode, n: number): Dayjs {
  return d.add(n, UNIT[picker]);
}

/** picker 的落值面板层：date/week 在日期网格落值，month/quarter 在月层，year 在年层 */
export function commitLevel(picker: KPickerMode): KDateViewLevel {
  return picker === 'date' || picker === 'week' ? 'date' : picker === 'year' ? 'year' : 'month';
}
/** 面板层对应的周期粒度（quarter 复用月层网格但按季度切格） */
export function levelPicker(level: KDateViewLevel, picker: KPickerMode): KPickerMode {
  if (level === 'date') return picker;
  if (level === 'month') return picker === 'quarter' ? 'quarter' : 'month';
  return 'year';
}

export const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

export function decadeOf(view: Dayjs): number {
  return Math.floor(view.year() / 10) * 10;
}

export function panelTitle(view: Dayjs, level: KDateViewLevel): string {
  if (level === 'date') return `${view.year()}年${view.month() + 1}月`;
  if (level === 'month') return `${view.year()}年`;
  const s = decadeOf(view);
  return `${s}-${s + 9}`;
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/**
 * 面板网格：date 层 6×7（含前后月补位）；month 层 4×3（quarter 为 1×4）；year 层 4×3（十年 ±1 补位）。
 * disabled 回调按当前面板粒度调用（入参 = 单元格周期起点）。
 */
export function buildRows(
  view: Dayjs,
  level: KDateViewLevel,
  picker: KPickerMode,
  ctx: { value: Dayjs | null; disabled: (d: Dayjs) => boolean },
): KDateCell[][] {
  const lp = levelPicker(level, picker);
  const today = kDayjs();
  const decorate = (d: Dayjs, label: string, inView: boolean): KDateCell => ({
    date: d,
    ts: d.valueOf(),
    label,
    inView,
    today: isSamePicker(d, today, lp),
    selected: ctx.value ? isSamePicker(d, ctx.value, lp) : false,
    disabled: ctx.disabled(d),
  });

  if (level === 'date') {
    const start = view.startOf('month').startOf('week');
    const cells = Array.from({ length: 42 }, (_, i) => {
      const d = start.add(i, 'day');
      return decorate(d, String(d.date()), d.month() === view.month());
    });
    return chunk(cells, 7);
  }
  if (level === 'month') {
    const base = view.startOf('year');
    if (picker === 'quarter') {
      return [
        Array.from({ length: 4 }, (_, i) =>
          decorate(base.quarter(i + 1), `Q${i + 1}`, true),
        ),
      ];
    }
    return chunk(
      Array.from({ length: 12 }, (_, i) => decorate(base.month(i), `${i + 1}月`, true)),
      3,
    );
  }
  const s = decadeOf(view);
  const base = view.startOf('year');
  return chunk(
    Array.from({ length: 12 }, (_, i) => {
      const y = s - 1 + i;
      return decorate(base.year(y), String(y), y >= s && y < s + 10);
    }),
    3,
  );
}