/**
 * Seed 全表（唯一输入面）——与 css/theme.css 的 Seed 区逐值对齐（token 规格 §2）。
 * 这里是 JS 侧的缺省值参照：Provider 差量注入、设计器初值、单测基线共用。
 */
export interface KSeedToken {
  colorPrimary: string;
  colorSuccess: string;
  colorWarning: string;
  colorError: string;
  /** 未设则跟随主色（CSS 侧以 var 引用实现，JS 侧显式给同值） */
  colorInfo: string;
  colorLink: string;
  colorTextBase: string;
  colorTextBaseDark: string;
  colorBgBase: string;
  colorBgBaseDark: string;
  fontFamily: string;
  fontFamilyCode: string;
  /** 无单位，CSS 表达式内乘 1px */
  fontSize: number;
  lineHeight: number;
  borderRadius: number;
  lineWidth: number;
  sizeUnit: number;
  sizeStep: number;
  controlHeight: number;
  /** 秒 */
  motionUnit: number;
  zIndexPopupBase: number;
  /** 中性色染色比，0 = 纯灰 */
  neutralTint: number;
}

export const defaultSeed: KSeedToken = {
  colorPrimary: '#1677ff',
  colorSuccess: '#52c41a',
  colorWarning: '#faad14',
  colorError: '#ff4d4f',
  colorInfo: '#1677ff',
  colorLink: '#1677ff',
  colorTextBase: '#000000',
  colorTextBaseDark: '#f5f5f5',
  colorBgBase: '#ffffff',
  colorBgBaseDark: '#141414',
  fontFamily:
    'system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif',
  fontFamilyCode: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  fontSize: 14,
  lineHeight: 1.5714,
  borderRadius: 6,
  lineWidth: 1,
  sizeUnit: 4,
  sizeStep: 4,
  controlHeight: 34,
  motionUnit: 0.1,
  zIndexPopupBase: 1000,
  neutralTint: 0.02,
};
