import type { ComputedRef, InjectionKey } from 'vue';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

/** KButtonGroup → KButton 的 size 下发通道；子级自传 size 优先 */
export const buttonGroupSizeKey: InjectionKey<ComputedRef<ButtonSize | undefined>> =
  Symbol('KButtonGroupSize');
