<template>
  <nav
    ref="rootEl"
    data-part="root"
    class="k-tabbar"
    :class="[
      {
        'is-fixed': fixed,
        'has-safe-area': safeArea,
      },
      classNames?.root,
    ]"
    :style="styles?.root"
    aria-label="底部导航"
    role="tablist"
  >
    <button
      v-for="(item, index) in items"
      :key="item.key"
      :ref="el => setItemEl(el, index)"
      type="button"
      role="tab"
      data-part="item"
      :disabled="item.disabled"
      :aria-disabled="item.disabled || undefined"
      :aria-selected="item.key === active ? 'true' : 'false'"
      :tabindex="item.key === active ? 0 : -1"
      :class="[
        'k-tabbar__item',
        {
          'is-active': item.key === active,
          'is-disabled': item.disabled,
        },
        classNames?.item,
        item.key === active ? classNames?.itemActive : undefined,
      ]"
      :style="[styles?.item, item.key === active ? styles?.itemActive : null]"
      @click="selectItem(item)"
      @keydown="onKeydown($event, index)"
    >
      <slot name="item" :item="item" :index="index" :active="item.key === active">
        <span v-if="item.icon" data-part="icon" class="k-tabbar__icon" :class="classNames?.icon" :style="styles?.icon" aria-hidden="true">
          <component :is="item.icon" />
        </span>
        <span data-part="label" class="k-tabbar__label" :class="classNames?.label" :style="styles?.label">
          <KNode :node="item.title ?? item.key" />
        </span>
        <span
          v-if="item.badge"
          data-part="badge"
          class="k-tabbar__badge"
          :class="[
            { 'is-dot': item.badge === true },
            classNames?.badge,
          ]"
          :style="styles?.badge"
        >
          {{ item.badge === true ? '' : item.badge }}
        </span>
      </slot>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import type { CSSProperties } from 'vue';
import { KNode } from '../../utils/vnode';
import type { KTabBarItem, KTabBarPart } from './types';

defineOptions({ name: 'KTabBar' });

interface KTabBarProps {
  items: KTabBarItem[];
  active?: string;
  fixed?: boolean;
  safeArea?: boolean;
  classNames?: Partial<Record<KTabBarPart, string>>;
  styles?: Partial<Record<KTabBarPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KTabBarProps>(), {
  items: () => [],
  active: undefined,
  fixed: true,
  safeArea: true,
});

const emit = defineEmits<{
  change: [key: string, item: KTabBarItem];
  'update:active': [key: string];
}>();

const itemEls: (HTMLElement | null)[] = [];
const innerActive = ref('');

const active = computed(() => {
  const value = props.active ?? innerActive.value;
  if (value && props.items.some(item => item.key === value && !item.disabled)) return value;
  return props.items.find(item => !item.disabled)?.key ?? '';
});

function setItemEl(el: unknown, index: number) {
  itemEls[index] = el as HTMLElement | null;
}

function selectItem(item: KTabBarItem) {
  if (item.disabled || item.key === active.value) return;
  if (props.active === undefined) innerActive.value = item.key;
  emit('update:active', item.key);
  emit('change', item.key, item);
}

function onKeydown(e: KeyboardEvent, index: number) {
  const horizontal = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
  if (!horizontal.includes(e.key)) return;
  e.preventDefault();
  const len = props.items.length;
  let next = index;
  if (e.key === 'ArrowLeft') next = (index - 1 + len) % len;
  else if (e.key === 'ArrowRight') next = (index + 1) % len;
  else if (e.key === 'Home') next = 0;
  else next = len - 1;
  for (let step = 0; step < len; step += 1) {
    const target = (next + step) % len;
    if (!props.items[target].disabled) {
      const item = props.items[target];
      selectItem(item);
      nextTick(() => itemEls[target]?.focus());
      return;
    }
  }
}

defineSlots<{
  item?(scope: { item: KTabBarItem; index: number; active: boolean }): unknown;
}>();
</script>

<style>
.k-tabbar {
  display: flex;
  align-items: stretch;
  box-sizing: border-box;
  width: 100%;
  border-top: var(--k-line-width) solid var(--k-color-border-secondary);
  background: var(--k-color-bg-container);
  color: var(--k-color-text-secondary);
}
.k-tabbar.is-fixed {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: var(--k-z-index-affix, 10);
}
.k-tabbar.has-safe-area {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.k-tabbar__item {
  position: relative;
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 0;
  height: var(--k-control-height-lg);
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-tabbar__item.is-active {
  color: var(--k-color-primary);
}
.k-tabbar__item.is-disabled {
  color: var(--k-color-text-quaternary);
  cursor: not-allowed;
}
.k-tabbar__item:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 var(--k-control-outline-width) var(--k-control-outline);
}
.k-tabbar__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  line-height: 1;
}
.k-tabbar__label {
  overflow: hidden;
  max-width: 100%;
  font-size: var(--k-font-size-sm);
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.k-tabbar__badge {
  position: absolute;
  top: 4px;
  inset-inline-start: calc(50% + 8px);
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--k-color-error);
  color: var(--k-color-text-light-solid);
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  box-sizing: border-box;
}
.k-tabbar__badge.is-dot {
  min-width: 8px;
  width: 8px;
  height: 8px;
  padding: 0;
  inset-inline-start: calc(50% + 8px);
}
</style>