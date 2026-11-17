<script setup lang="ts">
import { computed, inject, onBeforeUnmount, provide, ref, useSlots, watch } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import Schema from 'async-validator';
import { FORM_ITEM_KEY, FORM_KEY } from './context';
import type { FormItemMeta } from './context';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KFormItem' });

/** headless scope：#render 插槽 / render prop 闭包参数；注册/校验/控件注入照跑 */
export interface KFormItemRenderScope {
  name: string | undefined;
  label: string | undefined;
  /** required prop || 规则含 required 的合成 */
  required: boolean;
  /** error/warning（warningOnly 规则）/undefined */
  status: 'error' | 'warning' | undefined;
  error: string | null;
  validating: boolean;
  extra: string | undefined;
  /** 表级 colon 注入 */
  colon: boolean;
  validate: (trigger?: 'blur' | 'change' | 'submit') => Promise<void>;
  clearError: () => void;
  /** data-part + --k-form-item-label-width 变量（显式 labelWidth 时） */
  rootAttrs: Record<string, unknown>;
  slots: ReturnType<typeof useSlots>;
}

interface KFormItemProps {
  /** 字段名：取值 model[name]、取规则 rules[name] */
  name?: string;
  label?: string;
  /** 字段级规则，覆盖表级 rules[name]（async-validator 规则对象/数组） */
  rules?: unknown;
  /** 无规则时也显必填星号 */
  required?: boolean;
  /** 校验收敛前的取值触发（antd trigger 简化：on=blur|change|both） */
  validateTrigger?: 'blur' | 'change' | 'both';
  /** 常驻帮助文案（无错误时替代显示） */
  extra?: string;
  labelWidth?: number | string;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KFormItemRenderScope>;
  classNames?: { root?: string; label?: string; control?: string; help?: string };
  styles?: { root?: CSSProperties; label?: CSSProperties; control?: CSSProperties; help?: CSSProperties };
}

const props = withDefaults(defineProps<KFormItemProps>(), {
  validateTrigger: 'both',
});

const form = inject(FORM_KEY, null);
if (!form) throw new Error('[KFormItem] must be used inside <KForm>');

const error = ref<string | null>(null);
const validating = ref(false);

const mergedRules = computed(() => props.rules ?? form!.rules.value?.[props.name ?? ''] ?? null);
const isRequired = computed(() => {
  if (props.required) return true;
  const r = mergedRules.value;
  const list = Array.isArray(r) ? r : r ? [r] : [];
  return list.some((x: Record<string, unknown>) => x && x.required);
});

const status = computed<'error' | 'warning' | undefined>(() => {
  if (!error.value) return undefined;
  const r = mergedRules.value;
  const list = Array.isArray(r) ? r : r ? [r] : [];
  return list.some((x: Record<string, unknown>) => x?.warningOnly) ? 'warning' : 'error';
});

function validate(trigger?: 'blur' | 'change' | 'submit'): Promise<void> {
  if (!props.name || !mergedRules.value || !form!.model.value) {
    error.value = null;
    return Promise.resolve();
  }
  // 规则带 trigger 且不匹配当前触发点则跳过（async-validator 无原生 trigger，字段侧实现）
  if (trigger && trigger !== 'submit') {
    const r = mergedRules.value;
    const list = Array.isArray(r) ? r : [r];
    const scoped = list.filter(
      (x: Record<string, unknown>) => !x?.trigger || x.trigger === trigger ||
        (Array.isArray(x.trigger) && x.trigger.includes(trigger)),
    );
    if (!scoped.length) return Promise.resolve();
    return runValidate(scoped);
  }
  return runValidate(mergedRules.value as unknown);
}

function runValidate(rules: unknown): Promise<void> {
  const name = props.name as string;
  const value = form!.model.value?.[name];
  const schema = new Schema({ [name]: rules as never });
  validating.value = true;
  return schema
    .validate({ [name]: value })
    .then(() => {
      error.value = null;
    })
    .catch((e: { errors?: { message?: string }[] }) => {
      error.value = e.errors?.[0]?.message ?? '校验失败';
      throw e;
    })
    .finally(() => {
      validating.value = false;
    });
}

function clearError() {
  error.value = null;
}

const meta: FormItemMeta = { name: props.name ?? '', validate, clearError };
if (props.name) form!.register(meta);
onBeforeUnmount(() => {
  if (props.name) form!.unregister(props.name);
});
// name 可动态改：重挂注册
watch(
  () => props.name,
  (next, prev) => {
    if (prev) form!.unregister(prev);
    if (next) {
      meta.name = next;
      form!.register(meta);
    }
  },
);

/* 控件消费面（Input 族注入）：status 兜底 + blur/change 回调触发 */
provide(FORM_ITEM_KEY, {
  status,
  onFieldBlur: () => {
    if (props.validateTrigger === 'blur' || props.validateTrigger === 'both') void validate('blur').catch(() => {});
  },
  onFieldChange: () => {
    if (props.validateTrigger === 'change' || props.validateTrigger === 'both') void validate('change').catch(() => {});
  },
});

const labelWidthStyle = computed(() =>
  props.labelWidth != null
    ? { '--k-form-item-label-width': typeof props.labelWidth === 'number' ? `${props.labelWidth}px` : props.labelWidth }
    : undefined,
);

const rootAttrs = computed(() => ({
  'data-part': 'root',
  ...(labelWidthStyle.value ? { style: labelWidthStyle.value } : {}),
}));

const slots = useSlots();

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KFormItemRenderScope>(
  () => props.render,
  () => ({
    name: props.name,
    label: props.label,
    required: isRequired.value,
    status: status.value,
    error: error.value,
    validating: validating.value,
    extra: props.extra,
    colon: form!.colon.value,
    validate,
    clearError,
    rootAttrs: rootAttrs.value,
    slots,
  }),
);

defineSlots<{
  default?(): VNodeChild;
  label?(): VNodeChild;
  extra?(): VNodeChild;
  render?(scope: KFormItemRenderScope): VNodeChild;
}>();
</script>

<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <div v-else class="k-form-item" :class="[{ 'has-error': status === 'error' }, classNames?.root]" v-bind="rootAttrs" :style="styles?.root">
    <label
      v-if="label != null || $slots.label"
      data-part="label"
      class="k-form-item__label"
      :class="classNames?.label"
      :style="styles?.label"
    >
      <span v-if="isRequired" class="k-form-item__required" aria-hidden="true">*</span>
      <slot name="label">{{ label }}</slot>
      <span v-if="form!.colon.value" class="k-form-item__colon">:</span>
    </label>
    <div data-part="control" class="k-form-item__control" :class="classNames?.control" :style="styles?.control">
      <slot />
      <div
        v-if="error || extra || $slots.extra"
        data-part="help"
        class="k-form-item__help"
        :class="{ 'is-error': !!error }"
        :style="styles?.help"
      >
        <template v-if="error">{{ error }}</template>
        <slot v-else name="extra">{{ extra }}</slot>
      </div>
    </div>
  </div>
</template>

<style>
.k-form-item {
  --k-form-item-help-color: var(--k-color-text-tertiary);
  --k-form-item-error-color: var(--k-color-error);
  --k-form-item-label-color: var(--k-color-text);

  display: flex;
  flex-direction: column;
  gap: var(--k-size-xxs);
  min-width: 0;
}
.k-form--inline .k-form-item {
  flex-direction: row;
  align-items: flex-start;
  gap: var(--k-size-xs);
}
.k-form--horizontal .k-form-item {
  flex-direction: row;
  align-items: flex-start;
  gap: var(--k-size-xs);
}
.k-form-item__label {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xxs);
  min-height: var(--k-control-height);
  color: var(--k-form-item-label-color);
  white-space: nowrap;
}
.k-form--horizontal .k-form-item__label,
.k-form--inline .k-form-item__label {
  width: var(--k-form-item-label-width, var(--k-form-label-width));
  justify-content: flex-end;
}
.k-form--label-left.k-form--horizontal .k-form-item__label {
  justify-content: flex-start;
}
.k-form-item__required {
  color: var(--k-form-item-error-color);
}
.k-form-item__colon {
  margin-inline-start: calc(var(--k-size-xxs) * -1);
}
.k-form-item__control {
  flex: auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--k-size-xxs);
}
.k-form--inline .k-form-item__control {
  width: auto;
  min-width: calc(var(--k-control-height) * 6);
}
.k-form-item__help {
  min-height: var(--k-line-height);
  color: var(--k-form-item-help-color);
  font-size: var(--k-font-size-sm);
}
.k-form-item__help.is-error {
  color: var(--k-form-item-error-color);
}
</style>
