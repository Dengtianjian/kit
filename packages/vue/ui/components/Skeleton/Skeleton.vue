<template>
  <slot v-if="!showSkeleton" />
  <div
    v-else
    v-bind="rootAttrs"
    class="k-skeleton"
    :class="[classNames?.root, { 'is-active': active, 'is-round': round }]"
    :style="styles?.root"
    :aria-busy="loading || undefined"
  >
    <span
      v-if="avatar"
      data-part="avatar"
      class="k-skeleton__avatar"
      :class="[
        `k-skeleton__avatar--${avatarConfig.shape}`,
        `k-skeleton__avatar--${avatarConfig.size}`,
        classNames?.avatar,
      ]"
      :style="styles?.avatar"
      aria-hidden="true"
    />
    <div class="k-skeleton__content">
      <div
        v-if="title"
        data-part="title"
        class="k-skeleton__title"
        :class="classNames?.title"
        :style="styles?.title"
        aria-hidden="true"
      />
      <div v-if="paragraph" data-part="paragraph" class="k-skeleton__paragraph" :class="classNames?.paragraph" :style="styles?.paragraph">
        <div
          v-for="(width, index) in paragraphWidths"
          :key="index"
          class="k-skeleton__row"
          :class="classNames?.row"
          :style="[width ? { width } : null, styles?.row]"
          aria-hidden="true"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import type { CSSProperties } from 'vue';

defineOptions({ name: 'KSkeleton' });

type SkeletonPart = 'root' | 'avatar' | 'title' | 'paragraph' | 'row';
type SkeletonLine = number | string;
export interface KSkeletonAvatarOptions {
  size?: 'sm' | 'md' | 'lg';
  shape?: 'circle' | 'square';
}
export interface KSkeletonParagraphOptions {
  rows?: number;
  width?: SkeletonLine | SkeletonLine[];
}

interface KSkeletonProps {
  /** 有默认插槽时：true 显示骨架，false 显示内容；无插槽时始终显示骨架 */
  loading?: boolean;
  active?: boolean;
  round?: boolean;
  avatar?: boolean | KSkeletonAvatarOptions;
  title?: boolean;
  paragraph?: boolean | KSkeletonParagraphOptions;
  classNames?: Partial<Record<SkeletonPart, string>>;
  styles?: Partial<Record<SkeletonPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KSkeletonProps>(), {
  loading: false,
  active: false,
  round: false,
  avatar: false,
  title: true,
  paragraph: true,
});

const slots = useSlots();
const rootAttrs = { 'data-part': 'root' };
const showSkeleton = computed(() => props.loading || !slots.default);

const avatarConfig = computed<Required<KSkeletonAvatarOptions>>(() =>
  typeof props.avatar === 'object'
    ? { size: props.avatar.size ?? 'md', shape: props.avatar.shape ?? 'circle' }
    : { size: 'md', shape: 'circle' },
);

const paragraphWidths = computed<SkeletonLine[]>(() => {
  const paragraph = props.paragraph;
  if (!paragraph) return [];
  if (paragraph === true) return ['100%', '100%', '80%'];
  const rows = Math.max(1, paragraph.rows ?? 3);
  const width = paragraph.width;
  if (Array.isArray(width)) {
    return Array.from({ length: rows }, (_, i) => width[i] ?? width[width.length - 1] ?? '100%');
  }
  return Array.from({ length: rows }, (_, i) => (i === rows - 1 ? (width ?? '80%') : '100%'));
});

defineSlots<{
  /** loading=false 时显示的内容 */
  default?(): unknown;
}>();
</script>

<style>
.k-skeleton {
  --k-skeleton-bg: var(--k-color-fill-tertiary);
  --k-skeleton-radius: var(--k-border-radius-sm);

  display: flex;
  align-items: flex-start;
  gap: var(--k-size);
  width: 100%;
}
.k-skeleton__avatar {
  flex: none;
  width: 32px;
  height: 32px;
  background: var(--k-skeleton-bg);
}
.k-skeleton__avatar--sm {
  width: 24px;
  height: 24px;
}
.k-skeleton__avatar--lg {
  width: 40px;
  height: 40px;
}
.k-skeleton__avatar--circle {
  border-radius: 50%;
}
.k-skeleton__avatar--square {
  border-radius: var(--k-skeleton-radius);
}
.k-skeleton__content {
  flex: auto;
  min-width: 0;
  padding-top: 2px;
}
.k-skeleton__title,
.k-skeleton__row {
  height: 14px;
  background: var(--k-skeleton-bg);
  border-radius: var(--k-skeleton-radius);
}
.k-skeleton__title {
  width: 38%;
  margin-bottom: 12px;
}
.k-skeleton__paragraph {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.k-skeleton__row {
  width: 100%;
  height: 12px;
}
.k-skeleton.is-round .k-skeleton__title,
.k-skeleton.is-round .k-skeleton__row {
  border-radius: 999px;
}
.k-skeleton.is-active .k-skeleton__avatar,
.k-skeleton.is-active .k-skeleton__title,
.k-skeleton.is-active .k-skeleton__row {
  background: linear-gradient(
    100deg,
    var(--k-color-fill-tertiary) 30%,
    var(--k-color-fill-secondary) 50%,
    var(--k-color-fill-tertiary) 70%
  );
  background-size: 220% 100%;
  animation: k-skeleton-shimmer 1.2s ease-in-out infinite;
}
@keyframes k-skeleton-shimmer {
  from { background-position: 120% 0; }
  to { background-position: -20% 0; }
}
</style>