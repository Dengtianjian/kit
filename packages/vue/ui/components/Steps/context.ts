import type { ComputedRef, InjectionKey } from 'vue';

export type KStepStatus = 'wait' | 'process' | 'finish' | 'error';
export type KStepsDirection = 'horizontal' | 'vertical';
export type KStepsVariant = 'default' | 'dot';
export type KStepsSize = 'sm' | 'md' | 'lg';

export interface KStepContext {
  index: ComputedRef<number>;
  status: ComputedRef<KStepStatus>;
  current: ComputedRef<boolean>;
  last: ComputedRef<boolean>;
  clickable: ComputedRef<boolean>;
  variant: ComputedRef<KStepsVariant>;
  activate: () => void;
}

export const K_STEP_KEY: InjectionKey<KStepContext> = Symbol('k-step');