<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { CSSProperties } from 'vue';
import KNotification from './Notification.vue';
import { usePopupHost } from '../../composables/usePopup';
import type { KNotificationHolderItem, KNotificationPlacement, KNotificationService } from './service';

defineOptions({ name: 'KNotificationHolder' });

/** KApp 内部件：notification 队列按 placement 分列渲染（滚动容器）+ 自动关闭计时/悬停暂停/退场塌陷 */
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

/* ---- 溢出检测：超高列切 is-scrollable（恢复交互 + 显细滚动条），未溢出列保持 pointer-events:none 不挡背后页面 ---- */
const listEls = new Map<KNotificationPlacement, HTMLElement>();
const scrollable = ref<Set<KNotificationPlacement>>(new Set());

function setListEl(placement: KNotificationPlacement, el: unknown) {
  if (el instanceof HTMLElement) listEls.set(placement, el);
  else listEls.delete(placement);
}
function syncScrollable() {
  const next = new Set<KNotificationPlacement>();
  for (const [p, el] of listEls) if (el.scrollHeight > el.clientHeight + 1) next.add(p);
  scrollable.value = next;
}
watch([() => props.svc.items.value, () => props.svc.global.value], () => nextTick(syncScrollable));
onMounted(() => {
  syncScrollable();
  window.addEventListener('resize', syncScrollable);
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
watch(() => props.svc.items.value, syncTimers, { immediate: true });

function pauseTimer(item: KNotificationHolderItem) {
  const e = timers.get(item.id);
  if (!e || e.paused || !e.handle) return;
  clearTimeout(e.handle);
  e.handle = null;
  e.remaining -= Date.now() - e.startedAt;
  e.paused = true;
}
function resumeTimer(item: KNotificationHolderItem) {
  const e = timers.get(item.id);
  if (!e || !e.paused || e.remaining <= 0) return;
  arm(item.id, e);
}
function onEnter(item: KNotificationHolderItem) {
  if (item.pauseOnHover && item.duration !== false) pauseTimer(item);
}
function onLeave(item: KNotificationHolderItem) {
  if (item.pauseOnHover && item.duration !== false) resumeTimer(item);
}

/* ---- 退场：锁定当前高度 → is-closing 塌陷（height/margin/padding → 0）→ 移除 ---- */
const closing = ref<Set<number>>(new Set());
const els = new Map<number, HTMLElement>();
const closeBackstops = new Map<number, ReturnType<typeof setTimeout>>();

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
  const el = els.get(item.id);
  if (el) el.style.height = `${el.offsetHeight}px`;
  closing.value = new Set(closing.value).add(item.id);
  // 塌陷过渡依赖 height 过渡；主题若关掉动画则收不到 transitionend，兜底定时移除
  closeBackstops.set(
    item.id,
    setTimeout(() => finishClose(item.id), 320),
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
function onTransitionEnd(item: KNotificationHolderItem, e: TransitionEvent) {
  if (e.propertyName === 'height' && closing.value.has(item.id)) finishClose(item.id);
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncScrollable);
  for (const e of timers.values()) if (e.handle) clearTimeout(e.handle);
  timers.clear();
  for (const t of closeBackstops.values()) clearTimeout(t);
  closeBackstops.clear();
});
</script>

<template>
  <Teleport to="body" defer>
    <div
      v-for="col in columns"
      :key="col.placement"
      :ref="(el) => setListEl(col.placement, el)"
      :class="[popupClasses, `is-${col.placement}`, scrollable.has(col.placement) ? 'is-scrollable' : '']"
      :data-k-theme="popupTheme"
      :style="listStyle(col.placement)"
      data-part="list"
    >
      <KNotification
        v-for="it in col.list"
        :key="it.id"
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
        :pause-on-hover="it.pauseOnHover"
        :role="it.config.role"
        :class-names="it.config.classNames"
        :styles="it.config.styles"
        :class="[it.updated ? 'is-static' : '', closing.has(it.id) ? 'is-closing' : '']"
        @close="requestClose(it)"
        @click="it.config.onClick?.($event)"
        @mouseenter="onEnter(it)"
        @mouseleave="onLeave(it)"
        @transitionend="onTransitionEnd(it, $event)"
      />
    </div>
  </Teleport>
</template>

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

/* 退场：antd 高度塌陷语义——本条收拢，后续项平滑补位（JS 先锁定 inline height） */
.k-notification.is-closing {
  height: 0 !important;
  opacity: 0;
  margin-top: 0 !important;
  margin-bottom: 0 !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  overflow: hidden;
  transition:
    height var(--k-motion-duration-mid) var(--k-motion-ease-in-cubic),
    opacity var(--k-motion-duration-fast) linear,
    margin var(--k-motion-duration-mid) var(--k-motion-ease-in-cubic),
    padding var(--k-motion-duration-mid) var(--k-motion-ease-in-cubic);
}
</style>
