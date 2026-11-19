<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <form
    v-else
    class="k-form"
    :class="[
      `k-form--${layoutValue}`,
      `k-form--label-${labelAlignValue}`,
      classNames?.root,
    ]"
    v-bind="rootAttrs"
    :style="styles?.root"
    v-on="rootOn"
  >
    <slot />
  </form>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, provide, ref, useSlots } from 'vue';
import type { CSSProperties, VNodeChild } from 'vue';
import { FORM_KEY } from './context';
import type { FormItemMeta } from './context';
import { useResponsiveValue } from '../../composables/useResponsiveValue';
import type { KResponsiveValue, KResponsiveMap } from '../../composables/useResponsiveValue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn } from '../../composables/useCustomRender';

defineOptions({ name: 'KForm' });

type FormLayout = 'vertical' | 'horizontal' | 'inline';
type FormLabelAlign = 'left' | 'right';

/** headless scope：#render 插槽 / render prop 闭包参数；字段注册/校验汇总逻辑照跑 */
export interface KFormRenderScope {
  layout: FormLayout;
  /** 归一化后的标签宽 CSS 值（number → px） */
  labelWidth: string;
  labelAlign: FormLabelAlign;
  colon: boolean;
  model: Record<string, unknown> | undefined;
  rules: Record<string, unknown> | undefined;
  validating: boolean;
  errorCount: number;
  /** 整表校验（allSettled 汇总 + finish/finishFailed 事件；失败 reject） */
  validate: () => Promise<void>;
  /** 清全部字段错误回显（数据源由调用方还原） */
  resetFields: () => void;
  /** data-part + --k-form-label-width 变量（布局逻辑） */
  rootAttrs: Record<string, unknown>;
  /** native submit 拦截（preventDefault + validate）；自绘 form 节点 v-on 绑它 */
  rootOn: { submit: (e: Event) => void };
  slots: ReturnType<typeof useSlots>;
}

interface KFormProps {
  /** 数据源（字段值按 name 取值校验；控件各自 v-model 到 model.xxx） */
  model?: Record<string, unknown>;
  /** 校验规则：async-validator 规则对象或其数组，按字段 name 匹配 */
  rules?: Record<string, unknown>;
  /** 布局；对象/字符串按断点取值 */
  layout?: FormLayout | KResponsiveMap<FormLayout> | string;
  /** horizontal/inline 下标签宽（antd labelCol 的简化数值，px）；对象/字符串按断点取值 */
  labelWidth?: number | string | KResponsiveMap<number | string>;
  /** 标签对齐；对象/字符串按断点取值 */
  labelAlign?: FormLabelAlign | KResponsiveMap<FormLabelAlign> | string;
  /** 标签后冒号（antd 同款默认开）；对象/字符串按断点取值 */
  colon?: boolean | KResponsiveMap<boolean> | string;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换 */
  render?: KRenderFn<KFormRenderScope>;
  classNames?: { root?: string };
  styles?: { root?: CSSProperties };
}

const props = withDefaults(defineProps<KFormProps>(), {
  layout: 'vertical',
  labelWidth: 100,
  labelAlign: 'right',
  colon: true,
});

const emit = defineEmits<{
  finish: [values: Record<string, unknown>];
  finishFailed: [e: { errors: unknown[]; values: Record<string, unknown> }];
}>();

const items = new Map<string, FormItemMeta>();

const resolvedLabelWidth = useResponsiveValue<number | string>(
  () => props.labelWidth as KResponsiveValue<number | string>,
  {
    coerce: raw => (/^\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw),
  },
);

const resolvedLayout = useResponsiveValue<FormLayout>(
  () => props.layout as KResponsiveValue<FormLayout>,
  { coerce: raw => raw as FormLayout },
);
const resolvedLabelAlign = useResponsiveValue<FormLabelAlign>(
  () => props.labelAlign as KResponsiveValue<FormLabelAlign>,
  { coerce: raw => raw as FormLabelAlign },
);
const resolvedColon = useResponsiveValue<boolean>(
  () => props.colon as KResponsiveValue<boolean>,
  { coerce: raw => raw === 'true' },
);

const layoutValue = computed<FormLayout>(() => resolvedLayout.value ?? 'vertical');
const labelAlignValue = computed<FormLabelAlign>(() => resolvedLabelAlign.value ?? 'right');
const colonValue = computed<boolean>(() => resolvedColon.value ?? true);

provide(FORM_KEY, {
  model: computed(() => props.model),
  rules: computed(() => props.rules),
  colon: computed(() => colonValue.value),
  register: (item) => items.set(item.name, item),
  unregister: (name) => items.delete(name),
});

/* 校验下沉到 FormItem（字段级 rules 覆盖表级），整表 = allSettled 汇总；避免表级 schema 与字段独有规则两套回显路径 */
const validating = ref(false);
const errorCount = ref(0);

async function validate(): Promise<void> {
  validating.value = true;
  try {
    const results = await Promise.allSettled(
      [...items.values()].map((it) => it.validate('submit')),
    );
    const failed = results.filter((r) => r.status === 'rejected');
    errorCount.value = failed.length;
    if (failed.length) {
      const errors = failed.flatMap((r) => (r as PromiseRejectedResult).reason?.errors ?? []);
      const values = { ...(props.model ?? {}) };
      emit('finishFailed', { errors, values });
      throw { errors, values };
    }
    emit('finish', { ...(props.model ?? {}) });
  } finally {
    validating.value = false;
  }
}

/** 重置：清错误回显（数据源由调用方自行还原） */
function resetFields() {
  for (const it of items.values()) it.clearError();
  errorCount.value = 0;
}

/* native submit 拦截：type=submit 按钮或回车直接走 validate */
function onSubmit(e: Event) {
  e.preventDefault();
  void validate().catch(() => {});
}

onBeforeUnmount(() => items.clear());

defineExpose({ validate, resetFields, validating, errorCount });

const labelWidthCss = computed(() => {
  const width = resolvedLabelWidth.value ?? 100;
  return typeof width === 'number' ? `${width}px` : width;
});

const rootAttrs = computed(() => ({
  'data-part': 'root',
  style: { '--k-form-label-width': labelWidthCss.value },
}));
const rootOn = { submit: onSubmit };

const slots = useSlots();

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KFormRenderScope>(
  () => props.render,
  () => ({
    layout: layoutValue.value,
    labelWidth: labelWidthCss.value,
    labelAlign: labelAlignValue.value,
    colon: colonValue.value,
    model: props.model,
    rules: props.rules,
    validating: validating.value,
    errorCount: errorCount.value,
    validate,
    resetFields,
    rootAttrs: rootAttrs.value,
    rootOn,
    slots,
  }),
);

defineSlots<{
  default?(): VNodeChild;
  render?(scope: KFormRenderScope): VNodeChild;
}>();
</script>

<style>
.k-form {
  --k-form-label-width: 100px;
  --k-form-gap: var(--k-size-lg);
  --k-form-item-gap: var(--k-size-xs);

  display: flex;
  flex-direction: column;
  gap: var(--k-form-gap);
  font-family: inherit;
  font-size: var(--k-input-font-size);
  color: var(--k-color-text);
}
.k-form--inline {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-start;
}
</style>
