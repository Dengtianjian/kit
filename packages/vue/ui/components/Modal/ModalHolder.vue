<template>
  <KModal
    v-for="it in svc.items.value"
    :key="it.id"
    :open="!it.closing"
    :title="it.props.title"
    :content="it.props.content"
    :icon="iconFor(it)"
    :width="it.props.width"
    :size="it.props.size"
    :mask="it.props.mask ?? true"
    :mask-closable="it.props.maskClosable ?? true"
    :keyboard="it.props.keyboard ?? true"
    :draggable="it.props.draggable ?? false"
    :placement="it.props.placement"
    :closable="true"
    :source="it.props.source"
    :class-names="{ root: `k-modal-holder is-${it.type}` }"
    @close="onClose(it)"
    @after-close="svc.remove(it)"
  />
</template>

<script setup lang="ts">
import { h } from 'vue';
import KModal from './Modal.vue';
import type { KModalHolderItem, KModalService } from './service';

defineOptions({ name: 'KModalHolder' });

/** KApp 内部件：渲染 createModalService() 的实例队列（不单独对外） */
const props = defineProps<{ svc: KModalService }>();

const CIRCLE = 'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z';
const ICON_PATH: Record<string, string> = {
  warning: `${CIRCLE}M8 4.8v4M8 11.1l.02 0`,
  info: `${CIRCLE}M8 7.3v3.8M8 4.9l.02 0`,
  success: `${CIRCLE}M5 8.2l2.1 2.1L11 6.1`,
  error: `${CIRCLE}M5.7 5.7l4.6 4.6M10.3 5.7l-4.6 4.6`,
};

function iconFor(item: KModalHolderItem) {
  if (item.props.icon === null) return undefined;
  if (item.props.icon !== undefined) return item.props.icon;
  const d = ICON_PATH[item.type];
  if (!d) return undefined;
  return h(
    'svg',
    {
      viewBox: '0 0 16 16',
      width: '1em',
      height: '1em',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.3',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
    },
    [h('path', { d })],
  );
}

function onClose(item: KModalHolderItem) {
  item.props.onClose?.();
  item.closing = true;
}
</script>

<style>
/* 类型图标着色（按 Holder 根类命中，KModal 结构不感知业务类型） */
.k-modal-holder.is-warning .k-modal__icon {
  color: var(--k-color-warning);
}
.k-modal-holder.is-info .k-modal__icon {
  color: var(--k-color-info);
}
.k-modal-holder.is-success .k-modal__icon {
  color: var(--k-color-success);
}
.k-modal-holder.is-error .k-modal__icon {
  color: var(--k-color-error);
}
</style>
