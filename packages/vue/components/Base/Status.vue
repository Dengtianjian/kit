<template>
  <div class="r-status" :style="{
    '--font-size': Props.fontSize
  }" role="status" aria-live="polite">
    <div class="r-status_loading-icon" v-if="Props.loadingIcon && Props.loading" :style="{
      '--icon-color': Props.iconColor,
      '--icon-active-color': Props.iconActiveColor
    }">
      <i
        v-for="dot in 3"
        :key="dot"
        class="r-status_loading-icon-el"
        :class="{ 'r-status_loading-icon-el_active': ActiveIndex === dot - 1 }"
      ></i>
    </div>
    <span class="r-status_text">{{ text }}</span>
  </div>
</template>

<script lang="ts" setup>
/**
 * 列表底部状态：下拉加载更多 / 加载中 / 已加载完。
 *
 * Web（Vue SFC）版本，替换原先误放进 vue 包的小程序实现：
 * - `<view>` 改 div/i，尺寸按 375 设计稿 2rpx = 1px 换算成 px；
 * - class 里的 `{{ }}` 小程序插值改 `:class`；
 * - 文案抽成 computed，避免模板里嵌三元。
 *
 * 类名与 CSS 变量沿用组件原有命名（r-status_* / --icon-color 等），
 * props API 完全兼容，调用方无需改动。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const Props = withDefaults(defineProps<{
  defaultText?: string,
  loading?: boolean,
  loadingText?: string,
  loadingIcon?: boolean,
  iconColor?: string,
  iconActiveColor?: string,
  fontSize?: string,
  finished?: boolean,
  finishedText?: string
}>(), {
  defaultText: "下拉加载更多",
  loading: false,
  loadingText: "加载中",
  loadingIcon: true,
  iconColor: "#999",
  iconActiveColor: "#333",
  fontSize: "14px",
  finished: false,
  finishedText: "没有更多了"
});

const ActiveIndex = ref<number>(0);

const text = computed(() => {
  if (Props.loading) return Props.loadingText;
  if (Props.finished) return Props.finishedText;
  return Props.defaultText;
});

/** 用 ReturnType 而不是 NodeJS.Timeout：浏览器环境没有 Node 定时器类型保证 */
let loadingAnimationTimer: ReturnType<typeof setInterval> | null = null;

function stopLoadingAnimation() {
  if (loadingAnimationTimer !== null) {
    clearInterval(loadingAnimationTimer);
    loadingAnimationTimer = null;
  }
}

function startLoadingAnimation() {
  // 先停再起：loading 反复切换时不会叠出多个 interval
  stopLoadingAnimation();
  ActiveIndex.value = 0;
  loadingAnimationTimer = setInterval(() => {
    ActiveIndex.value = (ActiveIndex.value + 1) % 3;
  }, 200);
}

function syncLoadingAnimation() {
  if (Props.loading && Props.loadingIcon) startLoadingAnimation();
  else stopLoadingAnimation();
}

// 原实现 onMounted 无条件启动动画：非 loading 状态也白跑一个定时器，
// 且卸载时不清理，interval 会一直泄漏。
watch([() => Props.loading, () => Props.loadingIcon], syncLoadingAnimation);
onMounted(syncLoadingAnimation);
onBeforeUnmount(stopLoadingAnimation);
</script>

<style scoped>
.r-status {
  --font-size: 14px;

  display: flex;
  align-items: center;
  justify-content: center;
  column-gap: 10px;
  padding: 4px 0;
  min-height: 50px;
  color: #999;
  font-size: var(--font-size);
  box-sizing: border-box;
}

.r-status_loading-icon {
  display: flex;
  align-items: center;
  column-gap: 2px;
  flex: none;
}

.r-status_loading-icon-el {
  width: 5px;
  height: 5px;
  flex: none;
  background-color: var(--icon-color);
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.r-status_loading-icon-el_active {
  background-color: var(--icon-active-color);
}

.r-status_text {
  min-width: 0;
}
</style>
