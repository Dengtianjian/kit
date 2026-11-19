<template>
  <div
    v-bind="rootAttrs"
    class="k-empty"
    :class="[`k-empty--${size}`, classNames?.root]"
    :style="styles?.root"
  >
    <div data-part="image" class="k-empty__image" :class="classNames?.image" :style="styles?.image">
      <slot name="image">
        <svg viewBox="0 0 64 48" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M8 40h48a2 2 0 0 0 2-2V12a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v26a2 2 0 0 0 2 2Z" />
          <path d="M6 34l14-12 10 8 9-7 19 13" />
          <circle cx="44" cy="19" r="3" />
        </svg>
      </slot>
    </div>
    <div data-part="description" class="k-empty__description" :class="classNames?.description" :style="styles?.description">
      <slot>{{ description }}</slot>
    </div>
    <div v-if="$slots.actions" data-part="actions" class="k-empty__actions" :class="classNames?.actions" :style="styles?.actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue';

defineOptions({ name: 'KEmpty' });

type EmptyPart = 'root' | 'image' | 'description' | 'actions';

interface KEmptyProps {
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  classNames?: Partial<Record<EmptyPart, string>>;
  styles?: Partial<Record<EmptyPart, CSSProperties>>;
}

withDefaults(defineProps<KEmptyProps>(), {
  description: '暂无数据',
  size: 'md',
});

const rootAttrs = { 'data-part': 'root' };
</script>

<style>
.k-empty {
  --k-empty-image-size: 64px;
  --k-empty-gap: var(--k-size-sm);

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--k-empty-gap);
  padding: var(--k-size-lg) var(--k-size);
  color: var(--k-color-text-secondary);
  text-align: center;
}
.k-empty__image {
  display: inline-flex;
  color: var(--k-color-text-quaternary);
  font-size: var(--k-empty-image-size);
  line-height: 1;
}
.k-empty__image svg {
  width: 1em;
  height: 1em;
  display: block;
}
.k-empty__description {
  font-size: var(--k-font-size);
}
.k-empty__actions {
  display: flex;
  align-items: center;
  gap: var(--k-size-sm);
}
.k-empty--sm {
  --k-empty-image-size: 44px;
  --k-empty-gap: var(--k-size-xs);
  padding: var(--k-size);
}
.k-empty--lg {
  --k-empty-image-size: 88px;
  --k-empty-gap: var(--k-size);
  padding: var(--k-size-xl) var(--k-size);
}
</style>