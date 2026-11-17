<script setup lang="ts">
import { ref } from 'vue';
import type { Component } from 'vue';
import { provideKApp } from '../../composables/useKApp';
import { createModalService } from '../Modal/service';
import ModalHolder from '../Modal/ModalHolder.vue';
import { createMessageService } from '../Message/service';
import MessageHolder from '../Message/MessageHolder.vue';
import { createNotificationService } from '../Notification/service';
import NotificationHolder from '../Notification/NotificationHolder.vue';

defineOptions({ name: 'KApp' });

interface KAppProps {
  /** 根标签；`false` = 不渲染包裹层（仅上下文，字体/颜色 token 需由其它容器承接） */
  component?: string | Component | false;
}

const props = withDefaults(defineProps<KAppProps>(), {
  component: 'div',
});

const root = ref<HTMLElement>();

/* P2b 反馈批实例 API：队列宿主随 KApp 挂载（Holder 内部 Teleport 出口，自管计时器） */
const modalSvc = createModalService();
const messageSvc = createMessageService();
const notificationSvc = createNotificationService();
provideKApp({
  root,
  modal: modalSvc.api,
  message: messageSvc.api,
  notification: notificationSvc.api,
});
</script>

<template>
  <component v-if="props.component !== false" :is="props.component" ref="root" class="k-app" data-part="root">
    <slot />
  </component>
  <slot v-else />
  <ModalHolder :svc="modalSvc" />
  <MessageHolder :svc="messageSvc" />
  <NotificationHolder :svc="notificationSvc" />
</template>

<style>
/* 应用根：token 基线落到 DOM 继承链（antd App 同款职责——不装它，文字走宿主默认样式） */
.k-app {
  color: var(--k-color-text);
  font-family: var(--k-font-family);
  font-size: var(--k-font-size);
  line-height: var(--k-line-height);
}
</style>
