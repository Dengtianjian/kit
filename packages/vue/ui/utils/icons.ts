/**
 * 内建图标 path 表（16 viewBox，stroke 描边 + currentColor，linecap round）：
 * Message/Notification/Alert/Modal 反馈件共用，零外部图标依赖（与 Input 清除图标同路线，
 * 图标库 peer 评估结论见 docs components/index.md P2b 附注）。
 * 用法：<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path :d="K_ICON_PATHS.info"/></svg>
 */

export type KIconName = 'close' | 'check' | 'info' | 'alert' | 'error';

export const K_ICON_PATHS: Record<KIconName, string> = {
  close: 'M4.4 4.4l7.2 7.2M11.6 4.4l-7.2 7.2',
  check: 'M3.6 8.4l2.9 2.9 5.9-6.6',
  info: 'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM8 7.3v3.8M8 4.9l.02 0',
  alert: 'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM8 4.8v4M8 11.1l.02 0',
  error: 'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM5.7 5.7l4.6 4.6M10.3 5.7l-4.6 4.6',
};
