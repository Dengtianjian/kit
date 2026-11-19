<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <aside
    v-else
    data-part="root"
    :class="[
      'k-layout-sider',
      {
        'is-collapsed': collapsed,
        'is-collapsible': collapsible,
      },
      classNames?.root,
    ]"
    :style="rootStyle"
  >
    <template v-if="collapsible">
      <div data-part="content" class="k-layout-sider__content">
        <slot />
      </div>
      <div
        v-if="trigger"
        data-part="trigger"
        class="k-layout-sider__trigger"
        :class="classNames?.trigger"
        :style="styles?.trigger"
      >
        <slot name="trigger" :collapsed="collapsed" :toggle="toggle">
          <button
            type="button"
            class="k-layout-sider__trigger-btn"
            :aria-label="collapsed ? '展开侧边栏' : '收起侧边栏'"
            :aria-expanded="!collapsed"
            @click="toggle"
          >
            <svg
              viewBox="0 0 16 16"
              width="1em"
              height="1em"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path :d="collapsed ? 'M6 3.5 10.5 8 6 12.5' : 'M10 3.5 5.5 8 10 12.5'" />
            </svg>
          </button>
        </slot>
      </div>
    </template>
    <slot v-else />
  </aside>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, provide, ref, useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { useResponsiveValue } from '../../composables/useResponsiveValue';
import type { KResponsiveValue, KResponsiveMap } from '../../composables/useResponsiveValue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';
import { K_SIDER_KEY } from './context';

defineOptions({ name: 'KLayoutSider' });

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KLayoutSiderRenderScope {
  width: number | undefined;
  collapsed: boolean;
  collapsible: boolean;
  /** data-part + 宽度变量 style（显式传值才注入）；其余视觉自绘 */
  rootAttrs: Record<string, unknown>;
  toggle: () => void;
  slots: ReturnType<typeof useSlots>;
}

interface KLayoutSiderProps {
  /** 默认 208 = 16×13 模度；对象/字符串按断点取值（如 `'xs:160 md:208'`） */
  width?: number | KResponsiveMap<number> | string;
  /** 可折叠：渲染折叠触发器，并向内部 KMenu 提供折叠态 */
  collapsible?: boolean;
  /** 受控折叠态；不传则由组件自管 / defaultCollapsed 初始化 */
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  /** 折叠宽度 */
  collapsedWidth?: number | string;
  /** 是否显示触发器（collapsible 时生效） */
  trigger?: boolean;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KLayoutSiderRenderScope>;
  classNames?: { root?: string; trigger?: string };
  styles?: { root?: CSSProperties; trigger?: CSSProperties };
}

const props = withDefaults(defineProps<KLayoutSiderProps>(), {
  collapsible: false,
  collapsed: undefined,
  defaultCollapsed: false,
  collapsedWidth: 64,
  trigger: true,
});

const emit = defineEmits<{
  collapse: [collapsed: boolean];
  'update:collapsed': [collapsed: boolean];
}>();

const instance = getCurrentInstance()!;
const controlled = computed(() => 'collapsed' in (instance.vnode.props ?? {}));
const innerCollapsed = ref(props.defaultCollapsed);
const collapsed = computed(() =>
  controlled.value ? Boolean(props.collapsed) : innerCollapsed.value,
);

function setCollapsed(value: boolean) {
  if (!props.collapsible) return;
  if (value === collapsed.value) return;
  if (!controlled.value) innerCollapsed.value = value;
  emit('update:collapsed', value);
  emit('collapse', value);
}

function toggle() {
  setCollapsed(!collapsed.value);
}

provide(K_SIDER_KEY, { collapsed, toggle });

const resolvedWidth = useResponsiveValue<number>(
  () => props.width as KResponsiveValue<number> | undefined,
  { coerce: Number },
);

/** 仅在显式传值时落内联，否则让 createTheme 组件令牌与 CSS 缺省依次生效 */
const varStyle = computed<CSSProperties>(() => {
  const style: CSSProperties = {};
  if (resolvedWidth.value !== undefined) {
    style['--k-layout-sider-width'] = `${resolvedWidth.value}px`;
  }
  if (props.collapsedWidth !== undefined) {
    style['--k-layout-sider-collapsed-width'] =
      typeof props.collapsedWidth === 'number' ? `${props.collapsedWidth}px` : props.collapsedWidth;
  }
  return style;
});

const rootStyle = computed<CSSProperties>(() => ({ ...varStyle.value, ...props.styles?.root }));

const slots = useSlots();
const rootAttrs = computed(() => ({ 'data-part': 'root', style: varStyle.value }));

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KLayoutSiderRenderScope>(
  () => props.render,
  () => ({
    width: resolvedWidth.value,
    collapsed: collapsed.value,
    collapsible: props.collapsible,
    rootAttrs: rootAttrs.value,
    toggle,
    slots,
  }),
);

defineSlots<{
  default?(): VNodeChild;
  trigger?(scope: { collapsed: boolean; toggle: () => void }): VNodeChild;
  render?(scope: KLayoutSiderRenderScope): VNodeChild;
}>();
</script>

<style>

.k-layout-sider {
  flex: none;
  width: var(--k-layout-sider-width, 208px);
  box-sizing: border-box;
  background: var(--k-color-bg-container);
  overflow: auto;
}
.k-layout-sider.is-collapsible {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width var(--k-motion-duration-mid) var(--k-motion-ease-in-out-cubic);
}
.k-layout-sider.is-collapsed {
  width: var(--k-layout-sider-collapsed-width, 64px);
}
.k-layout-sider__content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  overflow-x: hidden;
}
.k-layout-sider__trigger {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: var(--k-line-width) solid var(--k-color-border-secondary);
  background: var(--k-color-bg-container);
}
.k-layout-sider__trigger-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: var(--k-control-height-lg);
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--k-color-text-secondary);
  font-size: var(--k-font-size);
  cursor: pointer;
  transition: background var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-layout-sider__trigger-btn:hover {
  background: var(--k-color-fill-secondary);
  color: var(--k-color-text);
}
.k-layout-sider__trigger-btn:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 var(--k-control-outline-width) var(--k-control-outline);
}
@media (prefers-reduced-motion: reduce) {
  .k-layout-sider.is-collapsible {
    transition: none;
  }
}
</style>
