import type { InjectionKey, Ref } from 'vue';

export interface KRadioOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}
export type KRadioOptionInput = string | KRadioOption;

export const RADIO_GROUP_KEY: InjectionKey<{
  value: Ref<string | number | undefined>;
  disabled: Ref<boolean>;
  shape: Ref<'circle' | 'button'>;
  select: (v: string | number) => void;
}> = Symbol('k-radio-group');
