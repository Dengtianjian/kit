<script setup lang="ts">
import { computed, inject, nextTick, onMounted, ref, useId, useSlots, watch } from 'vue';
import type { CSSProperties, Ref, VNodeChild } from 'vue';
import type { Dayjs } from 'dayjs';
import { usePopupHost, useOverlayPosition, usePopupDismiss } from '../../composables/usePopup';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn, KOnPack } from '../../composables/useCustomRender';
import { FORM_ITEM_KEY } from '../Form/context';
import {
  kDayjs,
  formatPicker,
  startOfPicker,
  isSamePicker,
  addPicker,
  commitLevel,
  levelPicker,
  decadeOf,
  panelTitle,
  buildRows,
  WEEKDAYS,
} from '../../utils/date';
import type { KPickerMode, KDateViewLevel, KDateCell } from '../../utils/date';

defineOptions({ name: 'KDatePicker' });

export type KDatePickerNavigateDir = 'superPrev' | 'prev' | 'next' | 'superNext';

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KDatePickerRenderScope {
  open: boolean;
  /** 面板内联常驻（无触发器/弹层） */
  inline: boolean;
  /** v-model 毫秒时间戳（周期起点） */
  value: number | null;
  picker: KPickerMode;
  format: string | undefined;
  placeholder: string;
  disabled: boolean | undefined;
  size: 'xs' | 'sm' | 'md' | 'lg';
  variant: 'outlined' | 'filled' | 'borderless';
  /** 合并链：prop > FormItem 校验态 */
  status: 'error' | 'warning' | undefined;
  /** 当前视图周期内任一时间戳（面板标题/网格由它推） */
  viewDate: number;
  viewLevel: KDateViewLevel;
  rows: KDateCell[][];
  /** 键盘焦点单元格周期起点时间戳（与 hover 分离） */
  focusedDate: number | null;
  flipped: boolean;
  hasValue: boolean;
  displayText: string;
  showClear: boolean;
  titleText: string;
  weekdays: string[];
  todayDisabled: boolean;
  canDrillUp: boolean;
  showSuperNav: boolean;
  rootEl: Ref<HTMLElement | null>;
  triggerEl: Ref<HTMLInputElement | null>;
  popupEl: Ref<HTMLElement | null>;
  teleportTarget: HTMLElement | string;
  popupStyle: CSSProperties;
  rootAttrs: Record<string, unknown>;
  /** keydown（键盘导航）+ focusout（焦点离场关面板） */
  rootOn: KOnPack;
  /** 只读 input 语义包：combobox aria / value / placeholder / disabled / readonly / id */
  triggerAttrs: Record<string, unknown>;
  triggerOn: KOnPack;
  /** 弹层出口包：scope 类 + data-part/picker/level/placement + data-k-theme + 定位 style（视觉壳类不在内） */
  dropAttrs: Record<string, unknown>;
  superPrevOn: KOnPack;
  prevOn: KOnPack;
  titleOn: KOnPack;
  nextOn: KOnPack;
  superNextOn: KOnPack;
  cellAttrs: (cell: KDateCell) => Record<string, unknown>;
  cellOn: (cell: KDateCell) => KOnPack;
  todayOn: KOnPack;
  /** 清除按钮包（mousedown prevent 防抢焦点 + 清值） */
  clearOn: KOnPack;
  setOpen: (v: boolean) => void;
  toggleOpen: () => void;
  navigate: (dir: KDatePickerNavigateDir) => void;
  setViewLevel: (level: KDateViewLevel) => void;
  pick: (cell: KDateCell) => void;
  clear: () => void;
  goToday: () => void;
  focus: () => void;
  blur: () => void;
  slots: ReturnType<typeof useSlots>;
}

type DatePickerPart =
  | 'root'
  | 'trigger'
  | 'suffix'
  | 'panel'
  | 'header'
  | 'grid'
  | 'cell'
  | 'footer';

interface KDatePickerProps {
  picker?: KPickerMode;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'outlined' | 'filled' | 'borderless';
  status?: 'error' | 'warning';
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  /** 面板内联常驻渲染（无触发器与弹层；方向键/Enter 在面板上直接可用） */
  inline?: boolean;
  /** 展示格式（dayjs format；缺省按 picker 取 PICKER_FORMAT，week 用 weekYear 防跨年错位） */
  format?: string;
  /** 可选范围下/上限（毫秒时间戳或可解析字符串），按 picker 粒度比较 */
  min?: number | string;
  max?: number | string;
  /** 禁用判定：入参 = 当前面板粒度的周期起点（date 层逐日、month 层逐月/季、year 层逐年） */
  disabledDate?: (date: Dayjs) => boolean;
  id?: string;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换（含 Teleport/Transition） */
  render?: KRenderFn<KDatePickerRenderScope>;
  classNames?: Partial<Record<DatePickerPart, string>>;
  styles?: Partial<Record<DatePickerPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KDatePickerProps>(), {
  picker: 'date',
  size: 'md',
  variant: 'outlined',
});

const emit = defineEmits<{
  change: [value: number | null];
  focus: [e: FocusEvent];
  blur: [e: FocusEvent];
  panelChange: [view: number, level: KDateViewLevel];
  clear: [];
}>();

const model = defineModel<number | null>({ default: null });
const slots = useSlots();
const uid = useId();

const formItem = inject(FORM_ITEM_KEY, null);
const effectiveStatus = computed(() => props.status ?? formItem?.status.value);

const rootEl = ref<HTMLElement | null>(null);
const triggerEl = ref<HTMLInputElement | null>(null);
const popupEl = ref<HTMLElement | null>(null);
const open = ref(false);
const viewTs = ref(Date.now());
const viewLevel = ref<KDateViewLevel>(commitLevel(props.picker));
const focusedTs = ref<number | null>(null);

const view = computed(() => kDayjs(viewTs.value));
const valueD = computed(() => (model.value == null ? null : kDayjs(model.value)));
const hasValue = computed(() => model.value != null);
const displayText = computed(() =>
  valueD.value ? formatPicker(valueD.value, props.picker, props.format) : '',
);
const showClear = computed(() => props.clearable && hasValue.value && !props.disabled);
/** 弹层开或 inline 常驻：面板渲染与网格交互的真相源 */
const panelVisible = computed(() => props.inline || open.value);

const PLACEHOLDER: Record<KPickerMode, string> = {
  date: '请选择日期',
  week: '请选择周',
  month: '请选择月份',
  quarter: '请选择季度',
  year: '请选择年份',
};
const resolvedPlaceholder = computed(() => props.placeholder ?? PLACEHOLDER[props.picker]);

const minD = computed(() => (props.min != null ? kDayjs(props.min) : null));
const maxD = computed(() => (props.max != null ? kDayjs(props.max) : null));

/** 禁用判定统一走周期起点：disabledDate + min/max 都按当前面板粒度 */
function isDisabledCell(d: Dayjs, lp: KPickerMode): boolean {
  const s = startOfPicker(d, lp).valueOf();
  if (props.disabledDate?.(startOfPicker(d, lp))) return true;
  if (minD.value && s < startOfPicker(minD.value, lp).valueOf()) return true;
  if (maxD.value && s > startOfPicker(maxD.value, lp).valueOf()) return true;
  return false;
}

const rows = computed(() =>
  buildRows(view.value, viewLevel.value, props.picker, {
    value: valueD.value,
    disabled: (d) => isDisabledCell(d, levelPicker(viewLevel.value, props.picker)),
  }),
);
const flatRows = computed(() => rows.value.flat());
const titleText = computed(() => panelTitle(view.value, viewLevel.value));
const canDrillUp = computed(() => viewLevel.value !== 'year');
const showSuperNav = computed(() => viewLevel.value === 'date');
const todayDisabled = computed(() => isDisabledCell(kDayjs(), props.picker));

const rootClasses = computed(() => [
  'k-datepicker',
  `k-datepicker--${props.size}`,
  `k-datepicker--${props.variant}`,
  {
    [`k-datepicker--${effectiveStatus.value}`]: effectiveStatus.value,
    'is-disabled': props.disabled,
    'is-open': open.value,
    'k-datepicker--inline': props.inline,
  },
]);

/* ---------- 弹层基座：容器契约 + bottomLeft 定位（翻转/scroll/resize 跟随）+ 外点/Esc 关闭 ---------- */
const { teleportTarget, popupClasses, popupTheme } = usePopupHost();
const popupVisible = computed(() => open.value && !props.inline);
const { popupStyle, actualPlacement, place } = useOverlayPosition({
  anchor: rootEl,
  popup: popupEl,
  visible: popupVisible,
  placement: () => 'bottomLeft',
  target: teleportTarget,
  gap: 4,
});
const flipped = computed(() => actualPlacement.value.startsWith('top'));
usePopupDismiss(popupVisible, () => setOpen(false), () => [rootEl.value, popupEl.value]);
// 下钻/回退换网格高度：上翻态需重新落位，否则面板底边脱离触发器
watch(viewLevel, async () => {
  if (!open.value) return;
  await nextTick();
  place();
});

function emitPanelChange() {
  emit('panelChange', viewTs.value, viewLevel.value);
}

function setOpen(v: boolean) {
  if (props.inline) return; // inline 面板常驻，无开合语义
  if (props.disabled) return;
  if (v === open.value) return;
  open.value = v;
  if (v) {
    viewTs.value = model.value ?? Date.now();
    viewLevel.value = commitLevel(props.picker);
    focusedTs.value = startOfPicker(kDayjs(model.value ?? undefined), props.picker).valueOf();
  } else {
    triggerEl.value?.blur();
  }
}
function toggleOpen() {
  setOpen(!open.value);
}

function setViewLevel(level: KDateViewLevel) {
  viewLevel.value = level;
  focusedTs.value = startOfPicker(
    kDayjs(focusedTs.value ?? undefined),
    levelPicker(level, props.picker),
  ).valueOf();
  emitPanelChange();
}

/** 视图跟随键盘焦点：焦点走出当前周期时视图翻页 */
function ensureView(f: Dayjs) {
  const v = view.value;
  const out =
    viewLevel.value === 'date'
      ? f.month() !== v.month() || f.year() !== v.year()
      : viewLevel.value === 'month'
        ? f.year() !== v.year()
        : decadeOf(f) !== decadeOf(v);
  if (out) {
    viewTs.value = f.valueOf();
    emitPanelChange();
  }
}

function navigate(dir: KDatePickerNavigateDir) {
  const sign = dir === 'superPrev' || dir === 'prev' ? -1 : 1;
  const superDir = dir === 'superPrev' || dir === 'superNext';
  const v = view.value;
  const amount = viewLevel.value === 'date' ? 1 : viewLevel.value === 'month' ? (superDir ? 10 : 1) : superDir ? 100 : 10;
  const unit = viewLevel.value === 'date' ? (superDir ? 'year' : 'month') : 'year';
  viewTs.value = v.add(sign * amount, unit).valueOf();
  // 焦点随视图平移（antd 同款）：否则翻页后 Enter 找不到焦点格成空操作
  if (focusedTs.value != null) {
    focusedTs.value = kDayjs(focusedTs.value).add(sign * amount, unit).valueOf();
  }
  emitPanelChange();
}

function pick(cell: KDateCell) {
  if (props.disabled || cell.disabled) return;
  const commit = commitLevel(props.picker);
  if (viewLevel.value !== commit) {
    // 高层面板点格 = 下钻（year→month→date），不落值
    viewTs.value = cell.ts;
    setViewLevel(viewLevel.value === 'year' ? 'month' : 'date');
    return;
  }
  model.value = startOfPicker(cell.date, props.picker).valueOf();
  emit('change', model.value);
  formItem?.onFieldChange();
  setOpen(false);
}

function clear() {
  if (props.disabled || !hasValue.value) return;
  model.value = null;
  emit('change', null);
  emit('clear');
  formItem?.onFieldChange();
}

function goToday() {
  if (props.disabled || todayDisabled.value) return;
  model.value = startOfPicker(kDayjs(), props.picker).valueOf();
  emit('change', model.value);
  formItem?.onFieldChange();
  setOpen(false);
}

function onFocusout(e: FocusEvent) {
  const t = e.relatedTarget as Node | null;
  if (t && !rootEl.value?.contains(t) && !popupEl.value?.contains(t)) setOpen(false);
}

/* ---------- 键盘：焦点恒留触发器，方向键按面板粒度移动，Enter 落值/下钻 ---------- */
function onKeydown(e: KeyboardEvent) {
  if (props.disabled || e.isComposing) return;
  if (!open.value && !props.inline) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
    }
    return;
  }
  const lp = levelPicker(viewLevel.value, props.picker);
  const cols =
    viewLevel.value === 'date' ? 7 : viewLevel.value === 'month' && props.picker === 'quarter' ? 4 : 3;
  const move = (n: number) => {
    e.preventDefault();
    if (focusedTs.value == null) return;
    const f = addPicker(kDayjs(focusedTs.value), lp, n);
    focusedTs.value = f.valueOf();
    ensureView(f);
  };
  switch (e.key) {
    case 'ArrowLeft':
      move(-1);
      break;
    case 'ArrowRight':
      move(1);
      break;
    case 'ArrowUp':
      move(-cols);
      break;
    case 'ArrowDown':
      move(cols);
      break;
    case 'Enter':
    case ' ': {
      e.preventDefault();
      if (focusedTs.value == null) break;
      const f = kDayjs(focusedTs.value);
      const cell = flatRows.value.find((c) => isSamePicker(c.date, f, lp));
      if (cell) pick(cell);
      break;
    }
    case 'PageUp':
      e.preventDefault();
      navigate(e.shiftKey ? 'superPrev' : 'prev');
      break;
    case 'PageDown':
      e.preventDefault();
      navigate(e.shiftKey ? 'superNext' : 'next');
      break;
    case 'Escape':
      if (!props.inline) {
        e.stopPropagation();
        setOpen(false);
      }
      break;
  }
}

watch(
  () => props.picker,
  (p) => {
    viewLevel.value = commitLevel(p);
  },
);
onMounted(() => {
  if (!props.inline) return;
  viewTs.value = model.value ?? Date.now();
  viewLevel.value = commitLevel(props.picker);
  focusedTs.value = startOfPicker(kDayjs(model.value ?? undefined), props.picker).valueOf();
});
// inline：外部改值时视图跟随
watch(model, (v) => {
  if (props.inline && v != null) viewTs.value = v;
});

/* ---------- headless 绑定包：事件/语义 attrs 收进 script，默认模板与自绘共用 ---------- */
const rootAttrs = computed(() => ({
  'data-part': 'root',
  tabindex: props.inline ? 0 : undefined,
  role: props.inline ? 'group' : undefined,
  'aria-label': props.inline ? '日期选择' : undefined,
}));
const rootOn: KOnPack = {
  keydown: (e) => onKeydown(e as KeyboardEvent),
  focusout: (e) => onFocusout(e as FocusEvent),
};
const triggerAttrs = computed(() => ({
  'data-part': 'trigger',
  role: 'combobox',
  'aria-expanded': open.value,
  'aria-haspopup': 'dialog',
  'aria-controls': open.value ? `${uid}-panel` : undefined,
  'aria-disabled': props.disabled || undefined,
  readonly: true,
  autocomplete: 'off',
  value: displayText.value,
  placeholder: resolvedPlaceholder.value,
  disabled: props.disabled || undefined,
  id: props.id,
}));
const triggerOn: KOnPack = {
  click: () => setOpen(true),
  focus: (e) => emit('focus', e as FocusEvent),
  blur: (e) => {
    emit('blur', e as FocusEvent);
    if (!open.value) formItem?.onFieldBlur();
  },
};

const dropAttrs = computed(() => ({
  id: `${uid}-panel`,
  class: popupClasses.value,
  'data-part': 'panel',
  'data-picker': props.picker,
  'data-level': viewLevel.value,
  'data-placement': props.inline ? undefined : flipped.value ? 'top' : 'bottom',
  'data-k-theme': popupTheme.value,
  style: props.inline ? undefined : popupStyle.value,
}));

const keepFocus = (e: Event) => e.preventDefault();
const superPrevOn: KOnPack = { click: () => navigate('superPrev'), mousedown: keepFocus };
const prevOn: KOnPack = { click: () => navigate('prev'), mousedown: keepFocus };
const nextOn: KOnPack = { click: () => navigate('next'), mousedown: keepFocus };
const superNextOn: KOnPack = { click: () => navigate('superNext'), mousedown: keepFocus };
const titleOn: KOnPack = {
  click: () => {
    if (canDrillUp.value) setViewLevel(viewLevel.value === 'date' ? 'month' : 'year');
  },
  mousedown: keepFocus,
};
const todayOn: KOnPack = { click: () => goToday(), mousedown: keepFocus };
const clearOn: KOnPack = {
  mousedown: (e) => {
    e.preventDefault();
    e.stopPropagation();
    clear();
  },
};

const cellAttrs = (cell: KDateCell) => {
  const lp = levelPicker(viewLevel.value, props.picker);
  return {
    'data-part': 'cell',
    role: 'gridcell',
    'aria-selected': cell.selected,
    'aria-disabled': cell.disabled || undefined,
    'data-today': cell.today || undefined,
    'data-selected': cell.selected || undefined,
    'data-disabled': cell.disabled || undefined,
    'data-outside': !cell.inView || undefined,
    'data-focused':
      (focusedTs.value != null && isSamePicker(cell.date, kDayjs(focusedTs.value), lp)) || undefined,
  };
};
const cellOn = (cell: KDateCell): KOnPack => ({ click: () => pick(cell) });

const focus = () => (props.inline ? rootEl.value : triggerEl.value)?.focus();
const blur = () => (props.inline ? rootEl.value : triggerEl.value)?.blur();

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KDatePickerRenderScope>(
  () => props.render,
  () => ({
    open: open.value,
    inline: props.inline,
    value: model.value,
    picker: props.picker,
    format: props.format,
    placeholder: resolvedPlaceholder.value,
    disabled: props.disabled,
    size: props.size,
    variant: props.variant,
    status: effectiveStatus.value,
    viewDate: viewTs.value,
    viewLevel: viewLevel.value,
    rows: rows.value,
    focusedDate: focusedTs.value,
    flipped: flipped.value,
    hasValue: hasValue.value,
    displayText: displayText.value,
    showClear: showClear.value,
    titleText: titleText.value,
    weekdays: WEEKDAYS,
    todayDisabled: todayDisabled.value,
    canDrillUp: canDrillUp.value,
    showSuperNav: showSuperNav.value,
    rootEl,
    triggerEl,
    popupEl,
    teleportTarget: teleportTarget.value,
    popupStyle: popupStyle.value,
    rootAttrs: rootAttrs.value,
    rootOn,
    triggerAttrs: triggerAttrs.value,
    triggerOn,
    dropAttrs: dropAttrs.value,
    superPrevOn,
    prevOn,
    titleOn,
    nextOn,
    superNextOn,
    cellAttrs,
    cellOn,
    todayOn,
    clearOn,
    setOpen,
    toggleOpen,
    navigate,
    setViewLevel,
    pick,
    clear,
    goToday,
    focus,
    blur,
    slots,
  }),
);

defineSlots<{
  suffix?(): VNodeChild;
  /** 面板脚注（今天/清除按钮行之下） */
  extraFooter?(): VNodeChild;
  render?(scope: KDatePickerRenderScope): VNodeChild;
}>();

defineExpose({ focus, blur, open: () => setOpen(true), close: () => setOpen(false), triggerEl });
</script>

<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <template v-else>
    <span
      ref="rootEl"
      v-bind="rootAttrs"
      :class="[rootClasses, classNames?.root]"
      :style="styles?.root"
      v-on="rootOn"
    >
      <template v-if="!inline">
      <input
        ref="triggerEl"
        class="k-datepicker__input"
        :class="classNames?.trigger"
        :style="styles?.trigger"
        v-bind="triggerAttrs"
        v-on="triggerOn"
      />
      <span
        data-part="suffix"
        class="k-datepicker__suffix"
        :class="classNames?.suffix"
        :style="styles?.suffix"
      >
        <slot name="suffix" />
        <span
          v-if="showClear"
          class="k-datepicker__clear"
          role="button"
          aria-label="清除"
          v-on="clearOn"
        >
          <svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5A6.51 6.51 0 0 0 8 1.5Zm0 12A5.5 5.5 0 1 1 13.5 8 5.51 5.51 0 0 1 8 13.5Zm2.23-6.34L8.77 8l1.46 1.84a.47.47 0 1 1-.74.58L7.99 8.56 6.05 9.92a.47.47 0 1 1-.53-.78L7.31 8 5.63 6.26a.47.47 0 0 1 .67-.66L7.99 7.45 9.75 6.1a.47.47 0 1 1 .48.8Z"/></svg>
        </span>
        <span class="k-datepicker__calendar" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="3" width="12" height="11" rx="1.5" /><path d="M2 6.5h12M5.5 1.5V4M10.5 1.5V4" /></svg>
        </span>
      </span>
      </template>
    <Teleport :to="teleportTarget" :disabled="inline" defer>
      <Transition :name="inline ? '' : 'k-datepicker-drop'">
        <div
          v-if="panelVisible"
          ref="popupEl"
          v-bind="dropAttrs"
          class="k-datepicker__popup"
          :class="[classNames?.panel, { 'k-datepicker__popup--inline': inline }]"
          :style="styles?.panel"
        >
          <div
            data-part="header"
            class="k-datepicker__header"
            :class="classNames?.header"
            :style="styles?.header"
          >
            <span v-if="showSuperNav" class="k-datepicker__nav" role="button" aria-label="上一年" v-on="superPrevOn">«</span>
            <span class="k-datepicker__nav" role="button" :aria-label="viewLevel === 'date' ? '上一月' : viewLevel === 'month' ? '上一年' : '上十年'" v-on="prevOn">‹</span>
            <button type="button" class="k-datepicker__title" :disabled="!canDrillUp" v-on="titleOn">{{ titleText }}</button>
            <span class="k-datepicker__nav" role="button" :aria-label="viewLevel === 'date' ? '下一月' : viewLevel === 'month' ? '下一年' : '下十年'" v-on="nextOn">›</span>
            <span v-if="showSuperNav" class="k-datepicker__nav" role="button" aria-label="下一年" v-on="superNextOn">»</span>
          </div>
          <div class="k-datepicker__body">
            <div v-if="viewLevel === 'date'" class="k-datepicker__weekdays" aria-hidden="true">
              <span v-for="w in WEEKDAYS" :key="w">{{ w }}</span>
            </div>
            <div
              data-part="grid"
              role="grid"
              class="k-datepicker__grid"
              :class="[`k-datepicker__grid--${viewLevel}`, classNames?.grid]"
              :style="styles?.grid"
            >
              <div
                v-for="(row, ri) in rows"
                :key="ri"
                role="row"
                class="k-datepicker__row"
                :class="{ 'is-selected': picker === 'week' && row.some((c) => c.selected) }"
              >
                <span
                  v-for="c in row"
                  :key="c.ts"
                  v-bind="cellAttrs(c)"
                  class="k-datepicker__cell"
                  :class="[
                    {
                      'is-selected': c.selected,
                      'is-disabled': c.disabled,
                      'is-outside': !c.inView,
                      'is-today': c.today,
                    },
                    classNames?.cell,
                  ]"
                  :style="styles?.cell"
                  v-on="cellOn(c)"
                >{{ c.label }}</span>
              </div>
            </div>
          </div>
          <div
            data-part="footer"
            class="k-datepicker__footer"
            :class="classNames?.footer"
            :style="styles?.footer"
          >
            <button type="button" class="k-datepicker__today" :disabled="todayDisabled" v-on="todayOn">今天</button>
            <button type="button" class="k-datepicker__clear-btn" :disabled="!hasValue" @mousedown.prevent @click="clear">清除</button>
          </div>
          <div v-if="$slots.extraFooter" class="k-datepicker__extra-footer">
            <slot name="extraFooter" />
          </div>
        </div>
      </Transition>
    </Teleport>
    </span>
  </template>
</template>

<style>
/* ---------- 触发器：视觉对齐 KInput 路数（自有部件变量，初值引 alias） ---------- */
.k-datepicker {
  --k-datepicker-height: var(--k-control-height);
  --k-datepicker-padding-x: var(--k-size);
  --k-datepicker-radius: var(--k-border-radius);
  --k-datepicker-bg: var(--k-color-bg-container);
  --k-datepicker-border-color: var(--k-color-border);
  --k-datepicker-border-width: var(--k-line-width);
  --k-datepicker-text-color: var(--k-color-text);
  --k-datepicker-placeholder-color: var(--k-color-text-tertiary);
  --k-datepicker-icon-color: var(--k-color-text-tertiary);
  --k-datepicker-clear-color: var(--k-color-text-quaternary);
  --k-datepicker-clear-color-hover: var(--k-color-text-tertiary);
  --k-datepicker-hover-border-color: var(--k-color-primary-hover);
  --k-datepicker-focus-border-color: var(--k-color-primary);
  --k-datepicker-outline: var(--k-control-outline);
  --k-datepicker-outline-width: var(--k-control-outline-width);

  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xxs);
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 0 var(--k-datepicker-padding-x);
  background-color: var(--k-datepicker-bg);
  border: var(--k-datepicker-border-width) solid var(--k-datepicker-border-color);
  border-radius: var(--k-datepicker-radius);
  font-family: inherit;
  cursor: pointer;
  transition:
    background-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    border-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    box-shadow var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-datepicker *,
.k-datepicker *::before,
.k-datepicker *::after {
  box-sizing: border-box;
}

.k-datepicker__input {
  flex: auto;
  min-width: 0;
  width: 100%;
  height: calc(var(--k-datepicker-height) - var(--k-datepicker-border-width) * 2);
  padding: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--k-datepicker-text-color);
  /* 字号消费根级 --k-input-font-size（iOS 16px 防缩放链同源，只消费不重声明） */
  font-size: var(--k-input-font-size);
  line-height: var(--k-line-height);
  font-family: inherit;
  cursor: pointer;
  text-overflow: ellipsis;
}
.k-datepicker__input::placeholder {
  color: var(--k-datepicker-placeholder-color);
  opacity: 1;
}

.k-datepicker__suffix {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xxs);
  color: var(--k-datepicker-icon-color);
}
/* 只命中插槽直供的裸 svg；内建日历/清除嵌套在各自 span 里且自带宽高，不被覆写 */
.k-datepicker__suffix > svg {
  width: 1em;
  height: 1em;
  display: block;
}
.k-datepicker__calendar {
  display: inline-flex;
  font-size: var(--k-font-size);
}
.k-datepicker__clear {
  display: inline-flex;
  font-size: var(--k-font-size);
  color: var(--k-datepicker-clear-color);
  cursor: pointer;
  visibility: hidden; /* 有值 + 悬浮或聚焦时才现（KInput 同规格） */
}
.k-datepicker:hover .k-datepicker__clear,
.k-datepicker:focus-within .k-datepicker__clear {
  visibility: visible;
}
@media (hover: none) {
  .k-datepicker__clear {
    visibility: visible;
  }
}
.k-datepicker__clear:hover {
  color: var(--k-datepicker-clear-color-hover);
}

/* ---------- 状态：hover / 聚焦 / 展开（根垫圈，同 KInput/KSelect） ---------- */
.k-datepicker:not(.is-disabled):hover {
  --k-datepicker-border-color: var(--k-datepicker-hover-border-color);
}
.k-datepicker:focus-within:not(.is-disabled),
.k-datepicker.is-open:not(.is-disabled) {
  --k-datepicker-border-color: var(--k-datepicker-focus-border-color);
  box-shadow: 0 0 0 var(--k-datepicker-outline-width) var(--k-datepicker-outline);
}

/* ---------- status / variant / disabled / 尺寸档（同 KInput 路数） ---------- */
.k-datepicker--error {
  --k-datepicker-border-color: var(--k-color-error);
  --k-datepicker-hover-border-color: var(--k-color-error);
  --k-datepicker-focus-border-color: var(--k-color-error);
  --k-datepicker-outline: color-mix(in oklab, var(--k-color-error) 25%, transparent);
}
.k-datepicker--warning {
  --k-datepicker-border-color: var(--k-color-warning);
  --k-datepicker-hover-border-color: var(--k-color-warning);
  --k-datepicker-focus-border-color: var(--k-color-warning);
  --k-datepicker-outline: color-mix(in oklab, var(--k-color-warning) 25%, transparent);
}
.k-datepicker--filled {
  --k-datepicker-bg: var(--k-color-fill-tertiary);
  --k-datepicker-border-color: transparent;
  --k-datepicker-hover-border-color: transparent;
  --k-datepicker-focus-border-color: transparent;
}
.k-datepicker--borderless {
  --k-datepicker-bg: transparent;
  --k-datepicker-border-color: transparent;
  --k-datepicker-hover-border-color: transparent;
  --k-datepicker-focus-border-color: transparent;
}
.k-datepicker--filled:focus-within,
.k-datepicker--borderless:focus-within,
.k-datepicker--filled.is-open,
.k-datepicker--borderless.is-open {
  box-shadow: none;
}
.k-datepicker.is-disabled {
  --k-datepicker-bg: var(--k-color-fill-tertiary);
  --k-datepicker-text-color: var(--k-color-text-quaternary);
  --k-datepicker-border-color: var(--k-color-border);
  cursor: not-allowed;
}
.k-datepicker.is-disabled .k-datepicker__input {
  cursor: not-allowed;
  -webkit-text-fill-color: var(--k-datepicker-text-color);
}
.k-datepicker--xs { --k-datepicker-height: var(--k-control-height-xs); --k-datepicker-padding-x: var(--k-size-sm); }
.k-datepicker--sm { --k-datepicker-height: var(--k-control-height-sm); }
.k-datepicker--lg { --k-datepicker-height: var(--k-control-height-lg); --k-datepicker-padding-x: var(--k-size-md); }

/* ---------- inline：面板常驻文档流（无触发器/弹层/阴影，键盘焦点环落在整块上） ---------- */
.k-datepicker--inline {
  display: inline-block;
  width: fit-content;
  padding: 0;
  background: none;
  border: none;
  border-radius: var(--k-border-radius);
  outline: none;
}
.k-datepicker--inline:focus-visible {
  outline: 2px solid var(--k-color-primary);
  outline-offset: 2px;
}
.k-datepicker--inline:focus-within:not(.is-disabled) {
  box-shadow: none;
}
.k-datepicker__popup--inline {
  position: relative;
  z-index: auto;
  border: var(--k-line-width) solid var(--k-color-border);
  box-shadow: none;
}

/* ---------- 面板（容器契约出口 + dropdown 层级；顶→底展开，上翻镜像） ---------- */
.k-datepicker__popup {
  --k-datepicker-panel-width: 280px;
  --k-datepicker-cell-h: 32px;
  --k-datepicker-cols: 7;

  z-index: var(--k-z-index-dropdown);
  width: var(--k-datepicker-panel-width);
  background-color: var(--k-color-bg-elevated);
  border-radius: var(--k-border-radius);
  box-shadow: var(--k-box-shadow-secondary);
  transform-origin: top;
  font-size: var(--k-font-size);
  color: var(--k-color-text);
}
.k-datepicker__popup *,
.k-datepicker__popup *::before,
.k-datepicker__popup *::after {
  box-sizing: border-box;
}
.k-datepicker__popup[data-placement='top'] {
  transform-origin: bottom;
}
.k-datepicker-drop-enter-active {
  animation: k-datepicker-drop-in var(--k-motion-duration-fast) var(--k-motion-ease-out-cubic);
}
.k-datepicker-drop-leave-active {
  animation: k-datepicker-drop-out var(--k-motion-duration-fast) var(--k-motion-ease-in-cubic);
}
@keyframes k-datepicker-drop-in {
  from { opacity: 0; transform: scaleY(0); }
  to { opacity: 1; transform: scaleY(1); }
}
@keyframes k-datepicker-drop-out {
  from { opacity: 1; transform: scaleY(1); }
  to { opacity: 0; transform: scaleY(0); }
}

.k-datepicker__header {
  display: flex;
  align-items: center;
  gap: var(--k-size-xxs);
  padding: var(--k-size-xs) var(--k-size-sm);
  border-bottom: var(--k-line-width) solid var(--k-color-split);
}
.k-datepicker__nav {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--k-border-radius-sm);
  color: var(--k-color-text-tertiary);
  font-size: var(--k-font-size);
  line-height: 1;
  cursor: pointer;
  user-select: none;
  transition: color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-datepicker__nav:hover {
  color: var(--k-color-text);
}
.k-datepicker__title {
  flex: auto;
  min-width: 0;
  padding: 0;
  border: none;
  background: none;
  color: var(--k-color-text);
  font-size: var(--k-font-size);
  font-weight: var(--k-font-weight-strong);
  font-family: inherit;
  line-height: 24px;
  text-align: center;
  cursor: pointer;
  border-radius: var(--k-border-radius-sm);
  transition: color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-datepicker__title:hover:not(:disabled) {
  color: var(--k-color-primary);
}
.k-datepicker__title:disabled {
  cursor: default;
}

.k-datepicker__body {
  padding: var(--k-size-xs) var(--k-size-sm);
}
.k-datepicker__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 2px;
}
.k-datepicker__weekdays span {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  color: var(--k-color-text-tertiary);
  font-size: var(--k-font-size-sm);
}

.k-datepicker__grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.k-datepicker__grid--date { --k-datepicker-cols: 7; --k-datepicker-cell-h: 32px; }
.k-datepicker__grid--month { --k-datepicker-cols: 3; --k-datepicker-cell-h: 40px; }
.k-datepicker__grid--year { --k-datepicker-cols: 3; --k-datepicker-cell-h: 40px; }
.k-datepicker__popup[data-picker='quarter'] .k-datepicker__grid--month {
  --k-datepicker-cols: 4;
}
.k-datepicker__row {
  display: grid;
  grid-template-columns: repeat(var(--k-datepicker-cols), 1fr);
  gap: 2px;
  border-radius: var(--k-border-radius-sm);
}
/* 周 picker：整行 hover/选中高亮，单元格不再各自描选中块 */
.k-datepicker__popup[data-picker='week'] .k-datepicker__row {
  transition: background-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-datepicker__popup[data-picker='week'] .k-datepicker__row:hover,
.k-datepicker__popup[data-picker='week'] .k-datepicker__row.is-selected {
  background-color: var(--k-color-primary-bg);
}

.k-datepicker__cell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: var(--k-datepicker-cell-h);
  border-radius: var(--k-border-radius-sm);
  color: var(--k-color-text);
  cursor: pointer;
  user-select: none;
  transition:
    background-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-datepicker__cell:hover:not(.is-disabled):not(.is-selected) {
  background-color: var(--k-color-fill-tertiary);
}
.k-datepicker__cell.is-outside {
  color: var(--k-color-text-quaternary);
}
.k-datepicker__cell.is-today:not(.is-selected) {
  color: var(--k-color-primary);
  box-shadow: inset 0 0 0 1px var(--k-color-primary);
}
.k-datepicker__cell.is-selected {
  background-color: var(--k-color-primary);
  color: var(--k-color-text-light-solid);
  font-weight: var(--k-font-weight-strong);
}
.k-datepicker__popup[data-picker='week'] .k-datepicker__cell.is-selected {
  background-color: transparent;
  color: var(--k-color-primary);
}
.k-datepicker__cell.is-disabled {
  color: var(--k-color-text-quaternary);
  background-color: var(--k-color-fill-tertiary);
  cursor: not-allowed;
}
/* 键盘焦点环（与 hover 分离）：未选中描主色，选中态描底反白 */
.k-datepicker__cell[data-focused]:not(.is-selected) {
  box-shadow: inset 0 0 0 1px var(--k-color-primary-hover);
}
.k-datepicker__cell[data-focused].is-selected {
  box-shadow: inset 0 0 0 1px var(--k-color-bg-elevated);
}
.k-datepicker__cell.is-today[data-focused]:not(.is-selected) {
  box-shadow: inset 0 0 0 1px var(--k-color-primary);
}

.k-datepicker__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--k-size-xs) var(--k-size-sm);
  border-top: var(--k-line-width) solid var(--k-color-split);
}
.k-datepicker__today,
.k-datepicker__clear-btn {
  padding: 0;
  border: none;
  background: none;
  font-size: var(--k-font-size-sm);
  font-family: inherit;
  line-height: var(--k-line-height);
  cursor: pointer;
  transition: color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-datepicker__today {
  color: var(--k-color-primary);
}
.k-datepicker__today:hover:not(:disabled) {
  color: var(--k-color-primary-hover);
}
.k-datepicker__clear-btn {
  color: var(--k-color-text-secondary);
}
.k-datepicker__clear-btn:hover:not(:disabled) {
  color: var(--k-color-text);
}
.k-datepicker__today:disabled,
.k-datepicker__clear-btn:disabled {
  color: var(--k-color-text-quaternary);
  cursor: not-allowed;
}
.k-datepicker__extra-footer {
  padding: var(--k-size-xs) var(--k-size-sm);
  border-top: var(--k-line-width) solid var(--k-color-split);
}
</style>