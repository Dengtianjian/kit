<template>
  <Teleport to="body" defer>
    <div v-if="svc.items.value.length" :class="popupClasses" :data-k-theme="popupTheme" data-part="root">
      <div
        v-for="it in svc.items.value"
        :key="it.id"
        class="k-message"
        :class="[`k-message--${it.type}`, it.classNames?.root]"
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
          <svg v-else viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
            <path :d="ICON_PATH[it.type]" />
          </svg>
        </span>
        <span
          class="k-message__content"
          :class="it.classNames?.content"
          :style="it.styles?.content"
        ><component :is="KNode" :node="it.content" /></span>
        </template>
      </div>
    </div>
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
  gap: var(--k-size); /* 条间隔 8→16（用户反馈太挤） */
  pointer-events: none;
  font-family: inherit;
}

.k-message {
  --k-message-bg: var(--k-color-bg-elevated);
  --k-message-radius: var(--k-border-radius-lg);
  --k-message-pad: var(--k-size-sm) var(--k-size);

  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xs);
  max-width: calc(100vw - var(--k-size) * 4);
  padding: var(--k-message-pad);
  border-radius: var(--k-message-radius);
  background-color: var(--k-message-bg);
  box-shadow: var(--k-box-shadow-secondary);
  color: var(--k-color-text);
  font-size: var(--k-font-size);
  line-height: var(--k-line-height);
  pointer-events: auto;
  animation: k-message-in var(--k-motion-duration-mid) var(--k-motion-ease-out-cubic);
}
.k-message__icon {
  flex: none;
  display: inline-flex;
  font-size: var(--k-font-size);
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

@media (max-width: 767px) {
  .k-message-list {
    top: calc(var(--k-size) + env(safe-area-inset-top, 0px));
  }
  .k-message {
    max-width: calc(100vw - 24px);
  }
}
</style>
