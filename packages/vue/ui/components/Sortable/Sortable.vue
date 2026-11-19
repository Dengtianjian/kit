<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>

  <!-- 合并根模式：根节点即排序容器（如 <tbody>），列表项直接作为其子级 -->
  <template v-else-if="rootTag">
  <Teleport to="body">
    <div
      v-if="showPlaceholder && floatingPh"
      class="k-sortable__placeholder is-floating"
      aria-hidden="true"
      :style="{ left: `${floatingPh.x + (orientation === 'vertical' ? Math.max(0, placeholderInset ?? 0) : 0)}px`, top: `${floatingPh.y}px`, width: `${Math.max(0, floatingPh.w - (orientation === 'vertical' ? Math.max(0, placeholderInset ?? 0) : 0))}px`, height: `${floatingPh.h}px` }"
    />
  </Teleport>
  <TransitionGroup
    ref="mergedRef"
    :tag="rootTag"
    name="k-sortable"
    v-bind="containerAttrs"
    class="k-sortable is-merged"
    :class="[`k-sortable--${orientation}`, { 'is-disabled': disabled, 'is-scrolling': scrolling, 'is-dragging': dragKey !== null || placeholder !== null, 'is-pointer': usePointer, 'is-keyboard-dragging': keyboardKey !== null }, classNames?.root]"
    :style="styles?.root"
    v-on="containerOn"
  >
    <component
      :is="itemTag"
      v-for="(item, index) in model"
      :key="keyOf(item)"
      v-bind="itemAttrs(item)"
      class="k-sortable__item"
      :class="[classNames?.item, { 'has-handle': hasHandle && itemTag !== 'tr' }]"
      :style="[styles?.item, shiftStyle(item)]"
      v-on="itemDragOn(item)"
    >
      <span
        v-if="hasHandle && itemTag !== 'tr'"
        v-bind="handleAttrs"
        class="k-sortable__handle"
        :class="classNames?.handle"
        :style="styles?.handle"
        v-on="handleDragOn(item)"
      >
        <slot name="handle" :item="item" :index="index">
          <svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" aria-hidden="true"><circle cx="6" cy="4" r="1.2" /><circle cx="10" cy="4" r="1.2" /><circle cx="6" cy="8" r="1.2" /><circle cx="10" cy="8" r="1.2" /><circle cx="6" cy="12" r="1.2" /><circle cx="10" cy="12" r="1.2" /></svg>
        </slot>
      </span>
      <slot :item="item" :index="index" />
    </component>
    <tr
      v-if="tailPad && itemTag === 'tr'"
      :key="'__k-sortable-tail'"
      class="k-sortable__tail"
      aria-hidden="true"
    >
      <td :colspan="columns" :style="{ height: `${tailPad}px`, padding: 0, border: 0 }" />
    </tr>
  </TransitionGroup>
  </template>

  <div
    v-else
    ref="rootEl"
    v-bind="containerAttrs"
    class="k-sortable"
    :class="[`k-sortable--${orientation}`, { 'is-disabled': disabled, 'is-scrolling': scrolling, 'is-dragging': dragKey !== null || placeholder !== null, 'is-pointer': usePointer, 'is-keyboard-dragging': keyboardKey !== null }, classNames?.root]"
    :style="styles?.root"
    v-on="containerOn"
  >
    <component
      :is="itemTag"
      v-if="showPlaceholder && placeholder"
      class="k-sortable__placeholder"
      :class="{ 'is-row': itemTag === 'tr' }"
      aria-hidden="true"
      :style="phStyle"
    >
      <td v-if="itemTag === 'tr'" :colspan="columns" />
    </component>
    <TransitionGroup :tag="tag" name="k-sortable" class="k-sortable__list" :class="classNames?.list" :style="listStyle">
      <component
        :is="itemTag"
        v-for="(item, index) in model"
        :key="keyOf(item)"
        v-bind="itemAttrs(item)"
        class="k-sortable__item"
        :class="[classNames?.item, { 'has-handle': hasHandle && itemTag !== 'tr' }]"
        :style="[styles?.item, shiftStyle(item)]"
        v-on="itemDragOn(item)"
      >
        <span
          v-if="hasHandle && itemTag !== 'tr'"
          v-bind="handleAttrs"
          class="k-sortable__handle"
          :class="classNames?.handle"
          :style="styles?.handle"
          v-on="handleDragOn(item)"
        >
          <slot name="handle" :item="item" :index="index">
            <svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" aria-hidden="true"><circle cx="6" cy="4" r="1.2" /><circle cx="10" cy="4" r="1.2" /><circle cx="6" cy="8" r="1.2" /><circle cx="10" cy="8" r="1.2" /><circle cx="6" cy="12" r="1.2" /><circle cx="10" cy="12" r="1.2" /></svg>
          </slot>
        </span>
        <slot :item="item" :index="index" />
      </component>
    </TransitionGroup>
  </div>

  <Teleport to="body" defer>
    <div class="k-sortable__sr">
      <span :id="instructionsId">按空格抓起，方向键移动，空格或回车放下，Esc 取消</span>
      <span role="status" aria-live="polite" aria-atomic="true">{{ announcement }}</span>
    </div>
  </Teleport>
</template>

<script lang="ts">
/* 跨列拖拽会话：同 group 实例共享（模块作用域，跨实例可见） */
interface KSortableCrossSession {
  group: string;
  source: symbol;
  nonce: symbol;
  key: string | number;
  item: unknown;
  size: { w: number; h: number };
  take: () => unknown;
  /** 当前持有占位的实例：同组只允许一个列表显示占位/让位 */
  hoverTarget: symbol | null;
}
let crossSession: KSortableCrossSession | null = null;
const crossWatchers = new Set<() => void>();

/** pointer 模式的跨列表路由：窗口级 pointermove 时按坐标找同组目标实例 */
interface SortablePointerHost {
  owner: symbol;
  group: string | undefined;
  root: HTMLElement;
  canAccept: (item: unknown) => boolean;
  over: (x: number, y: number) => void;
  drop: () => void;
}
const pointerHosts = new Set<SortablePointerHost>();
function notifyCrossWatchers() {
  crossWatchers.forEach((fn) => fn());
}
</script>

<script setup lang="ts" generic="T">
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, useId, useSlots, watch } from 'vue';
import type { ComponentPublicInstance, CSSProperties, VNodeChild } from 'vue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn, KOnPack } from '../../composables/useCustomRender';
import type { KSortableItemKey, KSortableKey, KSortableOrientation, KSortableRenderScope } from './types';

defineOptions({ name: 'KSortable' });

const instanceId = Symbol('k-sortable');

type SortablePart = 'root' | 'list' | 'item' | 'handle';

interface KSortableProps<T> {
  /** 唯一键：对象字段名或取值函数 */
  itemKey: KSortableItemKey<T>;
  /** 排列形态：纵向列表 / 横向单行 / 网格（自动换行） */
  orientation?: KSortableOrientation;
  disabled?: boolean;
  /** 列表容器标签（ul / div…），仅默认模板生效 */
  tag?: string;
  /** 同组实例之间可跨列表拖拽（v-model 各自维护，建议同组同 orientation） */
  group?: string;
  /** 目标列表是否接受外部拖入项（跨列/树形限制用，默认全部接受） */
  canDrop?: (item: unknown) => boolean;
  /** 合并根标签：设置后根节点本身即排序容器（如 tbody），列表项直接作为其子级 */
  rootTag?: string;
  /** 每项标签（默认 div；表格用 tr） */
  itemTag?: string;
  /** itemTag=tr 时占位行的 colspan */
  columns?: number;
  /** 是否渲染内置占位块（树形等自定义投影指示时可关闭） */
  showPlaceholder?: boolean;
  /** 占位块左侧内缩（px）：树形投影时按深度缩进，宽度同步收窄 */
  placeholderInset?: number;
  /** pointer 模式：pointer 事件拖拽 + 克隆浮层跟随（dnd-kit 风格，无原生拖影）；缺省时 rootTag 表格自动开启 */
  pointer?: boolean;
  /** 触屏长按激活延迟（ms），期间移动超过容差则让给页面滚动 */
  touchDelay?: number;
  /** 触屏长按前的移动容差（px） */
  touchTolerance?: number;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KSortableRenderScope<T>>;
  classNames?: Partial<Record<SortablePart, string>>;
  styles?: Partial<Record<SortablePart, CSSProperties>>;
}

const props = withDefaults(defineProps<KSortableProps<T>>(), {
  orientation: 'vertical',
  disabled: false,
  tag: 'div',
  itemTag: 'div',
  columns: 1,
  showPlaceholder: true,
  placeholderInset: 0,
  touchDelay: 250,
  touchTolerance: 8,
});

const model = defineModel<T[]>('modelValue', { required: true });
/** 合并根（table/tbody 等）默认走 pointer，避免原生拖影导致的表格行闪烁 */
const instance = getCurrentInstance()!;
const usePointer = computed(() => {
  // Boolean prop 缺省会被强转 false，需看原始 vnode props 判断是否显式传入
  const raw = instance.vnode.props ?? {};
  if ('pointer' in raw) return raw.pointer !== false && raw.pointer !== 'false';
  return !!props.rootTag;
});

const emit = defineEmits<{
  change: [items: T[], info: KSortableMoveInfo<T>];
  /** 跨列拖入（目标列表） */
  add: [item: T, index: number];
  /** 跨列拖出（源列表） */
  remove: [item: T, index: number];
  /** 起拖（树形投影等自定义反馈用） */
  dragstart: [info: { x: number; y: number; key: KSortableKey; index: number }];
  /** 拖动中（slot 为当前插入位；关闭内置占位后可据此自绘指示线） */
  dragmove: [info: { x: number; y: number; slot: number; overKey: KSortableKey | null; index: number }];
  /** 拖拽结束（drop 或取消，change 之后） */
  dragend: [];
}>();

const slots = useSlots();
const rootEl = ref<HTMLElement | null>(null);
const hasHandle = computed(() => !!slots.handle);

const dragKey = ref<KSortableKey | null>(null);
/** 原位置隐藏的项：延后一帧置位，保证浏览器拖影快照拍到的是可见原项 */
const sourceHiddenKey = ref<KSortableKey | null>(null);
/** 容器/页面正在滚动：占位与让位临时禁用过渡，避免追不上滚动节奏导致错位 */
const scrolling = ref(false);
const overKey = ref<KSortableKey | null>(null);
const dropPos = ref<'before' | 'after' | null>(null);
/** 外部拖入时的落点槽位 */
const externalSlot = ref<number | null>(null);
const mergedRef = ref<ComponentPublicInstance | null>(null);
const placeholder = ref<{ x: number; y: number; w: number; h: number } | null>(null);
/** 合并根（表格）用的视口坐标占位层：fixed 浮层，不参与表格布局 */
const floatingPh = ref<{ x: number; y: number; w: number; h: number } | null>(null);
watch(placeholder, (v) => {
  if (!v) floatingPh.value = null;
});
/** 尾部落点补的空白（让末尾占位块留在容器内，不溢出边框） */
const tailPad = ref(0);
const shifts = ref<Map<KSortableKey, { x: number; y: number }>>(new Map());
/** 拖拽开始时的各卡片布局矩形/中心点（视口坐标）；让位计算与命中判定都用它，避开 transform 抖动 */
let boxes: Array<{ x: number; y: number; w: number; h: number; cx: number; cy: number }> = [];
let rootOrigin = { x: 0, y: 0 };
/** 列表间距（px），落点累加用 */
let gapPx = 0;
/** 最近一次 dragover 指针位置（视口坐标），滚动后按它重算落点 */
let lastPointer: { x: number; y: number } | null = null;
/** 上次命中的目标项/插前插后：中点附近加滞回，避免指针抖动导致落点反复切换 */
let lastHit: { idx: number; before: boolean } | null = null;
interface PointerDragState {
  key: KSortableKey;
  el: HTMLElement;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  active: boolean;
  touch: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}
let pointerDrag: PointerDragState | null = null;
let pointerOverlay: HTMLElement | null = null;
let pointerHost: SortablePointerHost | null = null;
let activePointerHost: SortablePointerHost | null = null;
let pointerInsideOwn = false;
const pointerDragging = ref(false);
/** 键盘排序：空格/回车拾起，方向键移动，回车/空格/ Esc 结束 */
const keyboardKey = ref<KSortableKey | null>(null);
const instructionsId = `k-sortable-${useId()}-instructions`;
const announcement = ref('');
/** 最近一次落点插入位（dragmove 事件用） */
const lastSlot = ref<number | null>(null);
let dragStarted = false;
const HYSTERESIS = 8;
/** 已在本次外部拖拽中测量过目标布局的会话标记 */
let lastExternalNonce: symbol | null = null;
let autoScrollRaf = 0;
let scrollIdleTimer: ReturnType<typeof setTimeout> | null = null;

function keyOf(item: T): KSortableKey {
  const k = props.itemKey;
  return typeof k === 'function' ? k(item) : ((item as Record<string, unknown>)[k as string] as KSortableKey);
}

function activeCrossSession() {
  return crossSession && props.group && crossSession.group === props.group ? crossSession : null;
}
/** 本实例当前不是拖拽源，但同组有外部拖拽进行中 */
function externalActive() {
  return dragKey.value == null && !!activeCrossSession();
}

function takeByKey(key: KSortableKey): unknown {
  const list = [...model.value];
  const idx = list.findIndex((it) => keyOf(it) === key);
  if (idx < 0) return null;
  const [item] = list.splice(idx, 1);
  externalSlot.value = null;
  model.value = list;
  emit('remove', item, idx);
  return item;
}

function clearExternal() {
  overKey.value = null;
  dropPos.value = null;
  placeholder.value = null;
  shifts.value = new Map();
  externalSlot.value = null;
  tailPad.value = 0;
  lastExternalNonce = null;
  lastHit = null;
  stopAutoScroll();
}

function onCrossNotify() {
  if (!crossSession || crossSession.group !== props.group) {
    if (dragKey.value == null) clearExternal();
    else {
      overKey.value = null;
      dropPos.value = null;
      placeholder.value = null;
      shifts.value = new Map();
      externalSlot.value = null;
      tailPad.value = 0;
    }
    return;
  }
  if (crossSession.hoverTarget && crossSession.hoverTarget !== instanceId) {
    overKey.value = null;
    dropPos.value = null;
    placeholder.value = null;
    shifts.value = new Map();
    externalSlot.value = null;
    tailPad.value = 0;
    stopAutoScroll();
  }
}
crossWatchers.add(onCrossNotify);

function registerPointerHost() {
  if (!props.group || !rootEl.value || pointerHost) return;
  const root = rootEl.value;
  pointerHost = {
    owner: instanceId,
    group: props.group,
    root,
    canAccept: (item) => !props.disabled && (!props.canDrop || props.canDrop(item)),
    over: (x, y) => {
      if (!externalActive()) return;
      if (crossSession && crossSession.group === props.group) {
        crossSession.hoverTarget = instanceId;
        notifyCrossWatchers();
      }
      lastPointer = { x, y };
      updateFromPointer();
      ensureAutoScroll();
    },
    drop: () => {
      commitExternalDrop();
    },
  };
  pointerHosts.add(pointerHost);
}

function unregisterPointerHost() {
  if (pointerHost) {
    pointerHosts.delete(pointerHost);
    pointerHost = null;
  }
}

watch(rootEl, () => {
  unregisterPointerHost();
  registerPointerHost();
});
onMounted(registerPointerHost);

onMounted(() => {
  if (mergedRef.value?.$el instanceof HTMLElement) rootEl.value = mergedRef.value.$el;
});

function itemEls(): HTMLElement[] {
  const root = rootEl.value;
  if (!root) return [];
  // 只取当前列表的直接子项：嵌套列表（树形）不能把内层 item 也算进来
  const scope = root.querySelector<HTMLElement>('.k-sortable__list') ?? root;
  return Array.from(scope.querySelectorAll<HTMLElement>(':scope > [data-part="item"]')).filter(
    (el) => !el.classList.contains('k-sortable-leave-active'),
  );
}

function captureBoxes() {
  const root = rootEl.value;
  if (!root) {
    boxes = [];
    rootOrigin = { x: 0, y: 0 };
    return;
  }
  const rr = root.getBoundingClientRect();
  rootOrigin = { x: rr.left + root.clientLeft, y: rr.top + root.clientTop };
  const listEl = root.querySelector<HTMLElement>('.k-sortable__list');
  gapPx = 0;
  if (listEl) {
    const cs = getComputedStyle(listEl);
    gapPx = parseFloat(props.orientation === 'vertical' ? cs.rowGap : cs.columnGap) || 0;
  }
  // 让位是靠 inline transform 实现的，滚动中重测必须排除它，
  // 否则会量到平移后的位置、连续滚动时偏移反复累加（列表错位/大面积空白）
  const els = itemEls();
  const prev = els.map((el) => el.style.transform);
  els.forEach((el) => {
    el.style.transform = 'none';
  });
  boxes = els.map((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  });
  // 无 flex gap（如原生表格 border-spacing）时，用相邻项实测间距推导，避免让位互相压叠
  if (boxes.length >= 2 && props.orientation !== 'grid') {
    const implied =
      props.orientation === 'vertical'
        ? boxes[1].y - (boxes[0].y + boxes[0].h)
        : boxes[1].x - (boxes[0].x + boxes[0].w);
    if (Number.isFinite(implied) && implied > 0) gapPx = implied;
  }
  els.forEach((el, i) => {
    el.style.transform = prev[i];
  });
}

function resetDrag() {
  if (pointerDrag) cleanupPointer();
  keyboardKey.value = null;
  dragKey.value = null;
  sourceHiddenKey.value = null;
  overKey.value = null;
  dropPos.value = null;
  externalSlot.value = null;
  lastExternalNonce = null;
  placeholder.value = null;
  shifts.value = new Map();
  tailPad.value = 0;
  lastPointer = null;
  lastHit = null;
  stopAutoScroll();
  detachScrollSync();
  scrolling.value = false;
  if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
  scrollIdleTimer = null;
  if (crossSession?.source === instanceId) {
    crossSession = null;
    notifyCrossWatchers();
  }
}

function markScrolling() {
  scrolling.value = true;
  if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
  scrollIdleTimer = setTimeout(() => {
    scrolling.value = false;
    scrollIdleTimer = null;
  }, 140);
}

/* ---------- 滚动同步：容器/页面滚动后重测布局，占位与让位保持正确 ---------- */
function onAnyScroll() {
  if (!lastPointer) return;
  if (dragKey.value == null && !externalActive()) return;
  markScrolling();
  captureBoxes();
  updateFromPointer();
}
function attachScrollSync() {
  window.addEventListener('scroll', onAnyScroll, true);
  rootEl.value?.addEventListener('scroll', onAnyScroll);
}
function detachScrollSync() {
  window.removeEventListener('scroll', onAnyScroll, true);
  rootEl.value?.removeEventListener('scroll', onAnyScroll);
}
/* 拖到容器上/下边缘时自动滚动（容器自身可滚动才生效） */
function autoScrollStep() {
  autoScrollRaf = requestAnimationFrame(autoScrollStep);
  const root = rootEl.value;
  if (!root || !lastPointer) {
    stopAutoScroll();
    return;
  }
  if (dragKey.value == null && !externalActive()) {
    stopAutoScroll();
    return;
  }
  if (root.scrollHeight <= root.clientHeight && root.scrollWidth <= root.clientWidth) return;
  const r = root.getBoundingClientRect();
  const edge = 40;
  let dx = 0;
  let dy = 0;
  if (lastPointer.x < r.left + edge) dx = -Math.min(16, Math.ceil((r.left + edge - lastPointer.x) / 2));
  else if (lastPointer.x > r.right - edge) dx = Math.min(16, Math.ceil((lastPointer.x - (r.right - edge)) / 2));
  if (lastPointer.y < r.top + edge) dy = -Math.min(16, Math.ceil((r.top + edge - lastPointer.y) / 2));
  else if (lastPointer.y > r.bottom - edge) dy = Math.min(16, Math.ceil((lastPointer.y - (r.bottom - edge)) / 2));
  if (!dx && !dy) return;
  const beforeX = root.scrollLeft;
  const beforeY = root.scrollTop;
  root.scrollLeft = beforeX + dx;
  root.scrollTop = beforeY + dy;
  if (root.scrollLeft !== beforeX || root.scrollTop !== beforeY) {
    markScrolling();
    captureBoxes();
    updateFromPointer();
  }
}
function ensureAutoScroll() {
  if (!autoScrollRaf) autoScrollRaf = requestAnimationFrame(autoScrollStep);
}
function stopAutoScroll() {
  if (autoScrollRaf) cancelAnimationFrame(autoScrollRaf);
  autoScrollRaf = 0;
}

function startDrag(item: T, e: DragEvent) {
  if (props.disabled) return;
  // 嵌套排序（树形）：内层先起拖，阻止冒泡到外层 item 的 dragstart
  e.stopPropagation();
  const key = keyOf(item);
  const startIndex = model.value.findIndex((it) => keyOf(it) === key);
  dragKey.value = key;
  dragStarted = true;
  lastHit = null;
  lastSlot.value = null;
  sourceHiddenKey.value = null;
  overKey.value = null;
  dropPos.value = null;
  externalSlot.value = null;
  placeholder.value = null;
  shifts.value = new Map();
  captureBoxes();
  const fromIdx = model.value.findIndex((it) => keyOf(it) === key);
  if (props.group && fromIdx >= 0) {
    const b = boxes[fromIdx];
    crossSession = {
      group: props.group,
      source: instanceId,
      nonce: Symbol('k-sortable-cross'),
      key,
      item,
      size: b ? { w: b.w, h: b.h } : { w: 0, h: 0 },
      take: () => takeByKey(key),
      hoverTarget: null,
    };
    notifyCrossWatchers();
  }
  attachScrollSync();
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(key)); // Firefox 不 setData 不启动拖拽
  }
  emit('dragstart', { x: e.clientX, y: e.clientY, key, index: startIndex });
  // 拖影由浏览器在 dragstart 后立即快照；下一帧再隐藏原位置，避免副本也被拍到隐藏态
  requestAnimationFrame(() => {
    if (dragKey.value === key) sourceHiddenKey.value = key;
  });
}

function endDrag() {
  if (dragStarted) {
    dragStarted = false;
    emit('dragend');
  }
  resetDrag();
}

/* ---------- pointer 模式（dnd-kit 风格：无原生拖影，克隆浮层跟随） ---------- */
function clearLocalPreview() {
  overKey.value = null;
  dropPos.value = null;
  placeholder.value = null;
  shifts.value = new Map();
  tailPad.value = 0;
}

function createPointerOverlay(src: HTMLElement): HTMLElement {
  const rect = src.getBoundingClientRect();
  const clone = src.cloneNode(true) as HTMLElement;
  clone.removeAttribute('draggable');
  clone.querySelectorAll('[draggable]').forEach((node) => node.removeAttribute('draggable'));
  clone.classList.add('k-sortable__pointer-clone');
  let wrapper: HTMLElement;
  if (src.tagName === 'TR') {
    const table = document.createElement('table');
    const sourceTable = src.closest('table');
    if (sourceTable?.className) table.className = sourceTable.className;
    table.style.cssText =
      'position:fixed;margin:0;border-collapse:separate;border-spacing:0;pointer-events:none;z-index:2147483000;background:transparent;filter:drop-shadow(0 10px 24px rgb(0 0 0 / 16%));';
    table.style.width = `${rect.width}px`;
    const tbody = document.createElement('tbody');
    tbody.appendChild(clone);
    table.appendChild(tbody);
    // 行与单元格的计算样式逐项内联：浮层在 body 下，作用域样式/祖先选择器不会生效
    const rowStyle = getComputedStyle(src);
    clone.style.backgroundColor = rowStyle.backgroundColor;
    clone.style.borderRadius = rowStyle.borderRadius;
    clone.style.height = `${rect.height}px`;
    const srcCells = src.querySelectorAll('td');
    clone.querySelectorAll('td').forEach((cell, i) => {
      const source = srcCells[i] as HTMLElement | undefined;
      if (!source) return;
      const cs = getComputedStyle(source);
      const target = cell as HTMLElement;
      const sr = source.getBoundingClientRect();
      target.style.width = `${sr.width}px`;
      target.style.height = `${sr.height}px`;
      target.style.padding = cs.padding;
      // getComputedStyle 的 border 简写常为空串，逐边复制
      (['Top', 'Right', 'Bottom', 'Left'] as const).forEach((side) => {
        target.style[`border${side}Width`] = cs[`border${side}Width`];
        target.style[`border${side}Style`] = cs[`border${side}Style`];
        target.style[`border${side}Color`] = cs[`border${side}Color`];
      });
      target.style.borderRadius = cs.borderRadius;
      target.style.background = cs.backgroundColor;
      target.style.color = cs.color;
      target.style.font = cs.font;
      target.style.textAlign = cs.textAlign;
      target.style.boxSizing = 'border-box';
    });
    wrapper = table;
  } else {
    const cs = getComputedStyle(src);
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.margin = '0';
    clone.style.position = 'fixed';
    clone.style.pointerEvents = 'none';
    clone.style.zIndex = '2147483000';
    clone.style.background = cs.backgroundColor;
    clone.style.color = cs.color;
    clone.style.borderRadius = cs.borderRadius;
    clone.style.padding = cs.padding;
    clone.style.boxSizing = 'border-box';
    clone.style.boxShadow = '0 10px 30px rgb(0 0 0 / 18%)';
    wrapper = clone;
  }
  wrapper.style.left = `${rect.left}px`;
  wrapper.style.top = `${rect.top}px`;
  document.body.appendChild(wrapper);
  return wrapper;
}

function removePointerOverlay() {
  pointerOverlay?.remove();
  pointerOverlay = null;
}

function cleanupPointer() {
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerCancel);
  window.removeEventListener('keydown', onPointerKey);
  if (pointerDrag?.timer) clearTimeout(pointerDrag.timer);
  removePointerOverlay();
  pointerDrag = null;
  pointerDragging.value = false;
  activePointerHost = null;
  pointerInsideOwn = false;
  dragStarted = false;
  document.body.style.userSelect = '';
  (document.body.style as unknown as Record<string, string>).webkitUserSelect = '';
  document.body.style.touchAction = '';
  // 拖拽结束后的那次 click 仍需吞掉（链接不跳转）；等本轮事件派发完再解绑
  setTimeout(() => window.removeEventListener('click', blockNextClick, true), 0);
}

function blockNextClick(ev: Event) {
  ev.preventDefault();
  ev.stopPropagation();
  window.removeEventListener('click', blockNextClick, true);
}

function cancelPointerCandidate() {
  if (!pointerDrag) return;
  if (pointerDrag.timer) clearTimeout(pointerDrag.timer);
  pointerDrag = null;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerCancel);
  window.removeEventListener('keydown', onPointerKey);
}

function activatePointerDrag() {
  if (!pointerDrag || pointerDrag.active) return;
  if (pointerDrag.timer) {
    clearTimeout(pointerDrag.timer);
    pointerDrag.timer = null;
  }
  // 起拖：先克隆浮层再隐藏原项
  pointerDrag.active = true;
  pointerDragging.value = true;
  dragKey.value = pointerDrag.key;
  dragStarted = true;
  lastHit = null;
  lastSlot.value = null;
  overKey.value = null;
  dropPos.value = null;
  shifts.value = new Map();
  placeholder.value = null;
  externalSlot.value = null;
  tailPad.value = 0;
  captureBoxes();
  if (props.group) {
    const idx = model.value.findIndex((it) => keyOf(it) === pointerDrag!.key);
    const box = idx >= 0 ? boxes[idx] : undefined;
    crossSession = {
      group: props.group,
      source: instanceId,
      nonce: Symbol('k-sortable-cross'),
      key: pointerDrag.key,
      item: idx >= 0 ? model.value[idx] : null,
      size: box ? { w: box.w, h: box.h } : { w: 0, h: 0 },
      take: () => takeByKey(pointerDrag!.key),
      hoverTarget: null,
    };
    notifyCrossWatchers();
  }
  pointerOverlay = createPointerOverlay(pointerDrag.el);
  sourceHiddenKey.value = pointerDrag.key;
  attachScrollSync();
  document.body.style.userSelect = 'none';
  (document.body.style as unknown as Record<string, string>).webkitUserSelect = 'none';
  document.body.style.touchAction = 'none';
  window.addEventListener('click', blockNextClick, true);
  emit('dragstart', { x: pointerDrag.startX, y: pointerDrag.startY, key: pointerDrag.key, index: model.value.findIndex((it) => keyOf(it) === pointerDrag!.key) });
}

function onPointerMove(e: PointerEvent) {
  if (!pointerDrag) return;
  if (!pointerDrag.active) {
    const dist = Math.hypot(e.clientX - pointerDrag.startX, e.clientY - pointerDrag.startY);
    if (pointerDrag.touch) {
      // 长按等待期内移动超过容差：让给页面滚动，取消候选
      if (dist > props.touchTolerance) cancelPointerCandidate();
      return;
    }
    if (dist < 4) return;
    activatePointerDrag();
    if (!pointerDrag) return;
  }
  if (!pointerDrag.active) return;
  e.preventDefault();
  const x = e.clientX;
  const y = e.clientY;
  if (pointerOverlay) {
    pointerOverlay.style.left = `${x - pointerDrag.offsetX}px`;
    pointerOverlay.style.top = `${y - pointerDrag.offsetY}px`;
  }
  lastPointer = { x, y };
  const pointIn = (el: HTMLElement | null) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };
  // 用矩形判定而非 elementFromPoint：行间距/空隙会瞬时命中外层元素，导致占位闪断
  pointerInsideOwn = pointIn(rootEl.value);
  let host: SortablePointerHost | null = null;
  if (props.group && crossSession) {
    for (const candidate of pointerHosts) {
      if (
        candidate.owner !== instanceId &&
        candidate.group === props.group &&
        candidate.canAccept(crossSession.item) &&
        pointIn(candidate.root)
      ) {
        host = candidate;
        break;
      }
    }
  }
  activePointerHost = host;
  if (host) {
    stopAutoScroll();
    host.over(x, y);
  } else if (pointerInsideOwn) {
    if (crossSession && crossSession.group === props.group) {
      crossSession.hoverTarget = instanceId;
      notifyCrossWatchers();
    }
    updateFromPointer();
    ensureAutoScroll();
  } else {
    // 离开列表时保留上一次预览（指针抖动/过缝不清空），松手在列表外则不落位
    stopAutoScroll();
  }
  if (pointerInsideOwn && dragKey.value != null && lastSlot.value != null) {
    emit('dragmove', {
      x,
      y,
      slot: lastSlot.value,
      overKey: overKey.value,
      index: model.value.findIndex((it) => keyOf(it) === dragKey.value),
    });
  }
}

function onPointerUp() {
  if (!pointerDrag) return;
  const wasActive = pointerDrag.active;
  const host = activePointerHost;
  const insideOwn = pointerInsideOwn;
  if (wasActive) {
    if (host) {
      host.drop();
      if (crossSession?.source === instanceId) {
        crossSession = null;
        notifyCrossWatchers();
      }
      clearLocalPreview();
    } else if (insideOwn) {
      commitLocalMove();
    }
  }
  cleanupPointer();
  resetDrag();
}

function onPointerCancel() {
  cleanupPointer();
  resetDrag();
}

function onPointerKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    cleanupPointer();
    resetDrag();
  }
}

function onItemPointerDown(item: T, e: PointerEvent, fromHandle = false) {
  if (!usePointer.value || props.disabled) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const handle = e.currentTarget as HTMLElement;
  const itemEl = handle.closest('[data-part="item"]') as HTMLElement | null;
  if (!itemEl || !rootEl.value?.contains(itemEl)) return;
  const rect = itemEl.getBoundingClientRect();
  const touch = e.pointerType !== 'mouse';
  pointerDrag = {
    key: keyOf(item),
    el: itemEl,
    startX: e.clientX,
    startY: e.clientY,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    active: false,
    touch,
    timer: null,
  };
  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);
  window.addEventListener('keydown', onPointerKey);
  if (touch && !fromHandle) {
    // 长按激活：期间保持页面可滚动
    pointerDrag.timer = setTimeout(() => {
      activatePointerDrag();
    }, Math.max(0, props.touchDelay));
  }
}

/** 落点：纵向/横向按布局中点，网格按最近中心；before = 落在目标前半区 */
function locate(x: number, y: number): { idx: number; before: boolean } | null {
  const n = boxes.length;
  if (!n) return null;
  const threshold = (i: number, center: number) => {
    if (!lastHit) return center;
    if (lastHit.idx === i) return lastHit.before ? center + HYSTERESIS : center - HYSTERESIS;
    if (lastHit.idx === i + 1 && lastHit.before) return center - HYSTERESIS;
    return center;
  };
  if (props.orientation === 'vertical') {
    for (let i = 0; i < n; i++) if (y < threshold(i, boxes[i].cy)) return { idx: i, before: true };
    return { idx: n - 1, before: false };
  }
  if (props.orientation === 'horizontal') {
    for (let i = 0; i < n; i++) if (x < threshold(i, boxes[i].cx)) return { idx: i, before: true };
    return { idx: n - 1, before: false };
  }
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < n; i++) {
    const d = (x - boxes[i].cx) ** 2 + (y - boxes[i].cy) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return { idx: best, before: x < boxes[best].cx };
}

function computeShifts(fromIdx: number, slot: number) {
  const map = new Map<KSortableKey, { x: number; y: number }>();
  const isV = props.orientation === 'vertical';
  const sizeOf = (i: number) => (isV ? boxes[i].h : boxes[i].w);
  const coordOf = (i: number) => (isV ? boxes[i].y : boxes[i].x);
  if (props.orientation === 'grid') {
    // 网格：等宽格按相邻中心差让位（换行时中心差即 2D 位移）
    if (slot > fromIdx) {
      for (let i = fromIdx + 1; i < slot; i++) {
        const a = boxes[i];
        const b = boxes[i - 1];
        if (a && b) map.set(keyOf(model.value[i]), { x: b.cx - a.cx, y: b.cy - a.cy });
      }
    } else {
      for (let i = slot; i < fromIdx; i++) {
        const a = boxes[i];
        const b = boxes[i + 1];
        if (a && b) map.set(keyOf(model.value[i]), { x: b.cx - a.cx, y: b.cy - a.cy });
      }
    }
    shifts.value = map;
    return;
  }
  // 列表：按「最终布局」让位——让位项移动到新顺序下的实际坐标，
  // 空档尺寸自然等于被拖项宽/高，宽窄不一时也不会出现空白或覆盖
  if (slot > fromIdx) {
    let pos = coordOf(fromIdx);
    for (let i = fromIdx + 1; i < slot; i++) {
      if (!boxes[i]) break;
      const delta = pos - coordOf(i);
      map.set(keyOf(model.value[i]), isV ? { x: 0, y: delta } : { x: delta, y: 0 });
      pos += sizeOf(i) + gapPx;
    }
  } else {
    let pos = coordOf(slot) + sizeOf(fromIdx) + gapPx;
    for (let i = slot; i < fromIdx; i++) {
      if (!boxes[i]) break;
      const delta = pos - coordOf(i);
      map.set(keyOf(model.value[i]), isV ? { x: 0, y: delta } : { x: delta, y: 0 });
      pos += sizeOf(i) + gapPx;
    }
  }
  shifts.value = map;
}

/** 视口矩形 → 容器内容坐标（占位块 inside root，滚动时随之移动） */
function contentRect(x: number, y: number, w: number, h: number) {
  const root = rootEl.value;
  return {
    x: x - rootOrigin.x + (root?.scrollLeft ?? 0),
    y: y - rootOrigin.y + (root?.scrollTop ?? 0),
    w,
    h,
  };
}

/** 目标列表内容盒（视口坐标，扣除 padding/border），用于约束占位块宽高 */
function listContentBox() {
  const listEl = rootEl.value?.querySelector<HTMLElement>('.k-sortable__list') ?? rootEl.value;
  if (!listEl) return null;
  const r = listEl.getBoundingClientRect();
  const cs = getComputedStyle(listEl);
  const pl = parseFloat(cs.paddingLeft) || 0;
  const pr = parseFloat(cs.paddingRight) || 0;
  const pt = parseFloat(cs.paddingTop) || 0;
  const pb = parseFloat(cs.paddingBottom) || 0;
  const bl = parseFloat(cs.borderLeftWidth) || 0;
  const bt = parseFloat(cs.borderTopWidth) || 0;
  return {
    x: r.left + bl + pl,
    y: r.top + bt + pt,
    w: Math.max(0, listEl.clientWidth - pl - pr),
    h: Math.max(0, listEl.clientHeight - pt - pb),
  };
}

/** 占位块矩形：纵向用目标列内容宽、横向用目标行内容高，避免跨列尺寸不一致时溢出容器 */
function placeRect(destX: number, destY: number, w: number, h: number) {
  if (props.rootTag) {
    floatingPh.value = { x: destX, y: destY, w, h };
    return contentRect(destX, destY, w, h);
  }
  const cb = listContentBox();
  if (!cb) return contentRect(destX, destY, w, h);
  if (props.orientation === 'vertical') return contentRect(cb.x, destY, cb.w, h);
  if (props.orientation === 'horizontal') return contentRect(destX, cb.y, w, cb.h);
  return contentRect(destX, destY, w, h);
}

function onDragOver(e: DragEvent) {
  const cross = externalActive();
  if (props.disabled || (dragKey.value == null && !cross)) return;
  if (cross) {
    const session = activeCrossSession();
    if (session && props.canDrop && !props.canDrop(session.item)) {
      // 目标明确拒绝（如树形防成环）：阻止冒泡，避免外层列表把这次拖拽当成可接受
      e.stopPropagation();
      return;
    }
  }
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  // 嵌套排序：内层列表处理过的 dragover 不再冒泡到外层
  e.stopPropagation();
  if (crossSession && crossSession.group === props.group && crossSession.hoverTarget !== instanceId) {
    crossSession.hoverTarget = instanceId;
    notifyCrossWatchers();
  }
  lastPointer = { x: e.clientX, y: e.clientY };
  updateFromPointer();
  ensureAutoScroll();
  if (dragKey.value != null && lastSlot.value != null) {
    emit('dragmove', {
      x: e.clientX,
      y: e.clientY,
      slot: lastSlot.value,
      overKey: overKey.value,
      index: model.value.findIndex((it) => keyOf(it) === dragKey.value),
    });
  }
}

/** 外部（同组其他实例）拖入：按目标列表的空档插入，源项尺寸来自会话 */
function updateExternal(session: NonNullable<ReturnType<typeof activeCrossSession>>) {
  if (!lastPointer) return;
  // 目标实例首次接收外部拖拽时补测自身布局（源实例只测过自己）
  if (lastExternalNonce !== session.nonce) {
    lastExternalNonce = session.nonce;
    captureBoxes();
  }
  const n = model.value.length;
  let slot = n;
  if (n === 0) slot = 0;
  else {
    const hit = locate(lastPointer.x, lastPointer.y);
    lastHit = hit;
    slot = hit ? hit.idx + (hit.before ? 0 : 1) : n;
  }
  externalSlot.value = slot;
  lastSlot.value = slot;
  overKey.value = null;
  dropPos.value = null;
  const { w: extW, h: extH } = session.size;
  tailPad.value = props.orientation === 'horizontal' ? extW + gapPx : extH + gapPx;
  const map = new Map<KSortableKey, { x: number; y: number }>();
  if (props.orientation === 'grid') {
    const base = boxes[slot] ?? boxes[n - 1];
    const prev = boxes[slot - 1];
    const dx = base && prev ? prev.cx - base.cx : 0;
    const dy = base && prev ? prev.cy - base.cy : -(extH + gapPx);
    for (let i = slot; i < n; i++) map.set(keyOf(model.value[i]), { x: dx, y: dy });
  } else {
    const delta = props.orientation === 'vertical' ? extH + gapPx : extW + gapPx;
    for (let i = slot; i < n; i++) {
      map.set(keyOf(model.value[i]), props.orientation === 'vertical' ? { x: 0, y: delta } : { x: delta, y: 0 });
    }
  }
  shifts.value = map;
  let destX = 0;
  let destY = 0;
  if (n === 0) {
    const listEl = rootEl.value?.querySelector<HTMLElement>('.k-sortable__list') ?? rootEl.value;
    const lr = listEl?.getBoundingClientRect();
    destX = lr?.left ?? rootOrigin.x;
    destY = lr?.top ?? rootOrigin.y;
  } else if (props.orientation === 'vertical') {
    destX = boxes[0].x;
    destY = slot < n ? boxes[slot].y : boxes[n - 1].y + boxes[n - 1].h + gapPx;
  } else if (props.orientation === 'horizontal') {
    destY = boxes[0].y;
    destX = slot < n ? boxes[slot].x : boxes[n - 1].x + boxes[n - 1].w + gapPx;
  } else {
    const last = boxes[n - 1];
    const cell = boxes[Math.min(slot, n - 1)];
    destX = slot < n ? cell.x : last.x + last.w + gapPx;
    destY = slot < n ? cell.y : last.y;
  }
  placeholder.value = placeRect(destX, destY, extW, extH);
}

/** 按最近指针重算落点/让位/占位（dragover、容器滚动、自动滚动共用） */
function updateFromPointer() {
  if (props.disabled || !lastPointer) return;
  const session = externalActive() ? activeCrossSession() : null;
  if (session) {
    updateExternal(session);
    return;
  }
  if (dragKey.value == null) return;
  const fromIdx = model.value.findIndex((it) => keyOf(it) === dragKey.value);
  if (fromIdx < 0) return;
  const hit = locate(lastPointer.x, lastPointer.y);
  if (!hit) return;
  lastHit = hit;
  const slot = hit.idx + (hit.before ? 0 : 1);
  lastSlot.value = slot;
  if (slot === fromIdx || slot === fromIdx + 1) {
    overKey.value = null;
    dropPos.value = null;
    shifts.value = new Map();
    tailPad.value = 0;
    // 回到原位也显示占位块：占住自己原来的布局位
    const self = boxes[fromIdx];
    placeholder.value = self ? placeRect(self.x, self.y, self.w, self.h) : null;
    return;
  }
  overKey.value = keyOf(model.value[hit.idx]);
  dropPos.value = hit.before ? 'before' : 'after';
  computeShifts(fromIdx, slot);
  const src = boxes[fromIdx];
  if (!src) {
    placeholder.value = null;
    return;
  }
  let destX = src.x;
  let destY = src.y;
  if (props.orientation === 'grid') {
    // 网格：落点即目标格本身（让位后该格恰好空出）
    const dest = slot > fromIdx ? boxes[slot - 1] : boxes[slot];
    if (dest) {
      destX = dest.x;
      destY = dest.y;
    }
  } else if (slot > fromIdx) {
    // 向下/向右：从被拖项原位起，累加跨越项的实际宽/高与间距，得到让位后的空档起点
    if (props.orientation === 'vertical') {
      for (let i = fromIdx + 1; i < slot; i++) destY += boxes[i].h + gapPx;
    } else {
      for (let i = fromIdx + 1; i < slot; i++) destX += boxes[i].w + gapPx;
    }
  } else {
    // 向上/向左：目标槽位起点不动
    const dest = boxes[slot];
    if (dest) {
      destX = dest.x;
      destY = dest.y;
    }
  }
  // 尺寸用被拖拽项本身：提示实际会放下的那一块
  // 本地拖拽末尾本身会留下让位空档，不再补尾空（否则会多出一格）
  tailPad.value = 0;
  placeholder.value = placeRect(destX, destY, src.w, src.h);
}

function onDragLeave(e: DragEvent) {
  const t = e.relatedTarget as Node | null;
  if (t && rootEl.value?.contains(t)) return;
  overKey.value = null;
  dropPos.value = null;
  placeholder.value = null;
  shifts.value = new Map();
  externalSlot.value = null;
  tailPad.value = 0;
  lastHit = null;
  stopAutoScroll();
}

function move(from: number, to: number) {
  const list = [...model.value];
  if (from < 0 || from >= list.length || to < 0 || to > list.length || from === to) return;
  const [moved] = list.splice(from, 1);
  list.splice(to, 0, moved);
  resetDrag(); // 先清让位再换序：TransitionGroup 记录的旧位置仍是视觉位置，收位由 FLIP 承担
  model.value = list;
  emit('change', list, { item: moved, from, to });
}

/** 外部拖入落位（HTML5 drop 与 pointer 目标共用） */
function commitExternalDrop(): boolean {
  if (!externalActive()) return false;
  const session = activeCrossSession();
  if (!session) return false;
  const slot = externalSlot.value;
  if (slot == null || (props.canDrop && !props.canDrop(session.item))) {
    clearExternal();
    return false;
  }
  const item = session.take() as T | null;
  crossSession = null;
  notifyCrossWatchers();
  externalSlot.value = null;
  overKey.value = null;
  dropPos.value = null;
  placeholder.value = null;
  shifts.value = new Map();
  tailPad.value = 0;
  stopAutoScroll();
  if (item != null) {
    const next = [...model.value];
    const idx = Math.min(slot, next.length);
    next.splice(idx, 0, item);
    model.value = next;
    emit('add', item, idx);
  }
  return true;
}

function onDrop(e: DragEvent) {
  if (props.disabled) return;
  if (externalActive()) {
    e.preventDefault();
    e.stopPropagation();
    commitExternalDrop();
    return;
  }
  if (dragKey.value == null) return;
  e.preventDefault();
  e.stopPropagation();
  commitLocalMove();
}

function focusByKey(key: KSortableKey) {
  nextTick(() => {
    rootEl.value?.querySelector<HTMLElement>(`[data-part="item"][data-key="${String(key)}"]`)?.focus();
  });
}

function onItemKeydown(item: T, e: KeyboardEvent) {
  if (props.disabled) return;
  const key = keyOf(item);
  if (keyboardKey.value == null) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      keyboardKey.value = key;
      sourceHiddenKey.value = null;
      announcement.value = '已抓起，方向键移动，空格或回车放下，Esc 取消';
    }
    return;
  }
  if (keyboardKey.value !== key) return;
  const moveKeys =
    props.orientation === 'vertical'
      ? ['ArrowUp', 'ArrowDown']
      : props.orientation === 'horizontal'
        ? ['ArrowLeft', 'ArrowRight']
        : ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  if (moveKeys.includes(e.key)) {
    e.preventDefault();
    const delta =
      e.key === 'ArrowUp' || e.key === 'ArrowLeft'
        ? -1
        : e.key === 'ArrowDown' || e.key === 'ArrowRight'
          ? 1
          : 0;
    if (!delta) return;
    const arr = [...model.value];
    const from = arr.findIndex((it) => keyOf(it) === key);
    const to = Math.min(arr.length - 1, Math.max(0, from + delta));
    if (from < 0 || from === to) return;
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    model.value = arr;
    emit('change', arr, { item: moved, from, to });
    announcement.value = `已移动到第 ${to + 1} 项，共 ${arr.length} 项`;
    focusByKey(key);
    return;
  }
  if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
    e.preventDefault();
    const cancelled = e.key === 'Escape';
    keyboardKey.value = null;
    announcement.value = cancelled ? '已取消移动' : '已放下';
  }
}

/** 本地落位（HTML5 drop 与 pointer up 共用） */
function commitLocalMove() {
  if (dragKey.value == null) return;
  const from = model.value.findIndex((it) => keyOf(it) === dragKey.value);
  const toKey = overKey.value;
  const pos = dropPos.value;
  if (from < 0 || toKey == null || pos == null) {
    resetDrag();
    return;
  }
  const target = model.value.findIndex((it) => keyOf(it) === toKey);
  if (target < 0) {
    resetDrag();
    return;
  }
  const rawTo = target + (pos === 'after' ? 1 : 0);
  move(from, rawTo > from ? rawTo - 1 : rawTo);
}

/* ---------- 绑定包 ---------- */
const containerAttrs = { 'data-part': 'root' };
const containerOn: KOnPack = {
  dragover: (e) => onDragOver(e as DragEvent),
  dragleave: (e) => onDragLeave(e as DragEvent),
  drop: (e) => onDrop(e as DragEvent),
};
const handleAttrs = computed(() => ({
  'data-part': 'handle',
  draggable: usePointer.value || props.disabled ? undefined : 'true',
}));
const dragStartOn = (item: T): KOnPack => ({
  keydown: (e) => onItemKeydown(item, e as KeyboardEvent),
  ...(usePointer.value
    ? { pointerdown: (e) => onItemPointerDown(item, e as PointerEvent) }
    : {
        dragstart: (e) => startDrag(item, e as DragEvent),
        dragend: () => endDrag(),
      }),
});
function itemDragOnPack(item: T): KOnPack {
  const pack: KOnPack = { keydown: (e) => onItemKeydown(item, e as KeyboardEvent) };
  if (hasHandle.value) return pack;
  Object.assign(pack, dragStartOn(item));
  return pack;
}
const itemDragOn = (item: T) => itemDragOnPack(item);
const handleDragOn = (item: T): KOnPack => ({
  keydown: (e) => onItemKeydown(item, e as KeyboardEvent),
  ...(usePointer.value
    ? { pointerdown: (e) => onItemPointerDown(item, e as PointerEvent, true) }
    : {
        dragstart: (e) => startDrag(item, e as DragEvent),
        dragend: () => endDrag(),
      }),
});
function shiftStyle(item: T): CSSProperties | undefined {
  const s = shifts.value.get(keyOf(item));
  return s ? { transform: `translate(${s.x}px, ${s.y}px)` } : undefined;
}
const phStyle = computed<CSSProperties | undefined>(() => {
  const p = placeholder.value;
  if (!p) return undefined;
  const inset = props.orientation === 'vertical' ? Math.max(0, props.placeholderInset ?? 0) : 0;
  return {
    left: `${p.x + inset}px`,
    top: `${p.y}px`,
    width: `${Math.max(0, p.w - inset)}px`,
    height: `${p.h}px`,
  };
});
const listStyle = computed(() => {
  const extra: CSSProperties = {};
  if (tailPad.value) {
    if (props.orientation === 'horizontal') extra.paddingRight = `${tailPad.value}px`;
    else extra.paddingBottom = `${tailPad.value}px`;
  }
  return [props.styles?.list, extra];
});
const itemAttrs = (item: T) => {
  const key = keyOf(item);
  return {
    'data-part': 'item',
    'data-key': String(key),
    draggable: !usePointer.value && !props.disabled && !hasHandle.value ? 'true' : undefined,
    'data-dragging': sourceHiddenKey.value === key || undefined,
    'data-drop': overKey.value === key ? (dropPos.value ?? undefined) : undefined,
    'data-shift': shifts.value.has(key) || undefined,
    tabindex: props.disabled ? undefined : 0,
    'aria-grabbed': keyboardKey.value === key ? 'true' : undefined,
    'aria-describedby': props.disabled ? undefined : instructionsId,
  };
};

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KSortableRenderScope<T>>(
  () => props.render,
  () => ({
    items: model.value,
    orientation: props.orientation,
    disabled: props.disabled,
    draggingKey: dragKey.value,
    keyOf,
    rootEl,
    itemAttrs,
    itemDragOn,
    handleAttrs: handleAttrs.value,
    handleDragOn,
    containerAttrs,
    containerOn,
    move,
    slots,
  }),
);

defineSlots<{
  default?(scope: { item: T; index: number }): VNodeChild;
  handle?(scope: { item: T; index: number }): VNodeChild;
  render?(scope: KSortableRenderScope<T>): VNodeChild;
}>();

defineExpose({ move, resetDrag });

onBeforeUnmount(() => {
  stopAutoScroll();
  detachScrollSync();
  unregisterPointerHost();
  crossWatchers.delete(onCrossNotify);
  if (crossSession?.source === instanceId) {
    crossSession = null;
    notifyCrossWatchers();
  }
  if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
});
</script>

<style>
.k-sortable {
  --k-sortable-gap: var(--k-size-xs);
  --k-sortable-shift-duration: 0.18s;
  --k-sortable-move-duration: 0.22s;

  position: relative;
  font-family: inherit;
  font-size: var(--k-font-size);
  color: var(--k-color-text);
}
.k-sortable *,
.k-sortable *::before,
.k-sortable *::after {
  box-sizing: border-box;
}
.k-sortable__list {
  display: flex;
  gap: var(--k-sortable-gap);
  margin: 0;
  padding: 0;
}
.k-sortable--vertical .k-sortable__list {
  flex-direction: column;
  align-items: stretch;
}
/* 纵向列满时行项不被 flex 压缩（压缩会挤到列外/内容变形） */
.k-sortable--vertical .k-sortable__item {
  flex: none;
}
.k-sortable--horizontal .k-sortable__list {
  flex-direction: row;
  align-items: center;
  flex-wrap: nowrap;
}
.k-sortable--grid .k-sortable__list {
  flex-direction: row;
  align-items: stretch;
  flex-wrap: wrap;
}
.k-sortable--horizontal .k-sortable__item,
.k-sortable--grid .k-sortable__item {
  flex: none;
}
.k-sortable__item {
  position: relative;
  /* 拖拽列表禁止文本选择，避免拖动/长按选中文字（表单控件除外） */
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  transition: transform var(--k-sortable-shift-duration) var(--k-motion-ease-out-cubic);
}
.k-sortable__item :is(input, textarea, [contenteditable='true']) {
  user-select: text;
  -webkit-user-select: text;
}
/* 把手模式：把手与内容同一行，内容占满剩余宽度 */
.k-sortable__item.has-handle {
  display: flex;
  align-items: center;
  gap: var(--k-size-xxs);
}
.k-sortable__item.has-handle > :not(.k-sortable__handle) {
  flex: 1 1 auto;
  min-width: 0;
}
.k-sortable__item[draggable='true'] {
  cursor: grab;
}
.k-sortable.is-pointer .k-sortable__item {
  cursor: grab;
  /* 与 dnd-kit 取舍一致：项上 touch-action none，避免移动时被浏览器滚动接管（滚动从空隙/空白处发起） */
  touch-action: none;
}
.k-sortable__item:focus-visible {
  outline: 2px solid var(--k-color-primary);
  outline-offset: -2px;
}
.k-sortable.is-keyboard-dragging .k-sortable__item[aria-grabbed='true'] {
  box-shadow: inset 2px 0 0 var(--k-color-primary);
}
.k-sortable.is-pointer.is-dragging .k-sortable__item {
  user-select: none;
  will-change: transform;
}
/* 拖拽源在原位置完全隐藏（不遮挡让位滑入的相邻项），拖拽副本由原生拖影承担 */
.k-sortable__item[data-dragging] {
  opacity: 0;
  pointer-events: none;
}
.k-sortable__item[data-shift] {
  pointer-events: none;
}
/* 落点占位块：虚线主色框 + 淡底，覆盖让位空档，替代参考线 */
.k-sortable__placeholder {
  position: absolute;
  z-index: 0;
  box-sizing: border-box;
  border: 2px dashed var(--k-color-primary);
  border-radius: var(--k-border-radius);
  background-color: color-mix(in oklab, var(--k-color-primary) 6%, transparent);
  pointer-events: none;
  transition:
    left var(--k-sortable-shift-duration) var(--k-motion-ease-out-cubic),
    top var(--k-sortable-shift-duration) var(--k-motion-ease-out-cubic),
    width var(--k-sortable-shift-duration) var(--k-motion-ease-out-cubic),
    height var(--k-sortable-shift-duration) var(--k-motion-ease-out-cubic);
}
/* 合并根（如 tbody）：根节点即容器，tr 由原生表格布局，仅保留定位上下文 */
.k-sortable.is-merged {
  position: relative;
}
/* 合并根（表格）占位：Teleport 到 body 的 fixed 浮层，不参与表格布局，也不触发行的 FLIP */
.k-sortable__placeholder.is-floating {
  position: fixed;
  z-index: 10;
}

.k-sortable__handle {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  cursor: grab;
  color: var(--k-color-text-tertiary);
  touch-action: none;
  user-select: none;
}
.k-sortable__handle:hover {
  color: var(--k-color-text);
}
.k-sortable.is-disabled {
  opacity: 0.6;
}
/* 交互动画：实时让位（基础行 transform 过渡）+ 松手 FLIP */
.k-sortable .k-sortable-enter-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.k-sortable .k-sortable-enter-from {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
.k-sortable .k-sortable-leave-active {
  position: absolute;
  transition: opacity 0.15s ease, transform 0.15s ease;
  pointer-events: none;
}
.k-sortable .k-sortable-leave-to {
  opacity: 0;
  transform: translateX(24px) scale(0.98);
}
.k-sortable .k-sortable-move {
  transition: transform var(--k-sortable-move-duration) var(--k-motion-ease-out-cubic);
}
/* 拖拽中禁用 FLIP：TransitionGroup 的 move 探测会覆盖我们手动让位 transform */
.k-sortable.is-dragging .k-sortable-move {
  transition: none;
}
/* 滚动中：占位与让位即时跟手，避免过渡滞后造成错位/视觉压缩 */
.k-sortable.is-scrolling .k-sortable__item,
.k-sortable.is-scrolling .k-sortable__placeholder {
  transition: none;
}
/* 读屏专用：键盘操作说明 + 移动播报 */
.k-sortable__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
</style>
