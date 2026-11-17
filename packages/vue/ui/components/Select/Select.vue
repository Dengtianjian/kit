<script setup lang="ts">
import { computed, h, inject, nextTick, onBeforeUnmount, onMounted, ref, useId, useSlots, watch } from 'vue';
import type { CSSProperties, Ref, VNode, VNodeChild } from 'vue';
import { useKConfig } from '../../composables/useKConfig';
import { usePopupFrame } from '../../composables/usePopup';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn, KOnPack } from '../../composables/useCustomRender';
import { FORM_ITEM_KEY } from '../Form/context';
import KTooltip from '../Tooltip/Tooltip.vue';

defineOptions({ name: 'KSelect' });

export interface KSelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

export interface KSelectGroup {
  type: 'group';
  label: string;
  children: KSelectOption[];
}

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KSelectRenderScope {
  open: boolean;
  multiple: boolean;
  disabled: boolean;
  filterable: boolean;
  size: 'xs' | 'sm' | 'md' | 'lg';
  placeholder: string;
  pattern: string;
  activeIndex: number;
  flipped: boolean;
  selectedValues: (string | number)[];
  selectedOption: KSelectOption | null;
  hasValue: boolean;
  showClear: boolean;
  menuOptions: KSelectOption[];
  renderGroups: { label: string | null; children: KSelectOption[] }[];
  activeOption: KSelectOption | null;
  visibleTagCount: number;
  hiddenValues: (string | number)[];
  showOverflowProbe: boolean;
  overflowTip: VNode;
  optionOf: (v: string | number) => KSelectOption | null;
  labelOf: (v: string | number) => string;
  rootEl: Ref<HTMLElement | null>;
  controlEl: Ref<HTMLElement | null>;
  contentEl: Ref<HTMLElement | null>;
  inputEl: Ref<HTMLInputElement | null>;
  popupEl: Ref<HTMLElement | null>;
  teleportTarget: HTMLElement | string;
  popupStyle: CSSProperties;
  /** 触发器实测宽（默认视觉贴宽用）；headless 自绘弹层可自选绑定或忽略 */
  popupWidth: string;
  rootAttrs: Record<string, unknown>;
  rootOn: KOnPack;
  controlAttrs: Record<string, unknown>;
  controlOn: KOnPack;
  inputAttrs: Record<string, unknown>;
  inputOn: KOnPack;
  dropAttrs: Record<string, unknown>;
  listAttrs: Record<string, unknown>;
  listOn: KOnPack;
  optionAttrs: (o: KSelectOption) => Record<string, unknown>;
  optionOn: (o: KSelectOption) => KOnPack;
  tagRemoveOn: (v: string | number) => KOnPack;
  clearOn: KOnPack;
  setOpen: (v: boolean) => void;
  toggleOpen: () => void;
  pick: (o: KSelectOption) => void;
  createTag: () => void;
  removeValue: (v: string | number) => void;
  onClear: (e: MouseEvent) => void;
  onInput: (e: Event) => void;
  focus: () => void;
  blur: () => void;
  slots: ReturnType<typeof useSlots>;
}

type SelectPart =
  | 'root'
  | 'control'
  | 'content'
  | 'suffix'
  | 'list'
  | 'option'
  | 'group'
  | 'header'
  | 'footer'
  | 'empty'
  | 'tag';
type SelectValue = string | number | (string | number)[] | null | undefined;

interface KSelectProps {
  options?: (KSelectOption | KSelectGroup)[];
  /** 缺省单选；'multiple' = 多选（model 数组） */
  mode?: 'multiple';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  status?: 'error' | 'warning';
  variant?: 'outlined' | 'filled' | 'borderless';
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  /** 可搜索：触发器内嵌输入框，本地按 label 不区分大小写过滤 */
  filterable?: boolean;
  /** 自定义过滤（缺省 label.includes(pattern)） */
  filter?: (pattern: string, option: KSelectOption) => boolean;
  /** 允许把输入值创建为选项（需 filterable）；Enter 无高亮项时创建并选中 */
  tag?: boolean;
  /** 多选标签折叠：number = 固定保留个数；'responsive' = 按触发器宽度自适应（ResizeObserver 实测） */
  maxTagCount?: number | 'responsive';
  /** 菜单中隐藏已选中项 */
  hideSelected?: boolean;
  id?: string;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换（含 Teleport/Transition） */
  render?: KRenderFn<KSelectRenderScope>;
  classNames?: Partial<Record<SelectPart, string>>;
  styles?: Partial<Record<SelectPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KSelectProps>(), {
  options: () => [],
  size: 'md',
  variant: 'outlined',
  placeholder: '请选择',
});

const emit = defineEmits<{
  change: [value: SelectValue];
  focus: [e: FocusEvent];
  blur: [e: FocusEvent];
  search: [pattern: string];
  scroll: [e: Event];
}>();

const model = defineModel<SelectValue>({ default: undefined });

const config = useKConfig();
const uid = useId();

const formItem = inject(FORM_ITEM_KEY, null);
const effectiveStatus = computed(() => props.status ?? formItem?.status.value);

const rootEl = ref<HTMLElement | null>(null);
const controlEl = ref<HTMLElement | null>(null);
const contentEl = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLInputElement | null>(null);
const popupEl = ref<HTMLElement | null>(null);
const open = ref(false);
const activeIndex = ref(-1);
const pattern = ref('');
const flipped = ref(false);
const createdOptions = ref<KSelectOption[]>([]);
const fitCount = ref(Number.POSITIVE_INFINITY);

const multiple = computed(() => props.mode === 'multiple');
const selectedValues = computed<(string | number)[]>(() => {
  if (multiple.value) return Array.isArray(model.value) ? model.value : [];
  return model.value == null || model.value === '' ? [] : [model.value as string | number];
});
const hasValue = computed(() => selectedValues.value.length > 0);
const showClear = computed(
  () => props.allowClear && hasValue.value && !props.disabled && !open.value,
);

/* ---------- 选项源：分组拍平 + 过滤 + 隐藏已选 ---------- */
const allOptions = computed<(KSelectOption | KSelectGroup)[]>(() => [
  ...props.options,
  ...createdOptions.value,
]);
const flatOptions = computed<KSelectOption[]>(() =>
  allOptions.value.flatMap((o) => ('type' in o && o.type === 'group' ? o.children : [o])),
);
const optionOf = (v: string | number) => flatOptions.value.find((o) => o.value === v) ?? null;
const labelOf = (v: string | number) => optionOf(v)?.label ?? String(v);
const selectedOption = computed(() => optionOf(selectedValues.value[0] as string | number));

function matches(o: KSelectOption) {
  if (!props.filterable || !pattern.value) return true;
  return props.filter
    ? props.filter(pattern.value, o)
    : o.label.toLowerCase().includes(pattern.value.toLowerCase());
}
const menuOptions = computed(() =>
  flatOptions.value.filter(
    (o) => matches(o) && !(props.hideSelected && selectedValues.value.includes(o.value)),
  ),
);
/** 渲染用分组：过滤后空组整组消失；散选项归入无标题组 */
const renderGroups = computed<{ label: string | null; children: KSelectOption[] }[]>(() => {
  const groups: { label: string | null; children: KSelectOption[] }[] = [];
  let loose: KSelectOption[] | null = null;
  for (const o of allOptions.value) {
    if ('type' in o && o.type === 'group') {
      const children = o.children.filter(
        (c) => matches(c) && !(props.hideSelected && selectedValues.value.includes(c.value)),
      );
      if (children.length) groups.push({ label: o.label, children });
    } else {
      const c = o as KSelectOption;
      if (!matches(c) || (props.hideSelected && selectedValues.value.includes(c.value))) continue;
      if (!loose) {
        loose = [];
        groups.push({ label: null, children: loose });
      }
      loose.push(c);
    }
  }
  return groups;
});
const activeOption = computed(() => menuOptions.value[activeIndex.value] ?? null);

const rootClasses = computed(() => [
  'k-select',
  `k-select--${props.size}`,
  `k-select--${props.variant}`,
  {
    [`k-select--${effectiveStatus.value}`]: effectiveStatus.value,
    'is-disabled': props.disabled,
    'is-open': open.value,
    'is-multiple': multiple.value,
    'is-filterable': props.filterable,
  },
]);

/* ---------- 弹层定位（容器契约：body=fixed 跟随；HTMLElement=absolute 进容器文档流） ---------- */
const teleportTarget = computed(() => {
  const c = config?.popupContainer.value;
  if (!c) return 'body';
  // 容器函数可能读模板 ref：挂载瞬间为 null，兜底 body，ref 就位后响应式切回；
  // typeof 判别而非 instanceof HTMLElement（SSR 无该全局）
  return (typeof c === 'function' ? c() : c) ?? 'body';
});
const frame = usePopupFrame(teleportTarget);
const popupStyle = ref<CSSProperties>({ position: 'fixed', visibility: 'hidden' });
// 宽度贴触发器是默认视觉语义，独立于定位包：headless 自绘弹层可自选是否绑定
const popupWidth = ref('');
const GAP = 4; // 触发器与弹层间距，与 --k-size-xxs 同步的布局常数（DOM 定位用数值 px）
const HEIGHT_VAR: Record<string, string> = {
  xs: 'var(--k-control-height-xs)',
  sm: 'var(--k-control-height-sm)',
  md: 'var(--k-control-height)',
  lg: 'var(--k-control-height-lg)',
};

function place() {
  const anchor = controlEl.value?.getBoundingClientRect();
  const popup = popupEl.value;
  if (!anchor || !popup) return;
  const vh = window.innerHeight;
  const h = popup.offsetHeight;
  let top = anchor.bottom + GAP;
  flipped.value = false;
  if (anchor.bottom + GAP + h > vh && anchor.top - GAP - h > 0) {
    top = anchor.top - GAP - h; // 上翻
    flipped.value = true;
  }
  frame.ensurePositioned();
  const point = frame.localPoint(top, anchor.left);
  popupWidth.value = `${Math.round(anchor.width)}px`;
  popupStyle.value = {
    position: frame.mode.value,
    top: `${Math.round(point.top)}px`,
    left: `${Math.round(point.left)}px`,
    visibility: 'visible',
    // Teleport 出口脱离根节点作用域：尺寸变量随弹层走，选项行高 = 触发器 − 4
    '--k-select-height': HEIGHT_VAR[props.size],
    '--k-select-option-font-size':
      props.size === 'xs' || props.size === 'sm'
        ? 'var(--k-font-size-sm)'
        : 'var(--k-input-font-size)',
  } as CSSProperties;
}

function onScrollResize() {
  if (open.value) place();
}
function onDocPointerdown(e: PointerEvent) {
  if (!open.value) return;
  const t = e.target as Node;
  if (rootEl.value?.contains(t) || popupEl.value?.contains(t)) return;
  setOpen(false);
}

watch(open, async (v) => {
  if (v) {
    const i = menuOptions.value.findIndex((o) => selectedValues.value.includes(o.value));
    activeIndex.value = i >= 0 ? i : firstEnabledIndex();
    document.addEventListener('pointerdown', onDocPointerdown, true);
    // absolute 模式弹层随容器内容滚，不挂 scroll 跟随；resize 两模式都跟（翻转依赖视口）
    if (frame.mode.value === 'fixed') window.addEventListener('scroll', onScrollResize, true);
    window.addEventListener('resize', onScrollResize);
    await nextTick();
    place();
    if (props.filterable) inputEl.value?.focus();
    measureTags();
  } else {
    document.removeEventListener('pointerdown', onDocPointerdown, true);
    window.removeEventListener('scroll', onScrollResize, true);
    window.removeEventListener('resize', onScrollResize);
    pattern.value = '';
  }
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerdown, true);
  window.removeEventListener('scroll', onScrollResize, true);
  window.removeEventListener('resize', onScrollResize);
  tagObserver?.disconnect();
});

function setOpen(v: boolean) {
  if (props.disabled) return;
  if (v === open.value) return;
  open.value = v;
  if (!v) {
    (props.filterable ? inputEl.value : controlEl.value)?.blur();
    formItem?.onFieldBlur();
  }
}
function toggleOpen() {
  setOpen(!open.value);
}
function onFocusout(e: FocusEvent) {
  // relatedTarget 为 null（点非焦点节点）交给 pointerdown dismiss 判定，避免多选点选项误关
  const t = e.relatedTarget as Node | null;
  if (t && !rootEl.value?.contains(t) && !popupEl.value?.contains(t)) setOpen(false);
}

/* ---------- 选择 / 创建 ---------- */
function pick(option: KSelectOption) {
  if (props.disabled || option.disabled) return;
  if (multiple.value) {
    const cur = new Set(selectedValues.value);
    cur.has(option.value) ? cur.delete(option.value) : cur.add(option.value);
    model.value = [...cur];
    pattern.value = '';
    nextTick(() => inputEl.value?.focus());
  } else {
    model.value = option.value;
    setOpen(false);
  }
  emit('change', model.value);
  formItem?.onFieldChange();
}
function createTag() {
  const text = pattern.value.trim();
  if (!text) return;
  const exist = flatOptions.value.find((o) => o.value === text);
  if (exist) {
    pick(exist);
    return;
  }
  const option: KSelectOption = { label: text, value: text };
  createdOptions.value = [...createdOptions.value, option];
  pick(option);
}
function removeValue(v: string | number) {
  if (props.disabled) return;
  model.value = multiple.value
    ? selectedValues.value.filter((x) => x !== v)
    : null;
  emit('change', model.value);
  formItem?.onFieldChange();
}
function onClear(e: MouseEvent) {
  e.stopPropagation();
  model.value = multiple.value ? [] : null;
  emit('change', model.value);
  formItem?.onFieldChange();
}
function onInput(e: Event) {
  pattern.value = (e.target as HTMLInputElement).value;
  emit('search', pattern.value);
  if (!open.value) setOpen(true);
}

/* ---------- maxTagCount：number 直切；responsive 两遍实测（先全渲染量宽再收敛） ---------- */
const visibleTagCount = computed(() => {
  const n = selectedValues.value.length;
  if (!multiple.value || props.maxTagCount == null) return n;
  if (props.maxTagCount === 'responsive') {
    return fitCount.value === Number.POSITIVE_INFINITY ? n : Math.min(n, fitCount.value);
  }
  return Math.min(n, props.maxTagCount);
});
const hiddenValues = computed(() => selectedValues.value.slice(visibleTagCount.value));
const showOverflowProbe = computed(
  () =>
    multiple.value &&
    props.maxTagCount != null &&
    selectedValues.value.length > 0 &&
    (hiddenValues.value.length > 0 || props.maxTagCount === 'responsive'),
);
const overflowTip = computed<VNode>(() =>
  h(
    'div',
    { style: 'display:flex;flex-direction:column;gap:4px' },
    hiddenValues.value.map((v) => h('span', { key: String(v) }, labelOf(v))),
  ),
);

let tagObserver: ResizeObserver | null = null;
async function measureTags() {
  if (props.maxTagCount !== 'responsive' || !multiple.value) return;
  const content = contentEl.value;
  if (!content) return;
  fitCount.value = Number.POSITIVE_INFINITY; // 第一遍：全渲染取真实宽
  await nextTick();
  const tags = Array.from(
    content.querySelectorAll<HTMLElement>(':scope > .k-select__tag:not(.k-select__tag--overflow)'),
  );
  const counter = content.querySelector<HTMLElement>('.k-select__tag--overflow');
  const inputW = props.filterable && open.value ? (inputEl.value?.offsetWidth ?? 0) : 0;
  const gap = 4;
  const avail =
    content.clientWidth -
    (inputW ? inputW + gap : 0) -
    (counter ? counter.offsetWidth + gap : 0);
  let acc = 0;
  let fit = 0;
  for (const t of tags) {
    const need = acc + (fit ? gap : 0) + t.offsetWidth;
    if (need > avail) break;
    acc = need;
    fit++;
  }
  fitCount.value = fit;
}
function startTagObserver() {
  tagObserver?.disconnect();
  tagObserver = null;
  if (props.maxTagCount === 'responsive' && multiple.value && contentEl.value) {
    tagObserver = new ResizeObserver(() => measureTags());
    tagObserver.observe(contentEl.value);
    measureTags();
  } else {
    fitCount.value = Number.POSITIVE_INFINITY;
  }
}
onMounted(startTagObserver);
watch(
  () => [props.maxTagCount, multiple.value] as const,
  () => startTagObserver(),
);
watch([selectedValues, pattern, open], () => nextTick(measureTags));

/* ---------- 键盘（焦点恒留触发器/输入框，弹层 aria-activedescendant 跟随） ---------- */
function firstEnabledIndex(): number {
  return menuOptions.value.findIndex((o) => !o.disabled);
}
function moveActive(dir: 1 | -1) {
  const n = menuOptions.value.length;
  if (!n) return;
  let i = activeIndex.value;
  for (let k = 0; k < n; k++) {
    i = (i + dir + n) % n;
    if (!menuOptions.value[i].disabled) break;
  }
  activeIndex.value = i;
  nextTick(() =>
    popupEl.value
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' }),
  );
}
function onKeydown(e: KeyboardEvent) {
  if (props.disabled || e.isComposing) return;
  const inInput = e.target === inputEl.value;
  switch (e.key) {
    case 'Enter':
      e.preventDefault();
      if (!open.value) setOpen(true);
      else if (activeOption.value) pick(activeOption.value);
      else if (props.tag) createTag();
      break;
    case ' ':
      if (inInput) return; // 输入框里空格是字符
      e.preventDefault();
      if (!open.value) setOpen(true);
      else if (activeOption.value) pick(activeOption.value);
      break;
    case 'ArrowDown':
      e.preventDefault();
      open.value ? moveActive(1) : setOpen(true);
      break;
    case 'ArrowUp':
      e.preventDefault();
      open.value ? moveActive(-1) : setOpen(true);
      break;
    case 'Escape':
      if (open.value) {
        e.stopPropagation();
        setOpen(false);
      }
      break;
    case 'Backspace':
      if (multiple.value && !pattern.value) {
        const last = selectedValues.value[selectedValues.value.length - 1];
        if (last != null) removeValue(last);
      }
      break;
  }
}
watch(pattern, () => {
  activeIndex.value = firstEnabledIndex();
});
watch(menuOptions, (list) => {
  if (activeIndex.value >= list.length) activeIndex.value = firstEnabledIndex();
});

/* ---------- 出口容器契约（popupContainer + scopeClass + scheme 随节点走） ---------- */
const popupScopeClasses = computed(() => [
  // scoped Provider 弹层出口必须自带作用域类，否则 token 变量断链（ConfigProvider 契约④）
  config?.scopeClass.value ? 'k-config-provider' : '',
  config?.scopeClass.value ?? '',
]);
// 视觉壳类 k-select__popup 只进默认模板；headless 绑定包不带，避免自绘弹层被默认外观污染
const popupTheme = computed(() => {
  const s = config?.scheme.value;
  return s && s !== 'auto' ? s : undefined;
});

const optionId = (i: number) => `${uid}-opt-${i}`;
const comboboxAttrs = computed(() => ({
  role: 'combobox',
  'aria-expanded': open.value,
  'aria-haspopup': 'listbox',
  'aria-controls': open.value ? `${uid}-list` : undefined,
  'aria-activedescendant':
    open.value && activeIndex.value >= 0 ? optionId(activeIndex.value) : undefined,
  'aria-disabled': props.disabled || undefined,
}));
const controlAttrs = computed(() =>
  props.filterable
    ? { ...comboboxAttrs.value, tabindex: -1 }
    : { ...comboboxAttrs.value, tabindex: 0, id: props.id },
);
const inputAttrs = computed(() => ({
  ...comboboxAttrs.value,
  id: props.id,
  'aria-autocomplete': 'list',
}));

/* ---------- headless 绑定包：事件/语义 attrs 收进 script，默认模板与自绘共用 ---------- */
const slots = useSlots();
const rootAttrs = { 'data-part': 'root' };
const rootOn: KOnPack = {
  keydown: (e) => onKeydown(e as KeyboardEvent),
  focusout: (e) => onFocusout(e as FocusEvent),
};
const controlOn: KOnPack = {
  click: () => toggleOpen(),
  focus: (e) => emit('focus', e as FocusEvent),
  blur: (e) => emit('blur', e as FocusEvent),
};
const inputOn: KOnPack = {
  input: onInput,
  click: (e) => e.stopPropagation(),
  focus: (e) => emit('focus', e as FocusEvent),
  blur: (e) => emit('blur', e as FocusEvent),
};
const listOn: KOnPack = { scroll: (e) => emit('scroll', e) };
const optionAttrs = (o: KSelectOption) => {
  const i = menuOptions.value.indexOf(o);
  return {
    id: optionId(i),
    role: 'option',
    'data-part': 'option',
    'aria-selected': selectedValues.value.includes(o.value),
    'data-active': i === activeIndex.value || undefined,
  };
};
const optionOn = (o: KSelectOption): KOnPack => ({
  click: () => pick(o),
  pointerenter: () => {
    if (!o.disabled) activeIndex.value = menuOptions.value.indexOf(o);
  },
});
const tagRemoveOn = (v: string | number): KOnPack => ({
  mousedown: (e) => {
    e.preventDefault();
    e.stopPropagation();
    removeValue(v);
  },
});
const clearOn: KOnPack = {
  mousedown: (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClear(e as MouseEvent);
  },
};
const focus = () => (props.filterable ? inputEl.value : controlEl.value)?.focus();
const blur = () => (props.filterable ? inputEl.value : controlEl.value)?.blur();

const dropAttrs = computed(() => ({
  class: popupScopeClasses.value,
  'data-part': 'list',
  'data-placement': flipped.value ? 'top' : 'bottom',
  'data-k-theme': popupTheme.value,
  style: popupStyle.value,
}));
const listAttrs = computed(() => ({
  role: 'listbox',
  id: `${uid}-list`,
  'aria-multiselectable': multiple.value || undefined,
}));

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KSelectRenderScope>(
  () => props.render,
  () => ({
    open: open.value,
    multiple: multiple.value,
    disabled: props.disabled,
    filterable: props.filterable,
    size: props.size,
    placeholder: props.placeholder,
    pattern: pattern.value,
    activeIndex: activeIndex.value,
    flipped: flipped.value,
    selectedValues: selectedValues.value,
    selectedOption: selectedOption.value,
    hasValue: hasValue.value,
    showClear: showClear.value,
    menuOptions: menuOptions.value,
    renderGroups: renderGroups.value,
    activeOption: activeOption.value,
    visibleTagCount: visibleTagCount.value,
    hiddenValues: hiddenValues.value,
    showOverflowProbe: showOverflowProbe.value,
    overflowTip: overflowTip.value,
    optionOf,
    labelOf,
    rootEl,
    controlEl,
    contentEl,
    inputEl,
    popupEl,
    teleportTarget: teleportTarget.value,
    popupStyle: popupStyle.value,
    popupWidth: popupWidth.value,
    rootAttrs,
    rootOn,
    controlAttrs: controlAttrs.value,
    controlOn,
    inputAttrs: inputAttrs.value,
    inputOn,
    dropAttrs: dropAttrs.value,
    listAttrs: listAttrs.value,
    listOn,
    optionAttrs,
    optionOn,
    tagRemoveOn,
    clearOn,
    setOpen,
    toggleOpen,
    pick,
    createTag,
    removeValue,
    onClear,
    onInput,
    focus,
    blur,
    slots,
  }),
);

defineSlots<{
  prefix?(): VNodeChild;
  suffix?(): VNodeChild;
  label?(scope: { option: KSelectOption | null; value: string | number }): VNodeChild;
  option?(scope: { option: KSelectOption; selected: boolean; active: boolean }): VNodeChild;
  header?(): VNodeChild;
  footer?(): VNodeChild;
  empty?(scope: { pattern: string }): VNodeChild;
  render?(scope: KSelectRenderScope): VNodeChild;
}>();

defineExpose({ focus, blur, open: () => setOpen(true), close: () => setOpen(false) });
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
    <span
      ref="controlEl"
      data-part="control"
      class="k-select__control"
      :class="classNames?.control"
      :style="styles?.control"
      v-bind="controlAttrs"
      v-on="controlOn"
    >
      <span v-if="$slots.prefix" class="k-select__prefix">
        <slot name="prefix" />
      </span>
      <span
        ref="contentEl"
        data-part="content"
        class="k-select__content"
        :class="classNames?.content"
        :style="styles?.content"
      >
        <template v-if="multiple">
          <span
            v-for="(v, i) in selectedValues"
            :key="String(v)"
            class="k-select__tag"
            :class="[{ 'is-hidden': maxTagCount != null && i >= visibleTagCount }, classNames?.tag]"
            :style="styles?.tag"
          >
            <span class="k-select__tag-label">
              <slot name="label" :option="optionOf(v)" :value="v">{{ labelOf(v) }}</slot>
            </span>
            <span
              v-if="!disabled"
              class="k-select__tag-remove"
              role="button"
              aria-label="移除"
              v-on="tagRemoveOn(v)"
            >
              <svg viewBox="0 0 10 10" width="0.7em" height="0.7em" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M2 2l6 6M8 2l-6 6" /></svg>
            </span>
          </span>
          <KTooltip v-if="showOverflowProbe" :content="overflowTip" placement="top">
            <template #trigger>
              <span
                class="k-select__tag k-select__tag--overflow"
                :class="{ 'is-hidden': !hiddenValues.length }"
                @click.stop
              >+{{ hiddenValues.length }}</span>
            </template>
          </KTooltip>
          <input
            v-if="filterable && open"
            ref="inputEl"
            v-bind="inputAttrs"
            class="k-select__input"
            :style="{ width: `${Math.max(1, pattern.length)}ch` }"
            :value="pattern"
            :placeholder="hasValue ? '' : placeholder"
            :disabled="disabled"
            autocomplete="off"
            v-on="inputOn"
          />
          <span v-if="!hasValue && !(filterable && open)" class="k-select__placeholder">{{ placeholder }}</span>
        </template>
        <template v-else>
          <input
            v-if="filterable && open"
            ref="inputEl"
            v-bind="inputAttrs"
            class="k-select__input k-select__input--single"
            :value="pattern"
            :placeholder="selectedOption?.label ?? placeholder"
            :disabled="disabled"
            autocomplete="off"
            v-on="inputOn"
          />
          <template v-else>
            <span v-if="selectedOption" class="k-select__label">
              <slot name="label" :option="selectedOption" :value="selectedOption.value">{{ selectedOption.label }}</slot>
            </span>
            <span v-else class="k-select__placeholder">{{ placeholder }}</span>
          </template>
        </template>
      </span>
      <span data-part="suffix" class="k-select__suffix" :class="classNames?.suffix" :style="styles?.suffix">
        <slot name="suffix" />
        <span v-if="showClear" class="k-select__clear" role="button" aria-label="清除" v-on="clearOn">
          <svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5A6.51 6.51 0 0 0 8 1.5Zm0 12A5.5 5.5 0 1 1 13.5 8 5.51 5.51 0 0 1 8 13.5Zm2.23-6.34L8.77 8l1.46 1.84a.47.47 0 1 1-.74.58L7.99 8.56 6.05 9.92a.47.47 0 1 1-.53-.78L7.31 8 5.63 6.26a.47.47 0 0 1 .67-.66L7.99 7.45 9.75 6.1a.47.47 0 1 1 .48.8Z"/></svg>
        </span>
        <span class="k-select__arrow" :class="{ 'is-open': open }" aria-hidden="true">
          <svg viewBox="0 0 10 6" width="1em" height="0.6em" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 1l4 4 4-4" /></svg>
        </span>
      </span>
    </span>
  </span>

  <Teleport :to="teleportTarget" defer>
    <Transition name="k-select-drop">
      <div
        v-if="open"
        ref="popupEl"
        v-bind="dropAttrs"
        class="k-select__popup"
        :style="[{ width: popupWidth || undefined }, styles?.list]"
      >
        <div v-if="$slots.header" class="k-select__header" :class="classNames?.header" :style="styles?.header">
          <slot name="header" />
        </div>
        <span
          v-bind="listAttrs"
          class="k-select__list-inner"
          v-on="listOn"
        >
          <span
            v-if="!menuOptions.length"
            class="k-select__empty"
            :class="classNames?.empty"
            :style="styles?.empty"
          >
            <slot name="empty" :pattern="pattern">{{ pattern ? '无匹配' : '暂无数据' }}</slot>
          </span>
          <span v-for="(g, gi) in renderGroups" :key="gi" role="group" :aria-label="g.label ?? undefined">
            <span
              v-if="g.label"
              class="k-select__group"
              :class="classNames?.group"
              :style="styles?.group"
              role="presentation"
            >{{ g.label }}</span>
            <span
              v-for="o in g.children"
              :key="String(o.value)"
              v-bind="optionAttrs(o)"
              class="k-select__option"
              :class="[{ 'is-selected': selectedValues.includes(o.value), 'is-disabled': o.disabled }, classNames?.option]"
              :style="styles?.option"
              v-on="optionOn(o)"
            >
              <slot
                name="option"
                :option="o"
                :selected="selectedValues.includes(o.value)"
                :active="menuOptions.indexOf(o) === activeIndex"
              >
                <span class="k-select__option-label">{{ o.label }}</span>
                <span v-if="multiple && selectedValues.includes(o.value)" class="k-select__option-check" aria-hidden="true">
                  <svg viewBox="0 0 10 8" width="0.9em" height="0.72em" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 4.2l2.6 2.6L9 1.4" /></svg>
                </span>
              </slot>
            </span>
          </span>
        </span>
        <div v-if="$slots.footer" class="k-select__footer" :class="classNames?.footer" :style="styles?.footer">
          <slot name="footer" />
        </div>
      </div>
    </Transition>
  </Teleport>
  </template>
</template>

<style>
/* ---------- 触发器：视觉对齐 KInput 路数（自有部件变量，初值引 alias） ---------- */
.k-select {
  --k-select-height: var(--k-control-height);
  --k-select-padding-x: var(--k-size);
  --k-select-radius: var(--k-border-radius);
  --k-select-bg: var(--k-color-bg-container);
  --k-select-border-color: var(--k-color-border);
  --k-select-border-width: var(--k-line-width);
  --k-select-text-color: var(--k-color-text);
  --k-select-placeholder-color: var(--k-color-text-tertiary);
  --k-select-icon-color: var(--k-color-text-tertiary);
  --k-select-hover-border-color: var(--k-color-primary-hover);
  --k-select-focus-border-color: var(--k-color-primary);
  --k-select-outline: var(--k-control-outline);
  --k-select-outline-width: var(--k-control-outline-width);
  --k-select-tag-bg: var(--k-color-fill-tertiary);
  --k-select-tag-color: var(--k-color-text);
  --k-select-tag-radius: var(--k-border-radius-sm);

  display: inline-flex;
  width: 100%;
  min-width: 0;
  font-family: inherit;
}
.k-select *,
.k-select *::before,
.k-select *::after {
  box-sizing: border-box;
}

.k-select__control {
  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xxs);
  width: 100%;
  min-width: 0;
  padding: 0 var(--k-select-padding-x);
  min-height: var(--k-select-height);
  background-color: var(--k-select-bg);
  border: var(--k-select-border-width) solid var(--k-select-border-color);
  border-radius: var(--k-select-radius);
  cursor: pointer;
  outline: none;
  transition:
    background-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    border-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    box-shadow var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-select:not(.is-disabled) .k-select__control:hover {
  --k-select-border-color: var(--k-select-hover-border-color);
}
.k-select.is-open .k-select__control,
.k-select__control:focus-visible {
  --k-select-border-color: var(--k-select-focus-border-color);
  box-shadow: 0 0 0 var(--k-select-outline-width) var(--k-select-outline);
}
.k-select.is-filterable.is-open .k-select__control {
  cursor: text;
}
/* 多选换行撑高：垂直留白随标签行数计入盒高，否则 wrap 行贴边框、观感窝在盒里 */
.k-select.is-multiple .k-select__control {
  padding-block: var(--k-size-xxs);
}

.k-select__prefix {
  flex: none;
  display: inline-flex;
  align-items: center;
  color: var(--k-select-icon-color);
}

.k-select__content {
  flex: auto;
  min-width: 0;
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--k-size-xxs);
  overflow: hidden;
}
.k-select:not(.is-multiple) .k-select__content {
  flex-wrap: nowrap;
  white-space: nowrap;
  text-overflow: ellipsis;
}
/* 字号消费根级 --k-input-font-size（iOS 16px 防缩放链同源，只消费不重声明） */
.k-select__label,
.k-select__placeholder {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--k-input-font-size);
  line-height: var(--k-line-height);
}
.k-select__placeholder {
  color: var(--k-select-placeholder-color);
}

.k-select__input {
  flex: none;
  min-width: 4px;
  max-width: 100%;
  padding: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--k-select-text-color);
  font-family: inherit;
  font-size: var(--k-input-font-size);
  line-height: var(--k-line-height);
}
.k-select__input--single {
  flex: auto;
  width: 100%;
}
.k-select__input::placeholder {
  color: var(--k-select-placeholder-color);
}

.k-select__tag {
  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xxs);
  max-width: 100%;
  height: calc(var(--k-select-height) - var(--k-size-xxs) * 2 - var(--k-select-border-width) * 2);
  padding: 0 var(--k-size-xs);
  border-radius: var(--k-select-tag-radius);
  background-color: var(--k-select-tag-bg);
  color: var(--k-select-tag-color);
  font-size: var(--k-font-size-sm);
}
.k-select__tag.is-hidden {
  display: none;
}
/* responsive 测量探针：无溢出时退出文档流但保留可测宽度（必须覆写 display:none，否则 offsetWidth=0 收敛多算一档） */
.k-select__tag--overflow.is-hidden {
  display: inline-flex;
  position: absolute;
  visibility: hidden;
  pointer-events: none;
}
.k-select__tag--overflow {
  cursor: default;
  color: var(--k-select-text-color);
}
/* +N 外包 KTooltip 触发层：flex 化消除 inline 基线 strut，否则行高被撑大 3px */
.k-select__content .k-tooltip__trigger {
  display: flex;
  align-items: center;
}
.k-select__tag-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.k-select__tag-remove {
  display: inline-flex;
  color: var(--k-select-icon-color);
  cursor: pointer;
}
.k-select__tag-remove:hover {
  color: var(--k-select-text-color);
}

.k-select__suffix {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xxs);
  color: var(--k-select-icon-color);
}
/* 只命中插槽直供的裸 svg；内建箭头/清除嵌套在各自 span 里且自带宽高（箭头 0.6em），不被覆写 */
.k-select__prefix svg,
.k-select__suffix > svg {
  width: 1em;
  height: 1em;
  display: block;
}
.k-select__arrow {
  display: inline-flex;
  font-size: var(--k-font-size);
  transition: transform var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-select__arrow.is-open {
  transform: rotate(180deg);
}
.k-select__clear {
  display: inline-flex;
  font-size: var(--k-font-size);
  cursor: pointer;
}
.k-select__clear:hover {
  color: var(--k-select-text-color);
}

/* ---------- 尺寸档（只动高度/内边距，字号走根级链） ---------- */
.k-select--xs { --k-select-height: var(--k-control-height-xs); --k-select-padding-x: var(--k-size-sm); }
.k-select--sm { --k-select-height: var(--k-control-height-sm); }
.k-select--lg { --k-select-height: var(--k-control-height-lg); --k-select-padding-x: var(--k-size-md); }

/* ---------- status / variant / disabled（同 KInput 路数） ---------- */
.k-select--error {
  --k-select-border-color: var(--k-color-error);
  --k-select-hover-border-color: var(--k-color-error);
  --k-select-focus-border-color: var(--k-color-error);
  --k-select-outline: color-mix(in oklab, var(--k-color-error) 25%, transparent);
}
.k-select--warning {
  --k-select-border-color: var(--k-color-warning);
  --k-select-hover-border-color: var(--k-color-warning);
  --k-select-focus-border-color: var(--k-color-warning);
  --k-select-outline: color-mix(in oklab, var(--k-color-warning) 25%, transparent);
}
.k-select--filled {
  --k-select-bg: var(--k-color-fill-tertiary);
  --k-select-border-color: transparent;
  --k-select-hover-border-color: transparent;
  --k-select-focus-border-color: transparent;
}
.k-select--borderless {
  --k-select-bg: transparent;
  --k-select-border-color: transparent;
  --k-select-hover-border-color: transparent;
  --k-select-focus-border-color: transparent;
}
.k-select--filled.is-open .k-select__control,
.k-select--borderless.is-open .k-select__control,
.k-select--filled .k-select__control:focus-visible,
.k-select--borderless .k-select__control:focus-visible {
  box-shadow: none;
}
.k-select.is-disabled {
  --k-select-bg: var(--k-color-fill-tertiary);
  --k-select-text-color: var(--k-color-text-quaternary);
  --k-select-tag-color: var(--k-color-text-quaternary);
  cursor: not-allowed;
  pointer-events: none;
}

/* ---------- 弹层（容器契约出口 + dropdown 层级；顶→底展开，上翻镜像） ---------- */
.k-select__popup {
  z-index: var(--k-z-index-dropdown);
  background-color: var(--k-color-bg-elevated);
  border-radius: var(--k-border-radius);
  box-shadow: var(--k-box-shadow-secondary);
  padding: var(--k-size-xs) 0;
  transform-origin: top;
}
.k-select__popup[data-placement='top'] {
  transform-origin: bottom;
}
.k-select-drop-enter-active {
  animation: k-select-drop-in var(--k-motion-duration-fast) var(--k-motion-ease-out-cubic);
}
.k-select-drop-leave-active {
  animation: k-select-drop-out var(--k-motion-duration-fast) var(--k-motion-ease-in-cubic);
}
@keyframes k-select-drop-in {
  from { opacity: 0; transform: scaleY(0); }
  to { opacity: 1; transform: scaleY(1); }
}
@keyframes k-select-drop-out {
  from { opacity: 1; transform: scaleY(1); }
  to { opacity: 0; transform: scaleY(0); }
}
.k-select__header {
  padding: var(--k-size-xs) var(--k-size-sm);
  border-bottom: var(--k-line-width) solid var(--k-color-split);
}
.k-select__footer {
  padding: var(--k-size-xs) var(--k-size-sm);
  border-top: var(--k-line-width) solid var(--k-color-split);
}
.k-select__list-inner {
  display: block;
  max-height: calc(var(--k-select-height, var(--k-control-height)) * 8);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--k-color-fill-secondary) transparent;
}
.k-select__list-inner::-webkit-scrollbar {
  width: 6px;
}
.k-select__list-inner::-webkit-scrollbar-thumb {
  border-radius: 3px;
  background-color: var(--k-color-fill-secondary);
}
.k-select__list-inner::-webkit-scrollbar-thumb:hover {
  background-color: var(--k-color-fill);
}
.k-select__group {
  display: block;
  padding: var(--k-size-xxs) var(--k-size-sm);
  font-size: var(--k-font-size-sm);
  color: var(--k-color-text-tertiary);
}
/* 选项行高 = 触发器 − 4（尺寸变量由 JS 随弹层注入，Teleport 不丢档） */
.k-select__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--k-size-xs);
  min-height: calc(var(--k-select-height, var(--k-control-height)) - var(--k-size-xxs));
  /* seed line-height=2 会把小档行撑回触发器高：行高随档钉死，保证行 = 触发器 −4 */
  line-height: calc(var(--k-select-height, var(--k-control-height)) - var(--k-size-xxs));
  padding: 0 var(--k-size-sm);
  font-size: var(--k-select-option-font-size, var(--k-input-font-size));
  color: var(--k-select-text-color, var(--k-color-text));
  cursor: pointer;
  transition: background-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-select__option[data-active="true"]:not(.is-disabled) {
  background-color: var(--k-color-fill-tertiary);
}
.k-select__option.is-selected {
  color: var(--k-color-primary);
  font-weight: var(--k-font-weight-strong);
  background-color: var(--k-color-primary-bg);
}
.k-select__option.is-selected[data-active="true"] {
  background-color: var(--k-color-primary-bg-hover);
}
.k-select__option.is-disabled {
  color: var(--k-color-text-quaternary);
  cursor: not-allowed;
}
.k-select__option-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.k-select__option-check {
  flex: none;
  display: inline-flex;
}
.k-select__empty {
  display: block;
  padding: var(--k-size) var(--k-size-sm);
  text-align: center;
  color: var(--k-color-text-tertiary);
  font-size: var(--k-select-option-font-size, var(--k-input-font-size));
}
</style>