<template>
  <Teleport to="body" defer>
    <div
      v-for="col in columns"
      :key="col.placement"
      :ref="(el) => setListEl(col.placement, el)"
      :class="[
        popupClasses,
        `is-${col.placement}`,
        scrollable.has(col.placement) ? 'is-scrollable' : '',
        isStackMode(col.placement, col.list.length) ? 'is-stack' : '',
        expanded.has(col.placement) ? 'is-stack-expanded' : '',
      ]"
      :data-k-theme="popupTheme"
      :style="listStyle(col.placement)"
      data-part="list"
    >
      <div
        class="k-notification-list-content"
        :style="contentStyle(col.placement)"
        @mouseenter="onListEnter(col.placement)"
        @mouseleave="onListLeave(col.placement)"
      >
      <KNotification
        v-for="it in col.list"
        :key="it.id"
        :style="stackStyles[it.id]"
        :ref="(inst) => setEl(it.id, inst)"
        :title="it.config.title"
        :description="it.config.description"
        :actions="it.config.actions ?? it.config.btn"
        :type="it.config.type"
        :icon="it.config.icon"
        :closable="it.closable"
        :close-icon="it.closeIcon"
        :show-progress="it.showProgress"
        :progress-duration="it.duration === false ? undefined : it.duration"
        :pause-on-hover="resolvedPause(it)"
        :role="it.config.role"
        :class-names="it.config.classNames"
        :styles="it.config.styles"
        :class="[
          it.updated ? 'is-static' : '',
          closing.has(it.id) ? 'is-closing' : '',
          isCardPaused(it) ? 'is-paused' : '',
        ]"
        @close="requestClose(it)"
        @click="it.config.onClick?.($event)"
      />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { CSSProperties } from 'vue';
import KNotification from './Notification.vue';
import { usePopupHost } from '../../composables/usePopup';
import type { KNotificationHolderItem, KNotificationPlacement, KNotificationService } from './service';

defineOptions({ name: 'KNotificationHolder' });

/** KApp 内部件：notification 队列按 placement 分列渲染（每个方位一个列表）+ 自动关闭计时/悬停暂停/退场塌陷 */
const props = defineProps<{ svc: KNotificationService }>();

const PLACEMENTS: KNotificationPlacement[] = [
  'top', 'topLeft', 'topRight', 'bottom', 'bottomLeft', 'bottomRight',
];
const columns = computed(() =>
  PLACEMENTS.map((p) => ({ placement: p, list: props.svc.items.value.filter((i) => i.placement === p) })).filter(
    (c) => c.list.length,
  ),
);

const { popupClasses, popupTheme } = usePopupHost(() => ['k-notification-list']);

/* ---- 堆叠收起（antd 路线）：卡片绝对定位，收起时等比缩放错位，hover 展开按真实高度排开 ---- */
const expanded = ref<Set<KNotificationPlacement>>(new Set());
const collapseTimers = new Map<KNotificationPlacement, ReturnType<typeof setTimeout>>();
const stackStyles = ref<Record<number, CSSProperties>>({});
const contentHeights = ref<Partial<Record<KNotificationPlacement, number>>>({});
const STACK_OFFSET = 12;
const STACK_GAP = 16;

function stackLimit(): number {
  const n = props.svc.global.value.stackLimit;
  return n == null ? 3 : Math.max(0, n);
}

function isStackMode(placement: KNotificationPlacement, count: number): boolean {
  const limit = stackLimit();
  return limit > 0 && count > limit;
}

function isBottom(placement: KNotificationPlacement): boolean {
  return placement.startsWith('bottom');
}

function contentStyle(placement: KNotificationPlacement): CSSProperties {
  const h = contentHeights.value[placement];
  return h == null ? {} : { height: `${h}px` };
}

function layoutStacks() {
  const styles: Record<number, CSSProperties> = {};
  const heights: Partial<Record<KNotificationPlacement, number>> = {};
  for (const col of columns.value) {
    const placement = col.placement;
    const list = col.list;
    const bottom = isBottom(placement);
    const collapsed = isStackMode(placement, list.length) && !expanded.value.has(placement);
    // 最新一张在前（z 最高）；无论是否堆叠都用绝对定位，跨阈值时 top/transform 可过渡
    const items = [...list].reverse();
    let offset = 0;
    let frontH = 0;
    let visible = 0;
    items.forEach((item, index) => {
      const el = els.get(item.id);
      const isClosing = closing.value.has(item.id);
      const h = isClosing ? 0 : (el?.offsetHeight ?? 0);
      if (index === 0) frontH = h;
      const hidden = isClosing || (collapsed && index >= stackLimit());
      const style: CSSProperties = {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 100 - index,
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? 'none' : 'auto',
        transform: isClosing
          ? 'scale(0.86)'
          : collapsed
            ? `scale(${Math.max(0.88, 1 - index * 0.04)})`
            : 'scale(1)',
        transformOrigin: bottom ? 'center bottom' : 'center top',
      };
      if (collapsed) {
        const shift = Math.min(index, stackLimit() - 1) * STACK_OFFSET;
        if (bottom) style.bottom = `${shift}px`;
        else style.top = `${shift}px`;
      } else {
        if (bottom) style.bottom = `${offset}px`;
        else style.top = `${offset}px`;
        offset += h + STACK_GAP;
      }
      styles[item.id] = style;
      if (!hidden) visible += 1;
    });
    heights[placement] = collapsed
      ? frontH + Math.max(0, visible - 1) * STACK_OFFSET
      : Math.max(0, offset - STACK_GAP);
  }
  stackStyles.value = styles;
  contentHeights.value = heights;
}

function scheduleLayout() {
  void nextTick(layoutStacks);
}

function expandPlacement(placement: KNotificationPlacement) {
  const timer = collapseTimers.get(placement);
  if (timer) clearTimeout(timer);
  collapseTimers.delete(placement);
  if (!expanded.value.has(placement)) {
    expanded.value = new Set(expanded.value).add(placement);
    scheduleLayout();
  }
}

function scheduleCollapse(placement: KNotificationPlacement) {
  const timer = collapseTimers.get(placement);
  if (timer) clearTimeout(timer);
  collapseTimers.set(
    placement,
    setTimeout(() => {
      collapseTimers.delete(placement);
      if (!expanded.value.has(placement)) return;
      expanded.value = new Set([...expanded.value].filter((p) => p !== placement));
      scheduleLayout();
    }, 160),
  );
}

const hovered = ref<Set<KNotificationPlacement>>(new Set());

function onListEnter(placement: KNotificationPlacement) {
  hovered.value = new Set(hovered.value).add(placement);
  expandPlacement(placement);
  for (const item of props.svc.items.value) {
    if (item.placement === placement && shouldPause(item)) pauseTimer(item);
  }
}

function onListLeave(placement: KNotificationPlacement) {
  const next = new Set(hovered.value);
  next.delete(placement);
  hovered.value = next;
  scheduleCollapse(placement);
  for (const item of props.svc.items.value) {
    if (item.placement === placement) resumeTimer(item);
  }
}


/* ---- 溢出检测：超高列切 is-scrollable（恢复交互 + 显细滚动条），未溢出列保持 pointer-events:none 不挡背后页面 ---- */
const listEls = new Map<KNotificationPlacement, HTMLElement>();
const scrollable = ref<Set<KNotificationPlacement>>(new Set());

function setListEl(placement: KNotificationPlacement, el: unknown) {
  if (el instanceof HTMLElement) listEls.set(placement, el);
  else listEls.delete(placement);
}
function syncScrollable() {
  const next = new Set<KNotificationPlacement>();
  for (const [p, el] of listEls) {
    if (el.scrollHeight > el.clientHeight + 1) next.add(p);
  }
  scrollable.value = next;
}
watch(
  () => props.svc.global.value.pauseOnHover,
  (v) => {
    // 全局开关实时联动：关 → 恢复所有计时；开 → 正在悬停的列中，单条允许暂停的立即暂停
    for (const item of props.svc.items.value) {
      if (v === false) resumeTimer(item);
      else if (hovered.value.has(item.placement) && shouldPause(item)) pauseTimer(item);
    }
  },
);
watch([() => props.svc.items.value, () => props.svc.global.value, expanded], () => {
  void nextTick(() => {
    layoutStacks();
    syncScrollable();
  });
});
onMounted(() => {
  layoutStacks();
  syncScrollable();
  window.addEventListener('resize', syncScrollable);
  window.addEventListener('resize', layoutStacks);
});

/** 阴影留白带上下合计（px），与样式表 --k-notification-gutter-top/bottom 同值 */
const GUTTER_Y = 28 + 46;

/** api.config() 的 top/bottom（px）覆盖默认缘距，同时换算滚动容器高度上限 */
function listStyle(placement: KNotificationPlacement): CSSProperties {
  const { top, bottom } = props.svc.global.value;
  const style: CSSProperties = {};
  if (placement.startsWith('top') && top != null) style.top = `${top}px`;
  if (placement.startsWith('bottom') && bottom != null) style.bottom = `${bottom}px`;
  if (top != null || bottom != null) {
    // 与 CSS 基线同款换算：视口高 − 上下缘距 + 留白带上下合计（GUTTER_Y 与样式表 gutter-top/bottom 同步改）
    style.maxHeight = `calc(100vh - ${top != null ? `${top}px` : 'var(--k-size)'} - ${
      bottom != null ? `${bottom}px` : 'var(--k-size)'
    } + ${GUTTER_Y}px)`;
  }
  return style;
}

/* ---- 自动关闭计时：duration 秒，悬停暂停/续跑（pauseOnHover） ---- */
interface TimerEntry {
  handle: ReturnType<typeof setTimeout> | null;
  remaining: number;
  startedAt: number;
  paused: boolean;
}
const timers = new Map<number, TimerEntry>();

function arm(id: number, e: TimerEntry) {
  e.startedAt = Date.now();
  e.paused = false;
  e.handle = setTimeout(() => {
    e.handle = null;
    const item = props.svc.items.value.find((x) => x.id === id);
    if (item) requestClose(item);
  }, e.remaining);
}

function syncTimers() {
  const alive = new Set(props.svc.items.value.map((i) => i.id));
  for (const [id, e] of timers) {
    if (e.handle && !alive.has(id)) clearTimeout(e.handle);
    if (!alive.has(id)) timers.delete(id);
  }
  for (const item of props.svc.items.value) {
    if (item.duration === false || timers.has(item.id) || closing.value.has(item.id)) continue;
    const e: TimerEntry = { handle: null, remaining: item.duration * 1000, startedAt: 0, paused: false };
    timers.set(item.id, e);
    arm(item.id, e);
  }
}

function pauseTimer(item: KNotificationHolderItem) {
  const e = timers.get(item.id);
  if (!e || e.paused || !e.handle) return;
  clearTimeout(e.handle);
  e.handle = null;
  e.remaining = Math.max(0, e.remaining - (Date.now() - e.startedAt));
  e.paused = true;
  // 暂停时已经到点（计时器回调尚未执行 / 后台节流）：直接收口，避免停在无 timer 的 paused 状态
  if (e.remaining <= 0) {
    e.paused = false;
    requestClose(item);
  }
}
function resumeTimer(item: KNotificationHolderItem) {
  const e = timers.get(item.id);
  if (!e || !e.paused) return;
  if (e.remaining <= 0) {
    e.paused = false;
    requestClose(item);
    return;
  }
  arm(item.id, e);
}
/** 单条 pauseOnHover=true 才暂停；global pauseOnHover=false 作为整列总开关（可运行时切换） */
function shouldPause(item: KNotificationHolderItem): boolean {
  return props.svc.global.value.pauseOnHover !== false && item.pauseOnHover && item.duration !== false;
}
/** 卡片的悬停冻结：单条 false 永远不暂停；单条 true 随全局开关 */
function resolvedPause(item: KNotificationHolderItem): boolean {
  return item.pauseOnHover && props.svc.global.value.pauseOnHover !== false;
}
/** 列悬停暂停时，列内所有可暂停卡片（不只鼠标下那张）的进度条一起冻结 */
function isCardPaused(item: KNotificationHolderItem): boolean {
  return hovered.value.has(item.placement) && shouldPause(item);
}
/* ---- 退场：antd 路线——当前项淡出缩放，布局按 0 高重排，其它项平滑补位 ---- */
const closing = ref<Set<number>>(new Set());
const els = new Map<number, HTMLElement>();
const closeBackstops = new Map<number, ReturnType<typeof setTimeout>>();

// 放在 closing 初始化之后：immediate 回调会读 closing，提前注册会触发 TDZ
watch(() => props.svc.items.value, syncTimers, { immediate: true });

function setEl(id: number, inst: unknown) {
  const el = (inst as { $el?: HTMLElement } | null)?.$el;
  if (el instanceof HTMLElement) els.set(id, el);
  else els.delete(id);
}

function requestClose(item: KNotificationHolderItem) {
  if (closing.value.has(item.id)) return;
  const e = timers.get(item.id);
  if (e?.handle) clearTimeout(e.handle);
  timers.delete(item.id);
  closing.value = new Set(closing.value).add(item.id);
  scheduleLayout();
  closeBackstops.set(
    item.id,
    setTimeout(() => finishClose(item.id), 240),
  );
}
function finishClose(id: number) {
  const backstop = closeBackstops.get(id);
  if (backstop) clearTimeout(backstop);
  closeBackstops.delete(id);
  closing.value = new Set([...closing.value].filter((x) => x !== id));
  const item = props.svc.items.value.find((x) => x.id === id);
  if (item) props.svc.remove(item);
}
onBeforeUnmount(() => {
  window.removeEventListener('resize', syncScrollable);
  window.removeEventListener('resize', layoutStacks);
  for (const e of timers.values()) if (e.handle) clearTimeout(e.handle);
  timers.clear();
  for (const t of closeBackstops.values()) clearTimeout(t);
  closeBackstops.clear();
  for (const t of collapseTimers.values()) clearTimeout(t);
  collapseTimers.clear();
});
</script>

<style>
.k-notification-list {
  position: fixed;
  z-index: var(--k-z-index-notification);
  display: flex;
  flex-direction: column;
  width: calc(var(--k-size) * 16 + var(--k-notification-gutter-x) * 2); /* 列宽 256 + 阴影留白带 */
  max-width: calc(100vw - var(--k-size) * 2 + var(--k-notification-gutter-x) * 2);
  max-height: calc(100vh - var(--k-size) * 2 + var(--k-notification-gutter-top) + var(--k-notification-gutter-bottom)); /* 超出视口 → 列内滚动（差异登记：antd 默认 stack 收起）；border-box 含留白带，卡片视觉缘距仍为 size */
  overflow-y: auto;
  overflow-x: hidden; /* 进场滑入项不撑出横向滚动条 */
  /* 未溢出列隐藏滚动条（pointer-events:none 本就不可拖拽，纯装饰）；溢出列 is-scrollable 显细轨并恢复交互 */
  scrollbar-width: none;
  /* 滚动容器会裁切 box-shadow：留白带按 boxShadow 令牌实际外溢逐边取（最外层 0 9px 28px 8px → 横 36 / 上 27 / 下 45，向上取整），
     负 margin 等量回补卡片视觉位（定位规则保持 size 缘距不动） */
  --k-notification-gutter-x: 36px;
  --k-notification-gutter-top: 28px;
  --k-notification-gutter-bottom: 46px;
  padding: var(--k-notification-gutter-top) var(--k-notification-gutter-x) var(--k-notification-gutter-bottom);
  margin: calc(var(--k-notification-gutter-top) * -1) calc(var(--k-notification-gutter-x) * -1) calc(var(--k-notification-gutter-bottom) * -1);
  font-family: inherit;
  /* 条间隔用方向感知 margin 而非 flex gap：塌陷动画可一并归零 */
  pointer-events: none;
}
.k-notification-list.is-topLeft,
.k-notification-list.is-bottomLeft {
  left: var(--k-size);
}
.k-notification-list.is-topRight,
.k-notification-list.is-bottomRight {
  right: var(--k-size);
}
.k-notification-list.is-top,
.k-notification-list.is-bottom {
  left: 50%;
  transform: translateX(-50%);
}
.k-notification-list.is-top,
.k-notification-list.is-topLeft,
.k-notification-list.is-topRight {
  top: var(--k-size);
}
.k-notification-list.is-bottom,
.k-notification-list.is-bottomLeft,
.k-notification-list.is-bottomRight {
  bottom: var(--k-size);
  flex-direction: column-reverse;
}
/* 列间隔（margin 版）：常规列间距挂在后继项上沿，column-reverse 挂下沿 */
.k-notification-list:not(.is-bottom):not(.is-bottomLeft):not(.is-bottomRight)
  .k-notification
  + .k-notification {
  margin-top: var(--k-size);
}
.k-notification-list.is-bottom .k-notification + .k-notification,
.k-notification-list.is-bottomLeft .k-notification + .k-notification,
.k-notification-list.is-bottomRight .k-notification + .k-notification {
  margin-bottom: var(--k-size);
}

/* 进场：从所在边缘滑入 */
.k-notification-list .k-notification {
  /* flex 列子项默认可压缩：超高时卡片会被压扁而非溢出滚动，必须钉死自然高度 */
  flex-shrink: 0;
  animation: k-notification-in var(--k-motion-duration-mid) var(--k-motion-ease-out-cubic);
}
/* 溢出列：恢复整列交互（滚轮/滚动条拖拽在留白带与条间隔上也生效），细轨滚动条走 fill 阶梯色（Modal body 同款） */
.k-notification-list-content {
  position: relative;
  flex-shrink: 0;
  width: 100%;
  pointer-events: auto;
  height: 0;
  transition: height var(--k-motion-duration-mid) var(--k-motion-ease-in-out-cubic);
}
.k-notification-list-content .k-notification {
  margin: 0 !important;
  transition:
    top var(--k-motion-duration-mid) var(--k-motion-ease-in-out-cubic),
    bottom var(--k-motion-duration-mid) var(--k-motion-ease-in-out-cubic),
    transform var(--k-motion-duration-mid) var(--k-motion-ease-in-out-cubic),
    opacity var(--k-motion-duration-fast) linear;
}
.k-notification-list.is-stack {
  pointer-events: auto;
}
.k-notification-list.is-scrollable {
  pointer-events: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--k-color-fill-secondary) transparent;
}
.k-notification-list.is-scrollable::-webkit-scrollbar {
  width: 6px;
}
.k-notification-list.is-scrollable::-webkit-scrollbar-thumb {
  border-radius: 3px;
  background-color: var(--k-color-fill-secondary);
}
.k-notification-list.is-scrollable::-webkit-scrollbar-thumb:hover {
  background-color: var(--k-color-fill);
}
.k-notification-list.is-topRight .k-notification,
.k-notification-list.is-bottomRight .k-notification {
  --k-notification-from: translateX(110%);
}
.k-notification-list.is-topLeft .k-notification,
.k-notification-list.is-bottomLeft .k-notification {
  --k-notification-from: translateX(-110%);
}
.k-notification-list.is-top .k-notification {
  --k-notification-from: translateY(-110%);
}
.k-notification-list.is-bottom .k-notification {
  --k-notification-from: translateY(110%);
}
/* 同 key 原位更新：只换内容，进场动画不重放 */
.k-notification-list .k-notification.is-static {
  animation: none;
}
@keyframes k-notification-in {
  from { opacity: 0; transform: var(--k-notification-from, translateX(110%)); }
  to { opacity: 1; transform: none; }
}

/* 退场：淡出 + 缩小，位置/高度由 layoutStacks 过渡补位 */
.k-notification.is-closing {
  pointer-events: none;
}
/* 列级悬停暂停：整列可暂停卡片的进度条同步冻结（CSS :hover 只管鼠标下那张，需提高优先级） */
.k-notification-list .k-notification.is-paused .k-notification__progress .k-notification__progress-bar {
  animation-play-state: paused;
}
</style>