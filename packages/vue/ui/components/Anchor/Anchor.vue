<template>
  <nav
    data-part="root"
    class="k-anchor"
    :class="[
      `k-anchor--${direction}`,
      {
        'is-affix': affix,
      },
      classNames?.root,
    ]"
    :style="[affixStyle, styles?.root]"
    :aria-label="anchorLabel"
  >
    <ul data-part="list" class="k-anchor__list" :class="classNames?.list" :style="styles?.list">
      <li
        v-for="entry in flatItems"
        :key="entry.item.key"
        data-part="item"
        class="k-anchor__item"
        :class="[
          {
            'is-active': isEntryActive(entry),
            'is-current': entry.item.key === activeKey,
          },
          classNames?.item,
        ]"
        :style="[indentStyle(entry.level), styles?.item]"
      >
        <a
          :href="entry.item.href"
          data-part="link"
          class="k-anchor__link"
          :class="classNames?.link"
          :style="styles?.link"
          :aria-current="entry.item.key === activeKey ? 'location' : undefined"
          @click="onLinkClick($event, entry.item)"
        >
          <slot name="link" :item="entry.item" :active="isEntryActive(entry)" :level="entry.level">
            <KNode :node="entry.item.title ?? entry.item.key" />
          </slot>
        </a>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { KNode } from '../../utils/vnode';
import {
  addScrollListener,
  getScrollTop,
  getScrollViewport,
  resolveScrollTarget,
  scrollToY,
} from '../../utils/scroll';
import type { KScrollTarget } from '../../utils/scroll';
import type { KAnchorDirection, KAnchorItem, KAnchorPart } from './types';

defineOptions({ name: 'KAnchor' });

interface KAnchorProps {
  items: KAnchorItem[];
  /** 滚动容器；缺省 window */
  target?: KScrollTarget;
  /** 点击跳转与高亮判定的偏移量 */
  targetOffset?: number;
  /** 高亮判定的额外余量 */
  bounds?: number;
  direction?: KAnchorDirection;
  /** 贴顶（position: sticky） */
  affix?: boolean;
  affixOffsetTop?: number;
  anchorLabel?: string;
  classNames?: Partial<Record<KAnchorPart, string>>;
  styles?: Partial<Record<KAnchorPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KAnchorProps>(), {
  items: () => [],
  target: undefined,
  targetOffset: 0,
  bounds: 5,
  direction: 'vertical',
  affix: false,
  affixOffsetTop: 0,
  anchorLabel: '锚点导航',
});

const emit = defineEmits<{ change: [key: string, item: KAnchorItem] }>();

interface FlatEntry {
  item: KAnchorItem;
  level: number;
  parents: string[];
}

const activeKey = ref('');
const lockedKey = ref('');
let lockTimer: ReturnType<typeof setTimeout> | null = null;
let detachScroll: (() => void) | null = null;

const flatItems = computed<FlatEntry[]>(() => {
  const out: FlatEntry[] = [];
  const walk = (items: KAnchorItem[], level: number, parents: string[]) => {
    for (const item of items) {
      out.push({ item, level, parents });
      if (item.children?.length) walk(item.children, level + 1, [...parents, item.key]);
    }
  };
  walk(props.items, 0, []);
  return out;
});

const activePath = computed(() => {
  const path = new Set<string>();
  const walk = (items: KAnchorItem[], parents: string[]): boolean => {
    for (const item of items) {
      if (item.key === activeKey.value) {
        for (const key of [...parents, item.key]) path.add(key);
        return true;
      }
      if (item.children?.length && walk(item.children, [...parents, item.key])) return true;
    }
    return false;
  };
  walk(props.items, []);
  return path;
});

const affixStyle = computed<CSSProperties>(() =>
  props.affix ? { top: `${props.affixOffsetTop}px` } : {},
);

function indentStyle(level: number): CSSProperties {
  return { '--k-anchor-indent': `${level * 12}px` } as CSSProperties;
}

function isEntryActive(entry: FlatEntry): boolean {
  return entry.item.key === activeKey.value || activePath.value.has(entry.item.key);
}

function targetElement(href: string): HTMLElement | null {
  if (!href.startsWith('#')) return null;
  return document.getElementById(decodeURIComponent(href.slice(1)));
}

function itemOfKey(key: string): KAnchorItem | undefined {
  return flatItems.value.find(entry => entry.item.key === key)?.item;
}

function setActive(key: string) {
  if (key === activeKey.value) return;
  activeKey.value = key;
  const item = itemOfKey(key);
  if (item) emit('change', key, item);
}

function scheduleUnlock() {
  if (lockTimer) clearTimeout(lockTimer);
  lockTimer = setTimeout(() => {
    lockedKey.value = '';
    lockTimer = null;
  }, 120);
}

function updateActive() {
  if (!flatItems.value.length) return;
  if (lockedKey.value) {
    setActive(lockedKey.value);
    scheduleUnlock();
    return;
  }
  const target = resolveScrollTarget(props.target);
  const viewport = getScrollViewport(target);
  const threshold = viewport.top + props.targetOffset + props.bounds;
  let next = flatItems.value[0].item.key;

  for (const entry of flatItems.value) {
    const el = targetElement(entry.item.href);
    if (!el) continue;
    if (el.getBoundingClientRect().top <= threshold) next = entry.item.key;
  }

  const scrollTop = getScrollTop(target);
  const maxScroll = target === window
    ? document.documentElement.scrollHeight - window.innerHeight
    : target.scrollHeight - target.clientHeight;
  if (maxScroll > 0 && scrollTop >= maxScroll - 1) {
    next = flatItems.value[flatItems.value.length - 1].item.key;
  }
  setActive(next);
}

function onLinkClick(e: MouseEvent, item: KAnchorItem) {
  e.preventDefault();
  const el = targetElement(item.href);
  if (!el) return;
  const target = resolveScrollTarget(props.target);
  const viewport = getScrollViewport(target);
  const scrollTop = getScrollTop(target);
  const top = el.getBoundingClientRect().top - viewport.top + scrollTop - props.targetOffset;
  lockedKey.value = item.key;
  scrollToY(target, Math.max(0, top));
  setActive(item.key);
  scheduleUnlock();
  try {
    history.replaceState(null, '', item.href);
  } catch {
    // 无 history 环境忽略
  }
}

function attach() {
  detachScroll?.();
  detachScroll = addScrollListener(resolveScrollTarget(props.target), updateActive);
  window.addEventListener('resize', updateActive);
}

onMounted(async () => {
  await nextTick();
  attach();
  const hash = window.location.hash;
  const match = flatItems.value.find(entry => entry.item.href === hash);
  if (match) activeKey.value = match.item.key;
  updateActive();
});

onBeforeUnmount(() => {
  detachScroll?.();
  detachScroll = null;
  window.removeEventListener('resize', updateActive);
  if (lockTimer) clearTimeout(lockTimer);
});

watch(
  () => props.items,
  async () => {
    await nextTick();
    lockedKey.value = '';
    detachScroll?.();
    detachScroll = addScrollListener(resolveScrollTarget(props.target), updateActive);
    updateActive();
  },
  { deep: true },
);

defineSlots<{
  link?(scope: { item: KAnchorItem; active: boolean; level: number }): VNodeChild;
}>();
</script>

<style>
.k-anchor {
  box-sizing: border-box;
  color: var(--k-color-text-secondary);
  font-size: var(--k-font-size-sm);
}
.k-anchor.is-affix {
  position: sticky;
  z-index: var(--k-z-index-affix, 10);
}
.k-anchor__list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.k-anchor--horizontal .k-anchor__list {
  display: flex;
  align-items: center;
  gap: var(--k-size-sm);
  border-block-end: var(--k-line-width) solid var(--k-color-border-secondary);
}
.k-anchor__item {
  list-style: none;
}
.k-anchor__link {
  display: block;
  box-sizing: border-box;
  padding: var(--k-size-xxs) var(--k-size-sm);
  padding-inline-start: calc(var(--k-size-sm) + var(--k-anchor-indent, 0px));
  border-inline-start: 2px solid transparent;
  color: var(--k-color-text-secondary);
  line-height: var(--k-line-height);
  text-decoration: none;
  transition:
    color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    border-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-anchor__link:hover {
  color: var(--k-color-text);
}
.k-anchor__link:focus-visible {
  outline: none;
  border-radius: var(--k-border-radius-sm);
  box-shadow: inset 0 0 0 var(--k-control-outline-width) var(--k-control-outline);
}
.k-anchor--horizontal .k-anchor__link {
  padding-inline: var(--k-size-sm);
  border-inline-start: 0;
  border-block-end: 2px solid transparent;
}
.k-anchor__item.is-active > .k-anchor__link {
  color: var(--k-color-primary);
  border-inline-start-color: var(--k-color-primary);
}
.k-anchor--horizontal .k-anchor__item.is-active > .k-anchor__link {
  border-inline-start-color: transparent;
  border-block-end-color: var(--k-color-primary);
}
</style>