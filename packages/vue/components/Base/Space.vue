<template>
  <div class="r-space" :style="spaceStyle">
    <slot />
  </div>
</template>

<script lang="ts" setup>
/**
 * flex 间距容器：统一 gap / 对齐 / 换行 / 方向。
 *
 * 修复记录：
 * - 默认值里把 `wrap` 误写成 `warp`，导致 wrap 拿不到默认值（现改为 wrap: 'nowrap'）；
 * - 模板原先用 `:style="[对象, 对象]"` 数组拼接，vue-tsc 推不出 StyleValue 会直接编译报错，
 *   现改成 computed 返回单个 CSSProperties 对象；
 * - 数字型 gap 补 px，空字符串不再写进 style（避免出现 `gap: ` 这类无效声明）。
 *
 * props 与调用方式保持兼容。
 */
import { computed } from 'vue'
import type { CSSProperties } from 'vue'

const props = withDefaults(defineProps<{
  justify?: 'start' | 'end' | 'center' | 'space-around' | 'space-between' | 'space-evenly'
  align?: 'start' | 'end' | 'center' | 'baseline' | 'stretch'
  wrap?: 'nowrap' | 'wrap' | 'wrap-reverse' | string
  gap?: number | string
  rowGap?: number | string
  columnGap?: number | string
  direction?: string
}>(), {
  justify: 'start',
  align: 'start',
  wrap: 'nowrap',
  gap: '',
  rowGap: '',
  columnGap: '',
  direction: 'row',
})

/** 数字补 px；空值返回 undefined，由调用方决定是否写进 style */
function length(value: number | string): string | undefined {
  if (value === '' || value === undefined || value === null) return undefined
  return typeof value === 'number' ? `${value}px` : value
}

const spaceStyle = computed<CSSProperties>(() => {
  const style: CSSProperties = {
    justifyContent: props.justify as CSSProperties['justifyContent'],
    alignItems: props.align as CSSProperties['alignItems'],
    flexWrap: props.wrap as CSSProperties['flexWrap'],
    flexDirection: props.direction as CSSProperties['flexDirection'],
  }

  // gap 是 row/column 的简写：传了 gap 就不再分别写 rowGap / columnGap
  const gap = length(props.gap)
  if (gap !== undefined) {
    style.gap = gap
  } else {
    const row = length(props.rowGap)
    const column = length(props.columnGap)
    if (row !== undefined) style.rowGap = row
    if (column !== undefined) style.columnGap = column
  }

  return style
})
</script>

<style scoped>
.r-space {
  display: flex;
}
</style>
