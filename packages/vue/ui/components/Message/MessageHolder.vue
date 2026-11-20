<template>
  <Teleport to="body" defer>
    <TransitionGroup
      tag="div"
      name="k-message"
      :class="popupClasses"
      :data-k-theme="popupTheme"
      data-part="root"
      @before-leave="freezeLeaving"
      @leave-cancelled="releaseLeaving"
      @after-leave="releaseLeaving"
    >
      <div
        v-for="it in svc.items.value"
        :key="it.id"
        class="k-message"
        :class="[`k-message--${it.type}`, `k-message--${it.size}`, it.classNames?.root]"
        :style="it.styles?.root"
        data-part="item"
        :role="it.type === 'error' ? 'alert' : 'status'"
        aria-atomic="true"
      >
        <MessageCustom v-if="it.render" :item="it" :close="() => svc.remove(it)" />
        <template v-else>
        <span
          v-if="it.icon !== null"
          class="k-message__icon"
          :class="it.classNames?.icon"
          :style="it.styles?.icon"
          aria-hidden="true"
        >
          <svg v-if="it.type === 'loading'" class="k-message__spin" viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <circle cx="8" cy="8" r="6.2" stroke-dasharray="26 13" />
          </svg>
          <template v-else-if="it.icon">
            <component :is="KNode" :node="it.icon" />
          </template>
          <svg v-else viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" fill="currentColor" />
            <path
              :d="ICON_PATH[it.type]"
              fill="none"
              stroke="var(--k-message-bg)"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <span
          class="k-message__content"
          :class="it.classNames?.content"
          :style="it.styles?.content"
        ><component :is="KNode" :node="it.content" /></span>
        </template>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
import { defineComponent, onBeforeUnmount, watch } from 'vue';
import { KNode } from '../../utils/vnode';
import { usePopupHost } from '../../composables/usePopup';
import type { KMessageHolderItem, KMessageService } from './service';

defineOptions({ name: 'KMessageHolder' });

/** KApp 内部件：渲染 message 队列并管理自动关闭计时（随 Holder 卸载全部清理） */
const props = defineProps<{ svc: KMessageService }>();

/* 出口在 body：scopeClass/scheme 随节点走，否则 scoped Provider 下 token 断链（契约④） */
const { popupClasses, popupTheme } = usePopupHost(() => ['k-message-list']);

/** 自定义内容渲染：只替换图标+正文，外层 k-message（role/计时）仍由 Holder 提供 */
const MessageCustom = defineComponent({
  props: {
    item: { type: Object as () => KMessageHolderItem, required: true },
    close: { type: Function as () => () => void, required: true },
  },
  setup(p) {
    return () =>
      p.item.render?.({
        content: p.item.content,
        type: p.item.type,
        icon: p.item.icon,
        size: p.item.size,
        close: p.close,
      });
  },
});

const CIRCLE = 'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z';
const ICON_PATH: Record<string, string> = {
  info: `${CIRCLE}M8 7.3v3.8M8 4.9l.02 0`,
  success: `${CIRCLE}M5 8.2l2.1 2.1L11 6.1`,
  error: `${CIRCLE}M5.7 5.7l4.6 4.6M10.3 5.7l-4.6 4.6`,
  warning: `${CIRCLE}M8 4.8v4M8 11.1l.02 0`,
};

/** 离场条脱离文档流前钉住原位，剩余条目才能通过 FLIP 平滑补位 */
function freezeLeaving(el: Element) {
  const node = el as HTMLElement;
  const list = node.parentElement;
  const siblings = list
    ? ([...list.children].filter((child) => child !== node) as HTMLElement[])
    : [];
  const before = siblings.map((sib) => sib.getBoundingClientRect().top);
  const rect = node.getBoundingClientRect();
  node.style.top = `${node.offsetTop}px`;
  node.style.left = `${node.offsetLeft}px`;
  node.style.width = `${rect.width}px`;
  // 提前脱离文档流，剩余条目立即补位（FLIP）
  node.style.position = 'absolute';
  node.style.zIndex = '1';

  siblings.forEach((sib, i) => {
    const dy = before[i] - sib.getBoundingClientRect().top;
    if (Math.abs(dy) < 0.5) return;
    sib.style.transition = 'none';
    sib.style.transform = `translateY(${dy}px)`;
    sib.getBoundingClientRect();
    sib.style.transition = '';
    sib.style.transform = '';
  });
}

function releaseLeaving(el: Element) {
  const node = el as HTMLElement;
  node.style.top = '';
  node.style.left = '';
  node.style.width = '';
  node.style.position = '';
  node.style.zIndex = '';
}

const timers = new Map<number, ReturnType<typeof setTimeout>>();

function syncTimers() {
  const alive = new Set(props.svc.items.value.map((i) => i.id));
  for (const [id, t] of timers) {
    if (!alive.has(id)) {
      clearTimeout(t);
      timers.delete(id);
    }
  }
  for (const item of props.svc.items.value) {
    if (item.duration > 0 && !timers.has(item.id)) {
      timers.set(
        item.id,
        setTimeout(() => props.svc.remove(item), item.duration * 1000),
      );
    }
  }
}

watch(() => props.svc.items.value, syncTimers, { immediate: true, deep: false });
onBeforeUnmount(() => {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
});
</script>

<style>
.k-message-list {
  position: fixed;
  top: var(--k-size);
  left: 0;
  right: 0;
  z-index: var(--k-z-index-message);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--k-size-sm);
  pointer-events: none;
  font-family: inherit;
}

.k-message {
  --k-message-bg: var(--k-color-bg-elevated);
  --k-message-radius: var(--k-border-radius-lg);
  --k-message-pad: var(--k-size-sm) var(--k-size-md);
  --k-message-font-size: var(--k-font-size);
  --k-message-icon-size: calc(var(--k-font-size-lg) + 2px);
  --k-message-gap: calc(var(--k-size-xs) - 2px);

  display: inline-flex;
  align-items: center;
  gap: var(--k-message-gap);
  max-width: calc(100vw - var(--k-size) * 4);
  padding: var(--k-message-pad);
  border-radius: var(--k-message-radius);
  background-color: var(--k-message-bg);
  box-shadow: var(--k-box-shadow-secondary);
  color: var(--k-color-text);
  font-size: var(--k-message-font-size);
  line-height: var(--k-line-height);
  pointer-events: auto;
  transition: transform var(--k-motion-duration-mid) var(--k-motion-ease-out-cubic);
  animation: k-message-in var(--k-motion-duration-mid) var(--k-motion-ease-out-cubic);
}
.k-message--sm {
  --k-message-pad: var(--k-size-xs) var(--k-size);
  --k-message-font-size: var(--k-font-size-sm);
  --k-message-icon-size: var(--k-font-size-lg);
}
.k-message--lg {
  --k-message-pad: var(--k-size) var(--k-size-lg);
  --k-message-font-size: var(--k-font-size-lg);
  --k-message-icon-size: var(--k-font-size-xl);
  --k-message-gap: calc(var(--k-size-sm) - 2px);
}
.k-message__icon {
  flex: none;
  display: inline-flex;
  font-size: var(--k-message-icon-size);
}
.k-message--success .k-message__icon {
  color: var(--k-color-success);
}
.k-message--error .k-message__icon {
  color: var(--k-color-error);
}
.k-message--warning .k-message__icon {
  color: var(--k-color-warning);
}
.k-message--info .k-message__icon {
  color: var(--k-color-info);
}
.k-message__content {
  word-break: break-word;
}
.k-message__spin {
  animation: k-message-rotate var(--k-motion-duration-spin) linear infinite;
}
@keyframes k-message-rotate {
  to { transform: rotate(360deg); }
}
@keyframes k-message-in {
  from { opacity: 0; transform: translateY(calc(var(--k-size) * -1)); }
  to { opacity: 1; transform: none; }
}
/* 离场：淡出 + 轻微上移；剩余条目由 TransitionGroup move 平滑补位 */
.k-message-leave-active {
  position: absolute;
  z-index: 1;
  transition:
    opacity var(--k-motion-duration-fast) var(--k-motion-ease-in-cubic),
    transform var(--k-motion-duration-fast) var(--k-motion-ease-in-cubic);
}
.k-message-leave-to {
  opacity: 0;
  transform: translateY(calc(var(--k-size) * -0.5)) scale(0.96);
}
.k-message-move {
  transition: transform var(--k-motion-duration-mid) var(--k-motion-ease-out-cubic);
}

@media (max-width: 767px) {
  .k-message-list {
    top: calc(var(--k-size) + env(safe-area-inset-top, 0px));
  }
  .k-message {
    max-width: calc(100vw - 24px);
  }
}
</style>
