<template>
  <div
    data-part="root"
    class="k-steps"
    :class="[
      `k-steps--${direction}`,
      `k-steps--${size}`,
      `k-steps--${variant}`,
      {
        'is-dot': variant === 'dot',
        'is-clickable': clickable,
        'is-pulse': pulse,
        'is-show-icon': showIcon,
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
  /** 当前步骤呼吸动画 */
  pulse?: boolean;
  /** 最多展示的步骤数（含首尾与当前步），超出部分折叠为省略节点 */
  max?: number;
  /** 导航型 / 面板型是否展示序号或图标 */
  showIcon?: boolean;
  classNames?: Partial<Record<StepsPart, string>>;
  styles?: Partial<Record<StepsPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KStepsProps>(), {
  status: 'process',
  direction: 'horizontal',
  size: 'md',
  variant: 'default',
  clickable: false,
  pulse: true,
  showIcon: false,
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

const EllipsisHost = defineComponent({
  name: 'KStepsEllipsis',
  props: {
    last: { type: Boolean, default: false },
    arrow: { type: Boolean, default: false },
  },
  setup(hostProps) {
    const arrow = () =>
      h('span', { class: 'k-step__arrow', 'aria-hidden': 'true' }, [
        h(
          'svg',
          {
            viewBox: '0 0 24 24',
            width: '1em',
            height: '1em',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': 2,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
          },
          [h('path', { d: 'M11 4l3 8l-3 8' })],
        ),
      ]);
    return () =>
      h('div', { class: ['k-step', 'is-ellipsis'], 'aria-hidden': 'true' }, [
        h('span', { class: ['k-step__icon', 'is-custom'] }, '···'),
        hostProps.last ? null : h('span', { class: 'k-step__connector' }),
        hostProps.arrow && !hostProps.last ? arrow() : null,
      ]);
  },
});

/** 限量展示：保留首尾与当前步，围绕当前步补足名额，其余折叠 */
function visibleIndexes(total: number): number[] {
  const all = Array.from({ length: total }, (_, i) => i);
  const max = Math.floor(props.max ?? 0);
  if (!max || max >= total || total <= 3) return all;

  const limit = Math.max(3, max);
  const focus = Math.min(total - 1, Math.max(0, current.value));
  const keep = new Set<number>([0, total - 1, focus]);
  let budget = limit - keep.size;
  let left = focus - 1;
  let right = focus + 1;
  while (budget > 0 && (left > 0 || right < total - 1)) {
    if (left > 0) {
      keep.add(left);
      left -= 1;
      budget -= 1;
    }
    if (budget > 0 && right < total - 1) {
      keep.add(right);
      right += 1;
      budget -= 1;
    }
  }
  return [...keep].sort((a, b) => a - b);
}

const StepList = defineComponent({
  name: 'KStepsList',
  setup() {
    return () => {
      const nodes = flattenSteps((slots.default?.() ?? []) as VNode[]);
      const entries: { node?: VNode; index?: number; key: string | number }[] = [];
      let prev = -1;
      for (const index of visibleIndexes(nodes.length)) {
        if (prev >= 0 && index - prev > 1) entries.push({ key: `gap-${prev}-${index}` });
        entries.push({ node: nodes[index], index, key: nodes[index].key ?? index });
        prev = index;
      }
      return entries.map((entry, position) => {
        const last = position === entries.length - 1;
        if (!entry.node) {
          return h(EllipsisHost, {
            key: entry.key,
            last,
            arrow: props.variant === 'navigation',
          });
        }
        const { node, index } = entry as { node: VNode; index: number };
        const rawClickable = (node.props as Record<string, unknown> | null)?.clickable;
        return h(StepHost, {
          key: entry.key,
          node,
          index,
          status: statusOf(index),
          current: index === current.value,
          last,
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
.k-step .k-step__icon {
  --k-step-pulse-color: var(--k-color-primary);
}
.k-step.is-ellipsis .k-step__icon.is-custom {
  color: var(--k-color-text-quaternary);
  font-size: var(--k-step-title-size);
  letter-spacing: 0.12em;
}
.k-step.is-error .k-step__icon {
  --k-step-pulse-color: var(--k-color-error);
}
.k-steps.is-pulse .k-step.is-current .k-step__icon {
  animation: k-step-breathe 2s var(--k-motion-ease-in-out-cubic) infinite;
}
.k-steps.is-pulse .k-step.is-current .k-step__icon.is-custom {
  animation: k-step-breathe-plain 2s var(--k-motion-ease-in-out-cubic) infinite;
}
@keyframes k-step-breathe {
  0%,
  100% {
    box-shadow: 0 0 0 0 color-mix(in oklab, var(--k-step-pulse-color) 30%, transparent);
  }
  50% {
    box-shadow: 0 0 0 7px color-mix(in oklab, var(--k-step-pulse-color) 0%, transparent);
  }
}
@keyframes k-step-breathe-plain {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}
@media (prefers-reduced-motion: reduce) {
  .k-steps.is-pulse .k-step.is-current .k-step__icon {
    animation: none;
  }
}
</style>