import type { InjectionKey, Ref } from 'vue';

/**
 * FormItem → 表单控件的注入契约（对标 antd Form.Item 的克隆传参，Vue 侧走 provide/inject）：
 * 控件消费 status 兜底（prop > 这里 > undefined），并在 blur/改变时回调触发字段校验。
 * 独立 context 模块避免 Form↔Item↔控件 的循环 import。
 */
export interface FormItemContext {
  status: Ref<'error' | 'warning' | undefined>;
  /** 自动生成的控件 id：label for 与控件 id 共用 */
  controlId: string;
  /** 标签节点 id：分组控件（RadioGroup/CheckboxGroup）用 aria-labelledby 关联 */
  labelId: string;
  /** 错误/提示文案节点 id（存在 help 时） */
  helpId: string;
  /** 是否有 help 文案：有则控件 aria-describedby 指向 helpId */
  describedBy: Ref<string | undefined>;
  /** 当前是否错误：控件 aria-invalid */
  invalid: Ref<boolean>;
  onFieldBlur: () => void;
  onFieldChange: () => void;
}
export const FORM_ITEM_KEY: InjectionKey<FormItemContext> = Symbol('k-form-item');

export interface FormItemMeta {
  name: string;
  validate: (trigger?: 'blur' | 'change' | 'submit') => Promise<void>;
  clearError: () => void;
}

export interface FormContext {
  /** 数据源对象（KForm model 的 reactive 引用） */
  model: Ref<Record<string, unknown> | undefined>;
  /** 全表 rules：FormItem 按 name 取；字段级 rules 覆盖 */
  rules: Ref<Record<string, unknown> | undefined>;
  /** 标签冒号开关（antd colon），FormItem 渲染标签时消费 */
  colon: Ref<boolean>;
  register: (item: FormItemMeta) => void;
  unregister: (name: string) => void;
}
export const FORM_KEY: InjectionKey<FormContext> = Symbol('k-form');
