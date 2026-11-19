<template>
  <nav
    data-part="root"
    class="k-breadcrumb"
    :class="[`k-breadcrumb--${size}`, classNames?.root]"
    :style="styles?.root"
    aria-label="面包屑"
  >
    <ol data-part="list" class="k-breadcrumb__list" :class="classNames?.list" :style="styles?.list">
      <template v-if="items?.length">
        <KBreadcrumbItem
          v-for="(item, index) in items"
          :key="item.key ?? index"
          :label="item.label"
          :to="item.to"
          :href="item.href"
          :external="item.external"
          :disabled="item.disabled"
          :separator="item.separator"
          :current="item.current ?? index === items.length - 1"
          :class-names="item.classNames"
          :styles="item.styles"
        />
      </template>
      <slot v-else />
    </ol>
  </nav>
</template>

<script setup lang="ts">
import { computed, provide } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import KBreadcrumbItem from './BreadcrumbItem.vue';
import { K_BREADCRUMB_KEY } from './context';
import type {
  KBreadcrumbItemOption,
  KBreadcrumbPart,
  KBreadcrumbSeparator,
  KBreadcrumbSize,
} from './context';

defineOptions({ name: 'KBreadcrumb' });

interface KBreadcrumbProps {
  /** items 数组用法；与默认插槽的 KBreadcrumbItem 二选一 */
  items?: KBreadcrumbItemOption[];
  /** 分隔符：字符串或图标组件；单项可用 separator 覆盖 */
  separator?: KBreadcrumbSeparator;
  size?: KBreadcrumbSize;
  classNames?: Partial<Record<KBreadcrumbPart, string>>;
  styles?: Partial<Record<KBreadcrumbPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KBreadcrumbProps>(), {
  separator: '/',
  size: 'md',
});

const size = computed(() => props.size);
const separator = computed(() => props.separator);

provide(K_BREADCRUMB_KEY, { separator, size });

defineSlots<{
  default?(): VNodeChild;
}>();
</script>

<style>
.k-breadcrumb {
  --k-breadcrumb-font-size: var(--k-font-size);
  --k-breadcrumb-gap: var(--k-size-xs);
  --k-breadcrumb-color: var(--k-color-text-secondary);

  box-sizing: border-box;
  color: var(--k-breadcrumb-color);
  font-size: var(--k-breadcrumb-font-size);
}
.k-breadcrumb--sm {
  --k-breadcrumb-font-size: var(--k-font-size-sm);
}
.k-breadcrumb--lg {
  --k-breadcrumb-font-size: var(--k-font-size-lg);
}
.k-breadcrumb__list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>