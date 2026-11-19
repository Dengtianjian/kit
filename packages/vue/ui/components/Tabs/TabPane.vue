<template>
  <div
    v-show="visible"
    data-part="root"
    class="k-tab-pane"
    :class="classNames?.root"
    :style="styles?.root"
    :id="ctx?.paneId"
    :role="ctx ? 'tabpanel' : undefined"
    :aria-labelledby="ctx?.tabId"
    :tabindex="ctx ? 0 : undefined"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import type { Component, CSSProperties, VNodeChild } from 'vue';
import { K_TAB_PANE_KEY } from './context';
import type { KTabPanePart } from './context';

defineOptions({ name: 'KTabPane' });

interface KTabPaneProps {
  /** 页签标题；Tabs 的 #label 插槽可整体覆盖标题渲染 */
  label?: VNodeChild;
  /** 唯一标识；缺省使用 vnode key（v-for 时）或序号 */
  name?: string | number;
  /** 标题左侧图标 */
  icon?: Component;
  disabled?: boolean;
  closable?: boolean;
  classNames?: Partial<Record<KTabPanePart, string>>;
  styles?: Partial<Record<KTabPanePart, CSSProperties>>;
}

withDefaults(defineProps<KTabPaneProps>(), {
  disabled: false,
  closable: false,
});

const ctx = inject(K_TAB_PANE_KEY, undefined);
const visible = computed(() => ctx?.active.value ?? true);

defineSlots<{
  default?(): VNodeChild;
}>();
</script>

<style>
.k-tab-pane {
  box-sizing: border-box;
  outline: none;
}
.k-tab-pane:focus-visible {
  outline: var(--k-control-outline-width) solid var(--k-control-outline);
  outline-offset: -2px;
}
</style>