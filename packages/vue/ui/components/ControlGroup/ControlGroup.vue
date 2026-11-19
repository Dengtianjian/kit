<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <div
    v-else
    v-bind="rootAttrs"
    class="k-control-group"
    :class="[{ 'is-vertical': vertical, 'is-block': block }, classNames?.root]"
    :style="styles?.root"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KControlGroup' });

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KControlGroupRenderScope {
  vertical: boolean;
  block: boolean;
  /** data-part + 方向/通栏类（布局逻辑）；边框拼接等视觉自绘 */
  rootAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KControlGroupProps {
  /** 纵向拼接连成一组（默认横向） */
  vertical?: boolean;
  /** 通栏：宽度 100%，子项按比例拉伸填满 */
  block?: boolean;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KControlGroupRenderScope>;
  classNames?: { root?: string };
  styles?: { root?: CSSProperties };
}

const props = withDefaults(defineProps<KControlGroupProps>(), {
  vertical: false,
  block: false,
});

const slots = useSlots();

const rootAttrs = computed(() => ({
  'data-part': 'root',
  'data-vertical': props.vertical ? 'true' : undefined,
  'data-block': props.block ? 'true' : undefined,
}));

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KControlGroupRenderScope>(
  () => props.render,
  () => ({
    vertical: props.vertical,
    block: props.block,
    rootAttrs: rootAttrs.value,
    slots,
  }),
);

defineSlots<{
  default?(): VNodeChild;
  render?(scope: KControlGroupRenderScope): VNodeChild;
}>();
</script>

<style>
.k-control-group {
  display: inline-flex;
  align-items: stretch;
  max-width: 100%;
  vertical-align: middle;
}
.k-control-group > * {
  position: relative;
  min-width: 0;
}
.k-control-group.is-block {
  display: flex;
  width: 100%;
}
.k-control-group:not(.is-block) > .k-radio-group,
.k-control-group:not(.is-block) > .k-input-number,
.k-control-group:not(.is-block) > .k-select,
.k-control-group:not(.is-block) > .k-button {
  flex: none; /* 不被压扁：RadioGroup 会挤成两行，按钮会缩成窄条 */
}
.k-control-group.is-block > * {
  flex: 1 1 0;
  width: auto;
  min-width: 0;
}
.k-control-group.is-vertical {
  flex-direction: column;
  align-items: stretch;
}
.k-control-group.is-vertical > * {
  width: 100%;
}

/* 横向拼接：相邻项压 1px 边框，首尾保留圆角、中间直角 */
.k-control-group:not(.is-vertical) > * + * {
  margin-inline-start: calc(var(--k-line-width) * -1);
}
/* 双类名提权：覆盖子组件自身的 border-radius 变量声明 */
.k-control-group.k-control-group:not(.is-vertical) > :not(:first-child) {
  border-start-start-radius: 0;
  border-end-start-radius: 0;
}
.k-control-group.k-control-group:not(.is-vertical) > :not(:last-child) {
  border-start-end-radius: 0;
  border-end-end-radius: 0;
}
/* 纵向拼接：上下压边，首尾保留圆角 */
.k-control-group.is-vertical > * + * {
  margin-block-start: calc(var(--k-line-width) * -1);
}
.k-control-group.k-control-group.is-vertical > :not(:first-child) {
  border-start-start-radius: 0;
  border-start-end-radius: 0;
}
.k-control-group.k-control-group.is-vertical > :not(:last-child) {
  border-end-start-radius: 0;
  border-end-end-radius: 0;
}
/* 复合控件：边框/圆角画在内部视觉壳上，需把边缘规则透传到壳 */
/* Select：圆角在 .k-select__control */
.k-control-group.k-control-group:not(.is-vertical) > .k-select:not(:first-child) .k-select__control {
  border-start-start-radius: 0;
  border-end-start-radius: 0;
}
.k-control-group.k-control-group:not(.is-vertical) > .k-select:not(:last-child) .k-select__control {
  border-start-end-radius: 0;
  border-end-end-radius: 0;
}
.k-control-group.k-control-group.is-vertical > .k-select:not(:first-child) .k-select__control {
  border-start-start-radius: 0;
  border-start-end-radius: 0;
}
.k-control-group.k-control-group.is-vertical > .k-select:not(:last-child) .k-select__control {
  border-end-start-radius: 0;
  border-end-end-radius: 0;
}
/* InputNumber：边框/圆角在内部 KInput 根节点 */
.k-control-group.k-control-group:not(.is-vertical) > .k-input-number:not(:first-child) .k-input {
  border-start-start-radius: 0;
  border-end-start-radius: 0;
}
.k-control-group.k-control-group:not(.is-vertical) > .k-input-number:not(:last-child) .k-input {
  border-start-end-radius: 0;
  border-end-end-radius: 0;
}
.k-control-group.k-control-group.is-vertical > .k-input-number:not(:first-child) .k-input {
  border-start-start-radius: 0;
  border-start-end-radius: 0;
}
.k-control-group.k-control-group.is-vertical > .k-input-number:not(:last-child) .k-input {
  border-end-start-radius: 0;
  border-end-end-radius: 0;
}
/* 按钮型 RadioGroup：圆角在首尾 .k-radio--button 上 */
.k-control-group.k-control-group:not(.is-vertical)
  > .k-radio-group--button:not(:first-child)
  .k-radio--button:first-child {
  border-start-start-radius: 0;
  border-end-start-radius: 0;
}
.k-control-group.k-control-group:not(.is-vertical)
  > .k-radio-group--button:not(:last-child)
  .k-radio--button:last-child {
  border-start-end-radius: 0;
  border-end-end-radius: 0;
}
/* Switch 是独立胶囊：不参与拼接圆角（保持自身形状；选择器与拼角规则同权且在后） */
.k-control-group.k-control-group:not(.is-vertical) > .k-switch,
.k-control-group.k-control-group.is-vertical > .k-switch {
  border-start-start-radius: var(--k-border-radius-full);
  border-start-end-radius: var(--k-border-radius-full);
  border-end-start-radius: var(--k-border-radius-full);
  border-end-end-radius: var(--k-border-radius-full);
}

/* 激活项抬层：hover / 聚焦时边框盖住相邻项 */
.k-control-group > *:focus-within,
.k-control-group > *:hover {
  z-index: 1;
}
</style>
