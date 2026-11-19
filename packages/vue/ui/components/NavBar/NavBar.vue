<template>
  <header
    data-part="root"
    class="k-navbar"
    :class="[
      {
        'is-fixed': fixed,
        'has-safe-area': safeArea,
      },
      classNames?.root,
    ]"
    :style="styles?.root"
  >
    <div data-part="left" class="k-navbar__left" :class="classNames?.left" :style="styles?.left">
      <button
        v-if="back"
        type="button"
        data-part="back"
        class="k-navbar__back"
        :class="classNames?.back"
        :style="styles?.back"
        aria-label="返回"
        @click="onBack"
      >
        <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M10 3.5 5.5 8 10 12.5" />
        </svg>
      </button>
      <slot name="left" />
    </div>
    <div data-part="center" class="k-navbar__center" :class="classNames?.center" :style="styles?.center">
      <div data-part="title" class="k-navbar__title" :class="classNames?.title" :style="styles?.title">
        <slot name="title">{{ title }}</slot>
      </div>
      <div
        v-if="subtitle || $slots.subtitle"
        data-part="subtitle"
        class="k-navbar__subtitle"
        :class="classNames?.subtitle"
        :style="styles?.subtitle"
      >
        <slot name="subtitle">{{ subtitle }}</slot>
      </div>
    </div>
    <div data-part="right" class="k-navbar__right" :class="classNames?.right" :style="styles?.right">
      <slot name="right" />
    </div>
  </header>
</template>

<script setup lang="ts">
import type { CSSProperties, VNodeChild } from 'vue';
import type { KNavBarPart } from './types';

defineOptions({ name: 'KNavBar' });

interface KNavBarProps {
  title?: string;
  subtitle?: string;
  /** 显示返回按钮 */
  back?: boolean;
  /** 固定在视口顶部 */
  fixed?: boolean;
  /** 顶部安全区（刘海屏） */
  safeArea?: boolean;
  classNames?: Partial<Record<KNavBarPart, string>>;
  styles?: Partial<Record<KNavBarPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KNavBarProps>(), {
  back: true,
  fixed: false,
  safeArea: true,
});

const emit = defineEmits<{ back: [event: MouseEvent] }>();

function onBack(e: MouseEvent) {
  emit('back', e);
}

defineSlots<{
  left?(): VNodeChild;
  title?(): VNodeChild;
  subtitle?(): VNodeChild;
  right?(): VNodeChild;
}>();
</script>

<style>
.k-navbar {
  --k-navbar-height: 44px;

  position: relative;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  min-height: var(--k-navbar-height);
  padding-inline: var(--k-size-sm);
  border-bottom: var(--k-line-width) solid var(--k-color-border-secondary);
  background: var(--k-color-bg-container);
  color: var(--k-color-text);
}
.k-navbar.is-fixed {
  position: fixed;
  inset-inline: 0;
  top: 0;
  z-index: var(--k-z-index-affix, 10);
}
.k-navbar.has-safe-area {
  padding-top: env(safe-area-inset-top, 0px);
}
.k-navbar__left,
.k-navbar__right {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--k-size-xxs);
  min-width: var(--k-control-height-sm);
}
.k-navbar__right {
  justify-content: flex-end;
}
.k-navbar__center {
  flex: 0 1 auto;
  min-width: 0;
  text-align: center;
}
.k-navbar__title {
  overflow: hidden;
  font-size: var(--k-font-size-lg);
  font-weight: var(--k-font-weight-strong);
  line-height: var(--k-line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.k-navbar__subtitle {
  overflow: hidden;
  margin-top: 2px;
  color: var(--k-color-text-tertiary);
  font-size: var(--k-font-size-sm);
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.k-navbar__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--k-control-height-sm);
  height: var(--k-control-height-sm);
  padding: 0;
  border: 0;
  border-radius: var(--k-border-radius-sm);
  background: transparent;
  color: var(--k-color-text);
  font-size: var(--k-font-size-lg);
  cursor: pointer;
}
.k-navbar__back:hover {
  background: var(--k-color-fill-secondary);
}
.k-navbar__back:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 var(--k-control-outline-width) var(--k-control-outline);
}
</style>