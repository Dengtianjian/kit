/**
 * 模块级「最近一次 pointerdown」记录器：KModal 原点缩放的默认触发源通道。
 * 显式 `source`（prop / 实例 API 配置）优先于本记录；保鲜窗口防止
 * 程序化打开（定时器/路由回调）把陈旧点击位置当原点。
 */
let lastEl: Element | null = null;
let lastTs = 0;
let installed = false;

export function installPointerRecorder() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener(
    'pointerdown',
    (e) => {
      lastEl = e.target as Element;
      lastTs = Date.now();
    },
    true,
  );
}

export function getLastPointer(maxAgeMs = 1500): Element | null {
  return Date.now() - lastTs <= maxAgeMs ? lastEl : null;
}
