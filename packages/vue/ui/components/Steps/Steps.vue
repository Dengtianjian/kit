<template>
  <div
    data-part="root"
    class="k-steps"
    :class="[
      `k-steps--${direction}`,
      `k-steps--${size}`,
      {
        'is-dot': variant === 'dot',
        'is-clickable': clickable,
      },
      classNames?.root,
    ]"
    :style="styles?.root"
  >
    <component :is="StepList" />
  </div>
</template>

<script setup lang="ts">
import { Comment, Fragment, Text, computed, defineComponent, h, provide, useSlots } from 'vue';
import type { CSSProperties, PropType, VNode, VNodeChild } from 'vue';
import KStep from './Step.vue';
import { K_STEP_KEY } from './context';
import type {
  KStepStatus,
  KStepsDirection,
  KStepsSize,
  KStepsVariant,
} from './context';

defineOptions({ name: 'KSteps' });

type StepsPart = 'root';

interface KStepsProps {
  /** 当前步骤状态；缺省 process */
  status?: KStepStatus;
  direction?: KStepsDirection;
  size?: KStepsSize;
  variant?: KStepsVariant;
  /** 开启后步骤可点击切换；单项可用 clickable / disabled 覆盖 */
  clickable?: boolean;
  classNames?: Partial<Record<StepsPart, string>>;
  styles?: Partial<Record<StepsPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KStepsProps>(), {
  status: 'process',
  direction: 'horizontal',
  size: 'md',
  variant: 'default',
  clickable: false,
});

const emit = defineEmits<{ change: [index: number] }>();
const current = defineModel<number>('current', { default: 0 });
const slots = useSlots();

function statusOf(index: number): KStepStatus {
  if (index < current.value) return 'finish';
  if (index === current.value) return props.status;
  return 'wait';
}

function activate(index: number) {
  if (index === current.value) return;
  current.value = index;
  emit('change', index);
}

/** VNode props 是原始值：裸写布尔属性时为空串，需复刻 Vue 的布尔转换 */
function boolProp(value: unknown, name: string): boolean {
  return value === '' || value === name ? true : Boolean(value);
}

function flattenSteps(nodes: VNode[]): VNode[] {
  const out: VNode[] = [];
  for (const node of nodes) {
    if (node.type === Fragment) {
      if (Array.isArray(node.children)) out.push(...flattenSteps(node.children as VNode[]));
      continue;
    }
    if (node.type === Comment) continue;
    if (node.type === Text && typeof node.children === 'string' && !node.children.trim()) continue;
    if (node.type === KStep) out.push(node);
  }
  return out;
}

const StepHost = defineComponent({
  name: 'KStepHost',
  props: {
    node: { type: Object as PropType<VNode>, required: true },
    index: { type: Number, required: true },
    status: { type: String as PropType<KStepStatus>, required: true },
    current: { type: Boolean, required: true },
    last: { type: Boolean, required: true },
    clickable: { type: Boolean, default: false },
    variant: { type: String as PropType<KStepsVariant>, required: true },
    onActivate: { type: Function as PropType<() => void>, required: true },
  },
  setup(hostProps) {
    provide(K_STEP_KEY, {
      index: computed(() => hostProps.index),
      status: computed(() => hostProps.status),
      current: computed(() => hostProps.current),
      last: computed(() => hostProps.last),
      clickable: computed(() => hostProps.clickable),
      variant: computed(() => hostProps.variant),
      activate: () => hostProps.onActivate(),
    });
    return () => hostProps.node;
  },
});

const StepList = defineComponent({
  name: 'KStepsList',
  setup() {
    return () => {
      const nodes = flattenSteps((slots.default?.() ?? []) as VNode[]);
      return nodes.map((node, index) => {
        const rawClickable = (node.props as Record<string, unknown> | null)?.clickable;
        return h(StepHost, {
          key: node.key ?? index,
          node,
          index,
          status: statusOf(index),
          current: index === current.value,
          last: index === nodes.length - 1,
          clickable:
            rawClickable === undefined ? props.clickable : boolProp(rawClickable, 'clickable'),
          variant: props.variant,
          onActivate: () => activate(index),
        });
      });
    };
  },
});

defineSlots<{
  default?(): VNodeChild;
}>();
</script>

<style>
.k-steps {
  --k-step-gap: var(--k-size-sm);

  display: flex;
  box-sizing: border-box;
  font-size: var(--k-font-size);
}
.k-steps--sm {
  --k-step-gap: var(--k-size-xs);

  font-size: var(--k-font-size-sm);
}
.k-steps--lg {
  --k-step-gap: var(--k-size);

  font-size: var(--k-font-size-lg);
}
.k-steps--sm .k-step {
  --k-step-icon-size: var(--k-control-height-sm);
  --k-step-title-size: var(--k-font-size-sm);
  --k-step-description-size: var(--k-font-size-sm);
}
.k-steps--lg .k-step {
  --k-step-icon-size: var(--k-control-height-lg);
  --k-step-title-size: var(--k-font-size-lg);
  --k-step-description-size: var(--k-font-size);
}
.k-steps--horizontal {
  flex-direction: row;
  align-items: flex-start;
}
</style>