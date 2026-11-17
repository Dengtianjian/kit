import { computed, useSlots } from 'vue';
import type { VNodeChild } from 'vue';

/** 自定义渲染闭包：收组件 scope（状态/动作/绑定包/出口），返回 VNode（render prop 通道） */
export type KRenderFn<S> = (scope: S) => VNodeChild;

/** 事件绑定包：模板里 v-on="pack" 直接散播；h() 里需 onProps(pack) 转成 onXxx 键 */
export type KOnPack = Record<string, (e: Event) => void>;

export function onProps(pack: KOnPack): Record<string, (e: Event) => void> {
  const out: Record<string, (e: Event) => void> = {};
  for (const k in pack) out[`on${k[0].toUpperCase()}${k.slice(1)}`] = pack[k];
  return out;
}

/**
 * headless 双通道基座：#render 作用域插槽优先，render prop 兜底；
 * 提供任一通道时组件整件视觉输出被替换，script 逻辑照跑（绑定包 spread 才生效）。
 */
export function useCustomRender<S>(render: () => KRenderFn<S> | undefined, buildScope: () => S) {
  const slots = useSlots();
  const renderScope = computed(buildScope);
  const hasCustomRender = computed(() => !!slots.render || !!render());
  // 函数式组件：在自己的 render effect 里读 scope，状态变化自动追踪重渲
  const renderPropOutlet = () => render()!(renderScope.value);
  return { renderScope, hasCustomRender, renderPropOutlet };
}