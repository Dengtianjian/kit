<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <div
    v-else
    ref="rootEl"
    :class="[rootClasses, classNames?.root]"
    :style="styles?.root"
    :data-part="'root'"
    @keydown="onKeydown"
    @focusout="onFocusout"
  >
    <div class="k-daterange__trigger">
      <input
        ref="startInputEl"
        class="k-daterange__input"
        :class="[classNames?.field, { 'is-active': activeEdge === 'start' }]"
        :style="styles?.field"
        :id="id ? `${id}-start` : undefined"
        readonly
        autocomplete="off"
        role="combobox"
        aria-haspopup="dialog"
        :aria-expanded="open"
        :aria-controls="open ? `${uid}-panel` : undefined"
        aria-label="开始日期"
        :value="startText"
        :placeholder="startPlaceholder"
        :disabled="disabled"
        @focus="(e) => { activeEdge = 'start'; emit('focus', e) }"
        @blur="(e) => emit('blur', e)"
        @click="onInputClick('start')"
      />
      <span class="k-daterange__separator" aria-hidden="true">→</span>
      <input
        ref="endInputEl"
        class="k-daterange__input"
        :class="[classNames?.field, { 'is-active': activeEdge === 'end' }]"
        :style="styles?.field"
        :id="id ? `${id}-end` : undefined"
        readonly
        autocomplete="off"
        role="combobox"
        aria-haspopup="dialog"
        :aria-expanded="open"
        :aria-controls="open ? `${uid}-panel` : undefined"
        aria-label="结束日期"
        :value="endText"
        :placeholder="endPlaceholder"
        :disabled="disabled"
        @focus="(e) => { activeEdge = 'end'; emit('focus', e) }"
        @blur="(e) => emit('blur', e)"
        @click="onInputClick('end')"
      />
      <span class="k-daterange__suffix">
        <span
          v-if="showClear"
          class="k-daterange__clear"
          role="button"
          aria-label="清除"
          @mousedown.prevent
          @click.stop="clear"
        >
          <svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5A6.51 6.51 0 0 0 8 1.5Zm0 12A5.5 5.5 0 1 1 13.5 8 5.51 5.51 0 0 1 8 13.5Zm2.23-6.34L8.77 8l1.46 1.84a.47.47 0 1 1-.74.58L7.99 8.56 6.05 9.92a.47.47 0 1 1-.53-.78L7.31 8 5.63 6.26a.47.47 0 0 1 .67-.66L7.99 7.45 9.75 6.1a.47.47 0 1 1 .48.8Z"/></svg>
        </span>
        <span class="k-daterange__calendar" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="3" width="12" height="11" rx="1.5" /><path d="M2 6.5h12M5.5 1.5V4M10.5 1.5V4" /></svg>
        </span>
      </span>
    </div>

    <Teleport :to="teleportTarget" defer>
      <Transition name="k-daterange-drop">
        <div
          v-if="open"
          ref="popupEl"
          v-bind="popupAttrs"
          class="k-daterange__popup"
          :class="[classNames?.panel, { 'has-presets': !!presets?.length }]"
          :style="styles?.panel"
          role="dialog"
          aria-label="日期范围选择"
        >
          <div class="k-daterange__content">
            <div v-if="presets?.length" class="k-daterange__presets">
              <button
                v-for="preset in presets"
                :key="preset.label"
                type="button"
                class="k-daterange__preset"
                :class="{ 'is-active': presetActive(preset) }"
                @mousedown.prevent
                @click="applyPreset(preset)"
              >{{ preset.label }}</button>
            </div>
          <div class="k-daterange__panels">
            <section
              v-for="panel in [{ key: 'start', ts: leftTs, rows: leftRows, side: 'left' }, { key: 'end', ts: rightTs, rows: rightRows, side: 'right' }]"
              :key="panel.key"
              class="k-daterange__panel"
              :class="[`is-${panel.side}`, { 'is-active': activeEdge === panel.key }]"
              @mouseleave="hoverTs = null"
            >
              <div data-part="header" class="k-daterange__header" :class="classNames?.header" :style="styles?.header">
                <span
                  class="k-daterange__nav k-daterange__nav--prev"
                  role="button"
                  aria-label="上一月"
                  @mousedown.prevent
                  @click="shiftMonth(-1)"
                >‹</span>
                <span class="k-daterange__title">{{ panelTitle(kDayjs(panel.ts), 'date') }}</span>
                <span
                  class="k-daterange__nav k-daterange__nav--next"
                  role="button"
                  aria-label="下一月"
                  @mousedown.prevent
                  @click="shiftMonth(1)"
                >›</span>
              </div>
              <div class="k-daterange__body">
                <div class="k-daterange__weekdays" aria-hidden="true">
                  <span v-for="w in WEEKDAYS" :key="w">{{ w }}</span>
                </div>
                <div
                  data-part="grid"
                  role="grid"
                  class="k-daterange__grid"
                  :class="classNames?.grid"
                  :style="styles?.grid"
                >
                  <div v-for="(row, ri) in panel.rows" :key="ri" role="row" class="k-daterange__row">
                    <span
                      v-for="cell in row"
                      :key="cell.ts"
                      role="gridcell"
                      class="k-daterange__cell"
                      :class="[cellClasses(cell), classNames?.cell]"
                      :style="styles?.cell"
                      :aria-selected="cell.rangeStart || cell.rangeEnd"
                      :aria-disabled="cell.disabled || undefined"
                      @mouseenter="hoverTs = cell.ts"
                      @click="pick(cell)"
                    >{{ cell.label }}</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
          </div>
          <div v-if="showTime" class="k-daterange__time">
            <div
              class="k-daterange__time-row"
              :class="{ 'is-active': activeEdge === 'start' }"
              @focusin="activeEdge = 'start'"
            >
              <span class="k-daterange__time-label">开始</span>
              <select
                class="k-daterange__time-select"
                aria-label="开始小时"
                :disabled="draftStart == null"
                :value="timePart(draftStart, 'hour')"
                @change="setTimePart('start', 'hour', $event)"
              >
                <option v-for="h in HOURS" :key="h" :value="h">{{ String(h).padStart(2, '0') }}</option>
              </select>
              <select
                class="k-daterange__time-select"
                aria-label="开始分钟"
                :disabled="draftStart == null"
                :value="timePart(draftStart, 'minute')"
                @change="setTimePart('start', 'minute', $event)"
              >
                <option v-for="m in SIXTY" :key="m" :value="m">{{ String(m).padStart(2, '0') }}</option>
              </select>
              <select
                class="k-daterange__time-select"
                aria-label="开始秒"
                :disabled="draftStart == null"
                :value="timePart(draftStart, 'second')"
                @change="setTimePart('start', 'second', $event)"
              >
                <option v-for="s in SIXTY" :key="s" :value="s">{{ String(s).padStart(2, '0') }}</option>
              </select>
            </div>
            <div
              class="k-daterange__time-row"
              :class="{ 'is-active': activeEdge === 'end' }"
              @focusin="activeEdge = 'end'"
            >
              <span class="k-daterange__time-label">结束</span>
              <select
                class="k-daterange__time-select"
                aria-label="结束小时"
                :disabled="draftEnd == null"
                :value="timePart(draftEnd, 'hour')"
                @change="setTimePart('end', 'hour', $event)"
              >
                <option v-for="h in HOURS" :key="h" :value="h">{{ String(h).padStart(2, '0') }}</option>
              </select>
              <select
                class="k-daterange__time-select"
                aria-label="结束分钟"
                :disabled="draftEnd == null"
                :value="timePart(draftEnd, 'minute')"
                @change="setTimePart('end', 'minute', $event)"
              >
                <option v-for="m in SIXTY" :key="m" :value="m">{{ String(m).padStart(2, '0') }}</option>
              </select>
              <select
                class="k-daterange__time-select"
                aria-label="结束秒"
                :disabled="draftEnd == null"
                :value="timePart(draftEnd, 'second')"
                @change="setTimePart('end', 'second', $event)"
              >
                <option v-for="s in SIXTY" :key="s" :value="s">{{ String(s).padStart(2, '0') }}</option>
              </select>
            </div>
          </div>
          <div class="k-daterange__footer" :class="classNames?.footer" :style="styles?.footer">
            <span class="k-daterange__hint">
              {{ draftStart != null && draftEnd == null ? '请选择结束日期' : showTime ? '选择日期并调整时间' : '选择开始与结束日期' }}
            </span>
            <span class="k-daterange__footer-actions">
              <button
                v-if="showTime"
                type="button"
                class="k-daterange__confirm"
                :disabled="draftStart == null || draftEnd == null"
                @mousedown.prevent
                @click="commit"
              >确定</button>
              <button
                type="button"
                class="k-daterange__clear-btn"
                :disabled="!hasValue"
                @mousedown.prevent
                @click="clear"
              >清除</button>
            </span>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref, useId, useSlots, watch } from 'vue';
import type { CSSProperties, Ref, VNodeChild } from 'vue';
import type { Dayjs } from 'dayjs';
import { usePopupHost, useOverlayPosition, usePopupDismiss } from '../../composables/usePopup';
import { FORM_ITEM_KEY } from '../Form/context';
import { useBreakpoint } from '../../composables/useBreakpoint';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn, KOnPack } from '../../composables/useCustomRender';
import { kDayjs, formatPicker, buildRows, panelTitle, WEEKDAYS } from '../../utils/date';
import type { KDateCell } from '../../utils/date';

defineOptions({ name: 'KDateRangePicker' });

type DateRangePart = 'root' | 'field' | 'panel' | 'header' | 'grid' | 'cell' | 'footer';

export type KDateRange = [number, number];

export interface KDateRangePreset {
  label: string;
  /** 固定时间戳区间；常用「近 7 天」请在 setup 里先算好常量 */
  value: KDateRange;
}

export interface KDateRangeCell extends KDateCell {
  inRange: boolean;
  rangeStart: boolean;
  rangeEnd: boolean;
}

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KDateRangePickerRenderScope {
  open: boolean;
  value: KDateRange | null;
  startText: string;
  endText: string;
  draftStart: number | null;
  draftEnd: number | null;
  hoverTs: number | null;
  activeEdge: 'start' | 'end';
  showTime: boolean;
  leftView: number;
  rightView: number;
  leftTitle: string;
  rightTitle: string;
  leftRows: KDateRangeCell[][];
  rightRows: KDateRangeCell[][];
  presets: KDateRangePreset[] | undefined;
  canCommit: boolean;
  rootEl: Ref<HTMLElement | null>;
  popupEl: Ref<HTMLElement | null>;
  rootAttrs: Record<string, unknown>;
  rootOn: KOnPack;
  triggerAttrs: (edge: 'start' | 'end') => Record<string, unknown>;
  triggerOn: (edge: 'start' | 'end') => KOnPack;
  panelAttrs: Record<string, unknown>;
  cellAttrs: (cell: KDateRangeCell) => Record<string, unknown>;
  cellOn: (cell: KDateRangeCell) => KOnPack;
  prevOn: KOnPack;
  nextOn: KOnPack;
  clearOn: KOnPack;
  confirmOn: KOnPack;
  presetOn: (preset: KDateRangePreset) => KOnPack;
  timePart: (ts: number | null, unit: 'hour' | 'minute' | 'second') => number;
  updateTimePart: (edge: 'start' | 'end', unit: 'hour' | 'minute' | 'second', value: number) => void;
  hours: number[];
  minutes: number[];
  openAt: (edge: 'start' | 'end') => void;
  close: () => void;
  commit: () => void;
  clear: () => void;
  shiftMonth: (delta: number) => void;
  applyPreset: (preset: KDateRangePreset) => void;
  pick: (cell: KDateRangeCell) => void;
  slots: ReturnType<typeof useSlots>;
}

interface KDateRangePickerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'outlined' | 'filled' | 'borderless';
  status?: 'error' | 'warning';
  disabled?: boolean;
  clearable?: boolean;
  startPlaceholder?: string;
  endPlaceholder?: string;
  /** 是否选择时间（时/分/秒），默认格式随之带 HH:mm:ss */
  showTime?: boolean;
  /** 快捷区间（左侧列表；点击直接提交并关闭） */
  presets?: KDateRangePreset[];
  /** 展示格式（dayjs format） */
  format?: string;
  /** 可选范围下/上限（毫秒时间戳或可解析字符串），按天比较 */
  min?: number | string;
  max?: number | string;
  disabledDate?: (date: Dayjs) => boolean;
  id?: string;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KDateRangePickerRenderScope>;
  classNames?: Partial<Record<DateRangePart, string>>;
  styles?: Partial<Record<DateRangePart, CSSProperties>>;
}

const props = withDefaults(defineProps<KDateRangePickerProps>(), {
  size: 'md',
  variant: 'outlined',
  startPlaceholder: '开始日期',
  endPlaceholder: '结束日期',
});

const emit = defineEmits<{
  change: [value: KDateRange | null];
  focus: [e: FocusEvent];
  blur: [e: FocusEvent];
  clear: [];
}>();

const model = defineModel<KDateRange | null>({ default: null });
const { isMobile } = useBreakpoint();
const uid = useId();
const slots = useSlots();
const formItem = inject(FORM_ITEM_KEY, null);
const effectiveStatus = computed(() => props.status ?? formItem?.status.value);

const rootEl = ref<HTMLElement | null>(null);
const popupEl = ref<HTMLElement | null>(null);
const startInputEl = ref<HTMLInputElement | null>(null);
const endInputEl = ref<HTMLInputElement | null>(null);

const open = ref(false);
const activeEdge = ref<'start' | 'end'>('start');
const draftStart = ref<number | null>(null);
const draftEnd = ref<number | null>(null);
const hoverTs = ref<number | null>(null);
const focusedTs = ref<number | null>(null);
const leftTs = ref(monthTs(Date.now()));
const rightTs = computed(() => kDayjs(leftTs.value).add(1, 'month').valueOf());

function monthTs(ts: number): number {
  return kDayjs(ts).startOf('month').valueOf();
}
function dayTs(ts: number): number {
  return kDayjs(ts).startOf('day').valueOf();
}

const startValue = computed(() => (open.value ? draftStart.value : (model.value?.[0] ?? null)));
const endValue = computed(() => (open.value ? draftEnd.value : (model.value?.[1] ?? null)));
const hasValue = computed(() => model.value != null);
const showClear = computed(() => props.clearable && hasValue.value && !props.disabled);

function formatTs(ts: number | null): string {
  if (ts == null) return '';
  const fallback = props.showTime ? 'YYYY-MM-DD HH:mm:ss' : undefined;
  return formatPicker(kDayjs(ts), 'date', props.format ?? fallback);
}
const startText = computed(() => formatTs(startValue.value));
const endText = computed(() => formatTs(endValue.value));

const minD = computed(() => (props.min != null ? dayTs(kDayjs(props.min).valueOf()) : null));
const maxD = computed(() => (props.max != null ? dayTs(kDayjs(props.max).valueOf()) : null));

function isDisabledTs(ts: number): boolean {
  const day = dayTs(ts);
  if (props.disabledDate?.(kDayjs(day))) return true;
  if (minD.value != null && day < minD.value) return true;
  if (maxD.value != null && day > maxD.value) return true;
  return false;
}

/* 提交值按区间排序；选择过程中以「已选起点 + hover」做预览 */
const rangeDays = computed<[number, number] | null>(() => {
  if (draftStart.value == null) return null;
  const startDay = dayTs(draftStart.value);
  const second = draftEnd.value ?? (hoverTs.value != null ? dayTs(hoverTs.value) : null);
  if (second == null) return null;
  const endDay = dayTs(second);
  return startDay <= endDay ? [startDay, endDay] : [endDay, startDay];
});
/* 只选了起点时仍高亮起点；hover 预览才形成完整区间 */
const rangeStart = computed(() => rangeDays.value?.[0] ?? (draftStart.value != null ? dayTs(draftStart.value) : null));
const rangeEnd = computed(() => rangeDays.value?.[1] ?? null);

function rowsFor(viewTs: number): KDateRangeCell[][] {
  return buildRows(kDayjs(viewTs), 'date', 'date', {
    value: null,
    disabled: d => isDisabledTs(d.valueOf()),
  }).map(row =>
    row.map(cell => {
      const ts = dayTs(cell.ts);
      return {
        ...cell,
        inRange:
          rangeStart.value != null &&
          rangeEnd.value != null &&
          ts > rangeStart.value &&
          ts < rangeEnd.value,
        rangeStart: rangeStart.value === ts,
        rangeEnd: rangeEnd.value === ts,
      };
    }),
  );
}

const leftRows = computed<KDateRangeCell[][]>(() => rowsFor(leftTs.value));
const rightRows = computed<KDateRangeCell[][]>(() => rowsFor(rightTs.value));

function cellClasses(cell: KDateRangeCell) {
  return {
    'is-outside': !cell.inView,
    'is-today': cell.today,
    'is-disabled': cell.disabled,
    'is-in-range': cell.inRange,
    'is-range-start': cell.rangeStart,
    'is-range-end': cell.rangeEnd,
    'is-focused': focusedTs.value != null && dayTs(focusedTs.value) === dayTs(cell.ts),
  };
}

/* ---------- 弹层基座 ---------- */
const { teleportTarget, popupClasses, popupTheme } = usePopupHost();
const { popupStyle, actualPlacement, place } = useOverlayPosition({
  anchor: rootEl,
  popup: popupEl,
  visible: open,
  placement: () => 'bottomLeft',
  target: teleportTarget,
  gap: 4,
});
usePopupDismiss(open, () => close(), () => [rootEl.value, popupEl.value]);
const popupAttrs = computed(() => ({
  id: `${uid}-panel`,
  class: popupClasses.value,
  'data-part': 'panel',
  'data-placement': actualPlacement.value.startsWith('top') ? 'top' : 'bottom',
  'data-k-theme': popupTheme.value,
  style: popupStyle.value,
}));

const rootClasses = computed(() => [
  'k-daterange',
  `k-daterange--${props.size}`,
  `k-daterange--${props.variant}`,
  {
    [`k-daterange--${effectiveStatus.value}`]: effectiveStatus.value,
    'is-disabled': props.disabled,
    'is-open': open.value,
    'is-start-active': activeEdge.value === 'start',
    'is-end-active': activeEdge.value === 'end',
  },
]);

function focusEdge(edge: 'start' | 'end') {
  activeEdge.value = edge;
  if (edge === 'end') endInputEl.value?.focus();
  else startInputEl.value?.focus();
}

function openAt(edge: 'start' | 'end') {
  if (props.disabled) return;
  activeEdge.value = edge;
  draftStart.value = model.value?.[0] ?? null;
  draftEnd.value = model.value?.[1] ?? null;
  hoverTs.value = null;
  const anchor = (edge === 'start' ? draftStart.value : (draftEnd.value ?? draftStart.value)) ?? Date.now();
  const base = monthTs(anchor);
  leftTs.value = isMobile.value
    ? base
    : edge === 'end'
      ? kDayjs(base).subtract(1, 'month').valueOf()
      : base;
  focusedTs.value = edge === 'start' ? draftStart.value : (draftEnd.value ?? draftStart.value);
  open.value = true;
  void nextTick(() => place());
}

function onInputClick(edge: 'start' | 'end') {
  if (open.value) {
    activeEdge.value = edge;
    if (isMobile.value) {
      const anchor = edge === 'start' ? (draftStart.value ?? draftEnd.value) : (draftEnd.value ?? draftStart.value);
      if (anchor != null) leftTs.value = monthTs(anchor);
    }
    return;
  }
  openAt(edge);
}

function close() {
  if (!open.value) return;
  open.value = false;
  hoverTs.value = null;
  draftStart.value = model.value?.[0] ?? null;
  draftEnd.value = model.value?.[1] ?? null;
  focusedTs.value = null;
}

function onFocusout(e: FocusEvent) {
  const target = e.relatedTarget as Node | null;
  if (target && !rootEl.value?.contains(target) && !popupEl.value?.contains(target)) close();
}

function syncView(ts: number) {
  const m = monthTs(ts);
  const left = leftTs.value;
  const right = kDayjs(left).add(1, 'month').startOf('month').valueOf();
  if (m < left) leftTs.value = m;
  else if (m >= right && m < kDayjs(right).add(1, 'month').startOf('month').valueOf()) leftTs.value = kDayjs(m).subtract(1, 'month').valueOf();
  else if (m > right) leftTs.value = kDayjs(m).subtract(1, 'month').valueOf();
}

function pickTs(ts: number, disabled = false) {
  if (props.disabled || disabled) return;
  const day = dayTs(ts);
  focusedTs.value = day;
  if (draftStart.value == null || draftEnd.value != null) {
    draftStart.value = props.showTime ? kDayjs(day).startOf('day').valueOf() : day;
    draftEnd.value = null;
    activeEdge.value = 'end';
    endInputEl.value?.focus();
    return;
  }
  if (props.showTime) {
    const startDay = dayTs(draftStart.value);
    if (day < startDay) {
      draftStart.value = kDayjs(day).startOf('day').valueOf();
      draftEnd.value = kDayjs(startDay).endOf('day').valueOf();
    } else {
      draftEnd.value = kDayjs(day).endOf('day').valueOf();
    }
  } else {
    const start = Math.min(draftStart.value, day);
    const finish = Math.max(draftStart.value, day);
    draftStart.value = start;
    draftEnd.value = finish;
  }
  hoverTs.value = null;
  if (props.showTime) {
    activeEdge.value = 'end';
    return;
  }
  commit();
}

function presetActive(preset: KDateRangePreset): boolean {
  if (model.value == null) return false;
  const start = Math.min(preset.value[0], preset.value[1]);
  const end = Math.max(preset.value[0], preset.value[1]);
  return model.value[0] === start && model.value[1] === end;
}

function applyPreset(preset: KDateRangePreset) {
  if (props.disabled) return;
  draftStart.value = Math.min(preset.value[0], preset.value[1]);
  draftEnd.value = Math.max(preset.value[0], preset.value[1]);
  commit();
}

function commit() {
  if (draftStart.value == null || draftEnd.value == null) return;
  const start = Math.min(draftStart.value, draftEnd.value);
  const end = Math.max(draftStart.value, draftEnd.value);
  draftStart.value = start;
  draftEnd.value = end;
  model.value = [start, end];
  emit('change', model.value);
  formItem?.onFieldChange();
  open.value = false;
  startInputEl.value?.focus();
}

function timePart(ts: number | null, unit: 'hour' | 'minute' | 'second'): number {
  if (ts == null) return 0;
  const d = kDayjs(ts);
  return unit === 'hour' ? d.hour() : unit === 'minute' ? d.minute() : d.second();
}

function updateTimePart(edge: 'start' | 'end', unit: 'hour' | 'minute' | 'second', value: number) {
  const current = edge === 'start' ? draftStart.value : draftEnd.value;
  if (current == null || Number.isNaN(value)) return;
  const d = kDayjs(current);
  const next = (unit === 'hour' ? d.hour(value) : unit === 'minute' ? d.minute(value) : d.second(value)).valueOf();
  activeEdge.value = edge;
  if (edge === 'start') draftStart.value = next;
  else draftEnd.value = next;
}

function setTimePart(edge: 'start' | 'end', unit: 'hour' | 'minute' | 'second', event: Event) {
  updateTimePart(edge, unit, Number((event.target as HTMLSelectElement).value));
}

function timeOptions(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}
const HOURS = timeOptions(24);
const SIXTY = timeOptions(60);

function pick(cell: KDateRangeCell) {
  pickTs(cell.ts, cell.disabled);
}

function shiftMonth(delta: number) {
  leftTs.value = kDayjs(leftTs.value).add(delta, 'month').valueOf();
  void nextTick(() => place());
}

function clear() {
  if (props.disabled || !hasValue.value) return;
  model.value = null;
  draftStart.value = null;
  draftEnd.value = null;
  emit('change', null);
  emit('clear');
  formItem?.onFieldChange();
}

function onKeydown(e: KeyboardEvent) {
  if (props.disabled || e.isComposing) return;
  if (!open.value) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      openAt(activeEdge.value);
    }
    return;
  }
  const move = (days: number) => {
    e.preventDefault();
    const base = focusedTs.value ?? draftStart.value ?? draftEnd.value ?? Date.now();
    const next = dayTs(kDayjs(base).add(days, 'day').valueOf());
    focusedTs.value = next;
    syncView(next);
  };
  switch (e.key) {
    case 'ArrowLeft':
      move(-1);
      break;
    case 'ArrowRight':
      move(1);
      break;
    case 'ArrowUp':
      move(-7);
      break;
    case 'ArrowDown':
      move(7);
      break;
    case 'Enter':
    case ' ': {
      e.preventDefault();
      if (focusedTs.value != null) pickTs(focusedTs.value, isDisabledTs(focusedTs.value));
      break;
    }
    case 'Escape':
      e.stopPropagation();
      close();
      break;
  }
}

watch(
  () => props.disabled,
  v => {
    if (v) close();
  },
);

const rootAttrs = { 'data-part': 'root' };
const rootOn: KOnPack = {
  keydown: (e) => onKeydown(e as KeyboardEvent),
  focusout: (e) => onFocusout(e as FocusEvent),
};
const triggerId = computed(() => props.id ?? formItem?.controlId);
const triggerAttrs = (edge: 'start' | 'end') => ({
  id: triggerId.value ? (edge === 'start' ? triggerId.value : `${triggerId.value}-${edge}`) : undefined,
  role: 'combobox',
  readonly: true,
  autocomplete: 'off',
  'aria-haspopup': 'dialog',
  'aria-expanded': open.value,
  'aria-controls': open.value ? `${uid}-panel` : undefined,
  'aria-invalid': formItem?.invalid.value || undefined,
  'aria-describedby': formItem?.describedBy.value,
  'aria-label': edge === 'start' ? '开始日期' : '结束日期',
  placeholder: edge === 'start' ? props.startPlaceholder : props.endPlaceholder,
  disabled: props.disabled || undefined,
  value: edge === 'start' ? startText.value : endText.value,
});
const triggerOn = (edge: 'start' | 'end'): KOnPack => ({
  focus: (e) => {
    activeEdge.value = edge;
    emit('focus', e as FocusEvent);
  },
  blur: (e) => emit('blur', e as FocusEvent),
  click: () => onInputClick(edge),
});
const panelAttrs = computed(() => ({
  id: `${uid}-panel`,
  role: 'dialog',
  'aria-label': '日期范围选择',
}));
const cellAttrs = (cell: KDateRangeCell) => ({
  'data-part': 'cell',
  role: 'gridcell',
  'aria-selected': cell.rangeStart || cell.rangeEnd,
  'aria-disabled': cell.disabled || undefined,
  'data-in-range': cell.inRange || undefined,
  'data-range-start': cell.rangeStart || undefined,
  'data-range-end': cell.rangeEnd || undefined,
  'data-outside': !cell.inView || undefined,
  'data-today': cell.today || undefined,
  'data-disabled': cell.disabled || undefined,
  'data-focused':
    (focusedTs.value != null && dayTs(focusedTs.value) === dayTs(cell.ts)) || undefined,
});
const cellOn = (cell: KDateRangeCell): KOnPack => ({
  click: () => pick(cell),
  mouseenter: () => {
    hoverTs.value = cell.ts;
  },
});
const keepFocus = (e: Event) => e.preventDefault();
const prevOn: KOnPack = { click: () => shiftMonth(-1), mousedown: keepFocus };
const nextOn: KOnPack = { click: () => shiftMonth(1), mousedown: keepFocus };
const clearOn: KOnPack = { click: () => clear(), mousedown: keepFocus };
const confirmOn: KOnPack = { click: () => commit(), mousedown: keepFocus };
const presetOn = (preset: KDateRangePreset): KOnPack => ({
  click: () => applyPreset(preset),
  mousedown: keepFocus,
});

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KDateRangePickerRenderScope>(
  () => props.render,
  () => ({
    open: open.value,
    value: model.value,
    startText: startText.value,
    endText: endText.value,
    draftStart: draftStart.value,
    draftEnd: draftEnd.value,
    hoverTs: hoverTs.value,
    activeEdge: activeEdge.value,
    showTime: !!props.showTime,
    leftView: leftTs.value,
    rightView: rightTs.value,
    leftTitle: panelTitle(kDayjs(leftTs.value), 'date'),
    rightTitle: panelTitle(kDayjs(rightTs.value), 'date'),
    leftRows: leftRows.value,
    rightRows: rightRows.value,
    presets: props.presets,
    canCommit: draftStart.value != null && draftEnd.value != null,
    rootEl,
    popupEl,
    rootAttrs,
    rootOn,
    triggerAttrs,
    triggerOn,
    panelAttrs: panelAttrs.value,
    cellAttrs,
    cellOn,
    prevOn,
    nextOn,
    clearOn,
    confirmOn,
    presetOn,
    timePart,
    updateTimePart,
    hours: HOURS,
    minutes: SIXTY,
    openAt,
    close,
    commit,
    clear,
    shiftMonth,
    applyPreset,
    pick,
    slots,
  }),
);

defineSlots<{
  render?(scope: KDateRangePickerRenderScope): VNodeChild;
}>();
defineExpose({
  focus: () => startInputEl.value?.focus(),
  blur: () => startInputEl.value?.blur(),
  open: () => openAt('start'),
  close,
  clear,
});
</script>

<style>
.k-daterange {
  --k-daterange-height: var(--k-control-height);
  --k-daterange-padding-x: var(--k-size);
  --k-daterange-radius: var(--k-border-radius);
  --k-daterange-bg: var(--k-color-bg-container);
  --k-daterange-border-color: var(--k-color-border);
  --k-daterange-border-width: var(--k-line-width);
  --k-daterange-text-color: var(--k-color-text);
  --k-daterange-placeholder-color: var(--k-color-text-tertiary);
  --k-daterange-icon-color: var(--k-color-text-tertiary);
  --k-daterange-clear-color: var(--k-color-text-quaternary);
  --k-daterange-clear-color-hover: var(--k-color-text-tertiary);
  --k-daterange-hover-border-color: var(--k-color-primary-hover);
  --k-daterange-focus-border-color: var(--k-color-primary);
  --k-daterange-outline: var(--k-control-outline);
  --k-daterange-outline-width: var(--k-control-outline-width);

  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 0 var(--k-daterange-padding-x);
  background-color: var(--k-daterange-bg);
  border: var(--k-daterange-border-width) solid var(--k-daterange-border-color);
  border-radius: var(--k-daterange-radius);
  font-family: inherit;
  transition:
    border-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    box-shadow var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-daterange *,
.k-daterange *::before,
.k-daterange *::after,
.k-daterange__popup *,
.k-daterange__popup *::before,
.k-daterange__popup *::after {
  box-sizing: border-box;
}
.k-daterange__trigger {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  height: calc(var(--k-daterange-height) - var(--k-daterange-border-width) * 2);
}
.k-daterange__input {
  flex: 1 1 0;
  min-width: 0;
  width: 50%;
  height: 100%;
  padding: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--k-daterange-text-color);
  font-size: var(--k-input-font-size);
  line-height: var(--k-line-height);
  font-family: inherit;
  text-align: center;
  cursor: pointer;
  text-overflow: ellipsis;
  border-radius: var(--k-border-radius-sm);
}
.k-daterange__input::placeholder {
  color: var(--k-daterange-placeholder-color);
  opacity: 1;
}
.k-daterange__input.is-active {
  background-color: var(--k-color-fill-tertiary);
}
.k-daterange__separator {
  flex: none;
  padding: 0 var(--k-size-xxs);
  color: var(--k-daterange-placeholder-color);
}
.k-daterange__suffix {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xxs);
  color: var(--k-daterange-icon-color);
}
.k-daterange__calendar {
  display: inline-flex;
  font-size: var(--k-font-size);
}
.k-daterange__clear {
  display: inline-flex;
  font-size: var(--k-font-size);
  color: var(--k-daterange-clear-color);
  cursor: pointer;
  visibility: hidden;
}
.k-daterange:hover .k-daterange__clear,
.k-daterange:focus-within .k-daterange__clear,
.k-daterange.is-open .k-daterange__clear {
  visibility: visible;
}
@media (hover: none) {
  .k-daterange__clear { visibility: visible; }
}
.k-daterange__clear:hover {
  color: var(--k-daterange-clear-color-hover);
}
.k-daterange:not(.is-disabled):hover {
  --k-daterange-border-color: var(--k-daterange-hover-border-color);
}
.k-daterange:focus-within:not(.is-disabled),
.k-daterange.is-open:not(.is-disabled) {
  --k-daterange-border-color: var(--k-daterange-focus-border-color);
  box-shadow: 0 0 0 var(--k-daterange-outline-width) var(--k-daterange-outline);
}
.k-daterange--error {
  --k-daterange-border-color: var(--k-color-error);
  --k-daterange-hover-border-color: var(--k-color-error);
  --k-daterange-focus-border-color: var(--k-color-error);
  --k-daterange-outline: color-mix(in oklab, var(--k-color-error) 25%, transparent);
}
.k-daterange--warning {
  --k-daterange-border-color: var(--k-color-warning);
  --k-daterange-hover-border-color: var(--k-color-warning);
  --k-daterange-focus-border-color: var(--k-color-warning);
  --k-daterange-outline: color-mix(in oklab, var(--k-color-warning) 25%, transparent);
}
.k-daterange--filled {
  --k-daterange-bg: var(--k-color-fill-tertiary);
  --k-daterange-border-color: transparent;
  --k-daterange-hover-border-color: transparent;
  --k-daterange-focus-border-color: transparent;
}
.k-daterange--borderless {
  --k-daterange-bg: transparent;
  --k-daterange-border-color: transparent;
  --k-daterange-hover-border-color: transparent;
  --k-daterange-focus-border-color: transparent;
}
.k-daterange--filled:focus-within,
.k-daterange--borderless:focus-within,
.k-daterange--filled.is-open,
.k-daterange--borderless.is-open {
  box-shadow: none;
}
.k-daterange.is-disabled {
  --k-daterange-bg: var(--k-color-fill-tertiary);
  --k-daterange-text-color: var(--k-color-text-quaternary);
  --k-daterange-border-color: var(--k-color-border);
  cursor: not-allowed;
}
.k-daterange.is-disabled .k-daterange__input {
  cursor: not-allowed;
  -webkit-text-fill-color: var(--k-daterange-text-color);
}
.k-daterange--xs { --k-daterange-height: var(--k-control-height-xs); --k-daterange-padding-x: var(--k-size-sm); }
.k-daterange--sm { --k-daterange-height: var(--k-control-height-sm); }
.k-daterange--lg { --k-daterange-height: var(--k-control-height-lg); --k-daterange-padding-x: var(--k-size-md); }

/* ---------- 弹层与双面板 ---------- */
.k-daterange__popup {
  --k-daterange-cell-h: 32px;
  z-index: var(--k-z-index-dropdown);
  width: min(590px, calc(100vw - var(--k-size-lg)));
  max-height: 76vh;
  overflow: auto;
  background-color: var(--k-color-bg-elevated);
  border-radius: var(--k-border-radius);
  box-shadow: var(--k-box-shadow-secondary);
  transform-origin: top;
  font-size: var(--k-font-size);
  color: var(--k-color-text);
}
.k-daterange__popup.has-presets { width: min(700px, calc(100vw - var(--k-size-lg))); }
.k-daterange__popup[data-placement='top'] { transform-origin: bottom; }
.k-daterange-drop-enter-active { animation: k-daterange-drop-in var(--k-motion-duration-fast) var(--k-motion-ease-out-cubic); }
.k-daterange-drop-leave-active { animation: k-daterange-drop-out var(--k-motion-duration-fast) var(--k-motion-ease-in-cubic); }
@keyframes k-daterange-drop-in {
  from { opacity: 0; transform: scaleY(0); }
  to { opacity: 1; transform: scaleY(1); }
}
@keyframes k-daterange-drop-out {
  from { opacity: 1; transform: scaleY(1); }
  to { opacity: 0; transform: scaleY(0); }
}
.k-daterange__content {
  display: flex;
  min-width: 0;
}
.k-daterange__presets {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: var(--k-size-xxs);
  width: 108px;
  padding: var(--k-size-xs);
  border-right: var(--k-line-width) solid var(--k-color-split);
  overflow: auto;
}
.k-daterange__preset {
  padding: 4px var(--k-size-xs);
  border: none;
  border-radius: var(--k-border-radius-sm);
  background: none;
  color: var(--k-color-text-secondary);
  font-size: var(--k-font-size-sm);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
}
.k-daterange__preset:hover { background-color: var(--k-color-fill-tertiary); color: var(--k-color-text); }
.k-daterange__preset.is-active { background-color: var(--k-color-primary-bg); color: var(--k-color-primary); }
.k-daterange__panels {
  flex: auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-width: 0;
}
.k-daterange__panel + .k-daterange__panel {
  border-left: var(--k-line-width) solid var(--k-color-split);
}
.k-daterange__panel.is-active .k-daterange__header {
  background-color: var(--k-color-fill-tertiary);
}
.k-daterange__header {
  display: flex;
  align-items: center;
  gap: var(--k-size-xxs);
  padding: var(--k-size-xs) var(--k-size-sm);
  border-bottom: var(--k-line-width) solid var(--k-color-split);
}
.k-daterange__nav {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--k-border-radius-sm);
  color: var(--k-color-text-tertiary);
  cursor: pointer;
  user-select: none;
}
.k-daterange__nav:hover { color: var(--k-color-text); }
.k-daterange__panel.is-left .k-daterange__nav--next { visibility: hidden; }
.k-daterange__panel.is-right .k-daterange__nav--prev { visibility: hidden; }
.k-daterange__title {
  flex: auto;
  min-width: 0;
  text-align: center;
  font-weight: var(--k-font-weight-strong);
  line-height: 24px;
}
.k-daterange__body {
  padding: var(--k-size-xs) var(--k-size-sm);
}
.k-daterange__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 2px;
}
.k-daterange__weekdays span {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  color: var(--k-color-text-tertiary);
  font-size: var(--k-font-size-sm);
}
.k-daterange__grid { display: flex; flex-direction: column; gap: 2px; }
.k-daterange__row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.k-daterange__cell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: var(--k-daterange-cell-h);
  border-radius: var(--k-border-radius-sm);
  color: var(--k-color-text);
  cursor: pointer;
  user-select: none;
  transition:
    background-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-daterange__cell:hover:not(.is-disabled):not(.is-range-start):not(.is-range-end) {
  background-color: var(--k-color-fill-tertiary);
}
.k-daterange__cell.is-outside { color: var(--k-color-text-quaternary); }
.k-daterange__cell.is-today:not(.is-range-start):not(.is-range-end) {
  color: var(--k-color-primary);
  box-shadow: inset 0 0 0 1px var(--k-color-primary);
}
.k-daterange__cell.is-in-range {
  background-color: color-mix(in oklab, var(--k-color-primary) 16%, transparent);
  border-radius: 0;
}
.k-daterange__cell.is-range-start,
.k-daterange__cell.is-range-end {
  border-radius: var(--k-border-radius-sm);
}
.k-daterange__cell.is-range-end {
  background-color: var(--k-color-primary);
  color: var(--k-color-text-light-solid);
  font-weight: var(--k-font-weight-strong);
}
.k-daterange__cell.is-range-start.is-in-range,
.k-daterange__cell.is-range-end.is-in-range {
  background-color: var(--k-color-primary);
  border-radius: var(--k-border-radius-sm);
}
.k-daterange__cell.is-range-start { border-start-end-radius: 0; border-end-end-radius: 0; }
.k-daterange__cell.is-range-end { border-start-start-radius: 0; border-end-start-radius: 0; }
.k-daterange__cell.is-range-start.is-range-end { border-radius: var(--k-border-radius-sm); }
.k-daterange__cell.is-disabled {
  color: var(--k-color-text-quaternary);
  background-color: var(--k-color-fill-tertiary);
  cursor: not-allowed;
}
.k-daterange__cell.is-focused:not(.is-range-start):not(.is-range-end) {
  box-shadow: inset 0 0 0 1px var(--k-color-primary-hover);
}
.k-daterange__time {
  display: flex;
  flex-direction: column;
  gap: var(--k-size-xxs);
  padding: var(--k-size-xs) var(--k-size-sm);
  border-top: var(--k-line-width) solid var(--k-color-split);
}
.k-daterange__time-row {
  display: flex;
  align-items: center;
  gap: var(--k-size-xxs);
  padding: 2px 4px;
  border-radius: var(--k-border-radius-sm);
}
.k-daterange__time-row.is-active {
  background-color: var(--k-color-fill-tertiary);
}
.k-daterange__time-label {
  flex: none;
  width: 32px;
  color: var(--k-color-text-tertiary);
  font-size: var(--k-font-size-sm);
}
.k-daterange__time-select {
  height: 28px;
  padding: 0 var(--k-size-xxs);
  border: var(--k-line-width) solid var(--k-color-border);
  border-radius: var(--k-border-radius-sm);
  background-color: var(--k-color-bg-container);
  color: var(--k-color-text);
  font-size: var(--k-font-size-sm);
  font-family: inherit;
  cursor: pointer;
}
.k-daterange__time-select:disabled {
  color: var(--k-color-text-quaternary);
  cursor: not-allowed;
}
.k-daterange__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--k-size-xs) var(--k-size-sm);
  border-top: var(--k-line-width) solid var(--k-color-split);
}
.k-daterange__hint { color: var(--k-color-text-tertiary); font-size: var(--k-font-size-sm); }
.k-daterange__footer-actions { display: inline-flex; align-items: center; gap: var(--k-size-sm); }
.k-daterange__confirm {
  padding: 2px var(--k-size-xs);
  border: none;
  border-radius: var(--k-border-radius-sm);
  background-color: var(--k-color-primary);
  color: var(--k-color-text-light-solid);
  font-size: var(--k-font-size-sm);
  font-family: inherit;
  cursor: pointer;
}
.k-daterange__confirm:hover:not(:disabled) { background-color: var(--k-color-primary-hover); }
.k-daterange__confirm:disabled { opacity: 0.45; cursor: not-allowed; }
.k-daterange__clear-btn {
  padding: 0;
  border: none;
  background: none;
  color: var(--k-color-text-secondary);
  font-size: var(--k-font-size-sm);
  font-family: inherit;
  cursor: pointer;
}
.k-daterange__clear-btn:hover:not(:disabled) { color: var(--k-color-text); }
.k-daterange__clear-btn:disabled { color: var(--k-color-text-quaternary); cursor: not-allowed; }

@media (max-width: 767px) {
  .k-daterange__content { flex-direction: column; }
  .k-daterange__presets {
    flex-direction: row;
    width: auto;
    border-right: none;
    border-bottom: var(--k-line-width) solid var(--k-color-split);
    overflow-x: auto;
  }
  .k-daterange__panels { grid-template-columns: 1fr; }
  .k-daterange__panel.is-right { display: none; }
  .k-daterange__panel.is-left .k-daterange__nav--next { visibility: visible; }
  .k-daterange__cell { height: max(var(--k-daterange-cell-h), 40px); }
}
</style>
