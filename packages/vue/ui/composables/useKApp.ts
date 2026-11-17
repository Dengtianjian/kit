import { inject, provide } from 'vue';
import type { InjectionKey, Ref } from 'vue';
import type { KModalApi } from '../components/Modal/service';
import type { KMessageApi } from '../components/Message/service';
import type { KNotificationApi } from '../components/Notification/service';

/**
 * KApp 注入面（规格 docs site /vue/ui/components/app.md）：
 * 对标 antd `<App>` + useApp()。P1 只提供应用根元素引用（全局反馈组件的挂载宿主），
 * P2b 反馈批把 message/notification/modal 实例 API 挂进同一 context（拍板③：只走实例，无全局静态）。
 */

export interface KAppContext {
  /** 应用根元素；component=false 或未挂 KApp 时为 undefined，消费方回落 document.body */
  root: Ref<HTMLElement | undefined>;
  /** 实例 API（随 KApp 生命周期存活）；未挂 KApp 时为 undefined */
  message?: KMessageApi;
  notification?: KNotificationApi;
  modal?: KModalApi;
}

const K_APP_KEY: InjectionKey<KAppContext> = Symbol('k-app');

export function provideKApp(ctx: KAppContext): KAppContext {
  provide(K_APP_KEY, ctx);
  return ctx;
}

export function useKApp(): KAppContext | undefined {
  return inject(K_APP_KEY, undefined);
}
