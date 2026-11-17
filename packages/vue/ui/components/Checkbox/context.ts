import type { InjectionKey, Ref } from 'vue';

/** Checkbox 子件消费组上下文（独立模块避免 Group↔Item 循环 import） */
export const CHECKBOX_GROUP_KEY: InjectionKey<{
  values: Ref<(string | number)[]>;
  disabled: Ref<boolean>;
  toggle: (v: string | number, on: boolean) => void;
}> = Symbol('k-checkbox-group');
