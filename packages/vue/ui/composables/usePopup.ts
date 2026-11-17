import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { CSSProperties, Ref } from 'vue';
import { useKConfig } from './useKConfig';
import { computeOverlayPosition } from '../utils/overlay';
import type { KOverlayPlacement } from '../utils/overlay';

/**
 * 弹层三件套（Tooltip/Popover/Popconfirm）共用的内部基座，不出 index 门面。
 * Select 消费 usePopupFrame 共享容器语义，宽度贴触发器等专属语义自留。
 */

/** 出口容器契约（ConfigProvider 职责④）：popupContainer 缺省 body；出口节点带 scopeClass + scheme */
export function usePopupHost(extraClasses?: () => Array<string | false | undefined>) {
  const config = useKConfig();
  const teleportTarget = computed(() => {
    const c = config?.popupContainer.value;
    if (!c) return 'body';
    // 容器函数可能读模板 ref：挂载瞬间为 null，兜底 body，ref 就位后响应式切回；
    // typeof 判别而非 instanceof HTMLElement（SSR 无该全局）
    return (typeof c === 'function' ? c() : c) ?? 'body';
  });
  const popupClasses = computed(() => [
    ...(extraClasses?.() ?? []),
    // scoped Provider 弹层出口必须自带作用域类，否则 token 变量断链
    config?.scopeClass.value ? 'k-config-provider' : '',
    config?.scopeClass.value ?? '',
  ]);
  const popupTheme = computed(() => {
    const s = config?.scheme.value;
    return s && s !== 'auto' ? s : undefined;
  });
  return { teleportTarget, popupClasses, popupTheme };
}

/**
 * 容器语义（2026-11-17 改判，antd getPopupContainer 同款）：target ≠ body 时弹层 absolute 进容器文档流
 * （随内容滚动、被容器 overflow 裁切），坐标 = 视口坐标 − 容器 border-box 原点 − border + 容器 scroll；
 * target = body 保持 fixed + 全局 scroll 跟随。static 容器自动补 relative（absolute 含块前提）。
 */
export function usePopupFrame(target: Ref<HTMLElement | string>) {
  const mode = computed<'fixed' | 'absolute'>(() =>
    target.value instanceof HTMLElement ? 'absolute' : 'fixed',
  );
  function localPoint(top: number, left: number) {
    const t = target.value;
    if (!(t instanceof HTMLElement)) return { top, left };
    const r = t.getBoundingClientRect();
    const cs = getComputedStyle(t);
    return {
      top: top - r.top - parseFloat(cs.borderTopWidth) + t.scrollTop,
      left: left - r.left - parseFloat(cs.borderLeftWidth) + t.scrollLeft,
    };
  }
  function ensurePositioned() {
    const t = target.value;
    if (t instanceof HTMLElement && getComputedStyle(t).position === 'static') {
      t.style.position = 'relative';
    }
  }
  return { mode, localPoint, ensurePositioned };
}

export function useOverlayPosition(opts: {
  anchor: Ref<HTMLElement | null | undefined>;
  popup: Ref<HTMLElement | null | undefined>;
  visible: Ref<boolean>;
  placement: () => KOverlayPlacement;
  /** 出口容器：HTMLElement = absolute 进容器文档流；'body' = fixed + scroll 跟随 */
  target: Ref<HTMLElement | string>;
  gap?: number;
  /** 箭头限位：距弹层角的最小保留距离（箭头半盒 + 圆角余量），JS 端 clamp（CSS clamp 混百分比在 left/top 上不生效） */
  arrowKeepout?: number;
}) {
  const frame = usePopupFrame(opts.target);
  const popupStyle = ref<CSSProperties>({ position: 'fixed', visibility: 'hidden' });
  const actualPlacement = ref<KOverlayPlacement>(opts.placement());

  function place() {
    const a = opts.anchor.value?.getBoundingClientRect();
    const p = opts.popup.value;
    if (!a || !p) return;
    const rect = computeOverlayPosition(
      a,
      { width: p.offsetWidth, height: p.offsetHeight },
      opts.placement(),
      opts.gap ?? 4,
      { width: window.innerWidth, height: window.innerHeight },
    );
    actualPlacement.value = rect.placement;
    // 箭头指向锚点中心：主轴偏移（弹层本地坐标 px），限位不越弹层边角
    const side = /^(top|bottom|left|right)/.exec(rect.placement)![1];
    const isX = side === 'top' || side === 'bottom';
    let offset = isX
      ? Math.round(a.left + a.width / 2 - rect.left)
      : Math.round(a.top + a.height / 2 - rect.top);
    const k = opts.arrowKeepout;
    if (k) {
      const len = isX ? p.offsetWidth : p.offsetHeight;
      offset = Math.min(Math.max(offset, k), len - k);
    }
    frame.ensurePositioned();
    const point = frame.localPoint(rect.top, rect.left);
    popupStyle.value = {
      position: frame.mode.value,
      top: `${Math.round(point.top)}px`,
      left: `${Math.round(point.left)}px`,
      visibility: 'visible',
      '--k-overlay-arrow-offset': `${offset}px`,
    } as CSSProperties;
  }

  function reposition() {
    if (opts.visible.value) place();
  }
  function attach() {
    // absolute 模式弹层随容器内容滚，无需 scroll 跟随；resize 两模式都跟（翻转依赖视口）
    if (frame.mode.value === 'fixed') window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
  }
  function detach() {
    window.removeEventListener('scroll', reposition, true);
    window.removeEventListener('resize', reposition);
  }

  watch(opts.visible, async (v) => {
    if (v) {
      popupStyle.value = { position: frame.mode.value, visibility: 'hidden' }; // 两遍渲染：先隐藏测量再落位
      attach();
      await nextTick();
      place();
    } else {
      detach();
    }
  });
  onBeforeUnmount(detach);

  return { popupStyle, actualPlacement, place };
}

/** 点弹层外关闭（document pointerdown capture，与 Select 同款路径）+ Esc */
export function usePopupDismiss(active: Ref<boolean>, close: () => void, zones: () => (HTMLElement | null | undefined)[]) {
  function onPointerdown(e: PointerEvent) {
    if (!active.value) return;
    const t = e.target as Node;
    if (zones().some((z) => z?.contains(t))) return;
    close();
  }
  function onKeydown(e: KeyboardEvent) {
    if (active.value && e.key === 'Escape') close();
  }
  watch(active, (v) => {
    document.removeEventListener('pointerdown', onPointerdown, true);
    document.removeEventListener('keydown', onKeydown);
    if (v) {
      document.addEventListener('pointerdown', onPointerdown, true);
      document.addEventListener('keydown', onKeydown);
    }
  });
  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onPointerdown, true);
    document.removeEventListener('keydown', onKeydown);
  });
}
