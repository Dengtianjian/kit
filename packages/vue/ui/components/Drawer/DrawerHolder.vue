<template>
  <KDrawer
    v-for="item in svc.items.value"
    :key="item.id"
    :open="!item.closing"
    :title="item.props.title"
    :content="item.props.content"
    :footer="item.props.footer"
    :placement="item.props.placement"
    :size="item.props.size"
    :width="item.props.width"
    :height="item.props.height"
    :closable="item.props.closable ?? true"
    :mask="item.props.mask ?? true"
    :mask-closable="item.props.maskClosable ?? true"
    :keyboard="item.props.keyboard ?? true"
    :class-names="item.props.classNames"
    :styles="item.props.styles"
    @close="onClose(item)"
    @after-close="svc.remove(item)"
  />
</template>

<script setup lang="ts">
import KDrawer from './Drawer.vue';
import type { KDrawerHolderItem, KDrawerService } from './service';

defineOptions({ name: 'KDrawerHolder' });

const props = defineProps<{ svc: KDrawerService }>();

function onClose(item: KDrawerHolderItem) {
  item.props.onClose?.();
  item.closing = true;
}
</script>