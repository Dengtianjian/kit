# K UI 组件待办

> 更新：2026-11-21
> 现状：P1–P5 规格内 63 个组件已全部落地；以下为对照 Ant Design、Ant Design Mobile、Vant、Nuxt UI 后的增量待办。
> 勾选状态以 `.ai/COMPONENTS.md` 为准。

## P6 基础补齐

- [ ] `KAvatar` / `KAvatarGroup`
- [ ] `KList` / `KCell`
- [ ] `KCollapse`
- [ ] `KDescriptions`
- [ ] `KSegmented` / `KToggleGroup`
- [ ] `KTree`
- [ ] `KFieldGroup`
- [ ] `KInputTags`

## P7 数据与导航

- [ ] `KCalendar`
- [ ] `KTimeline`
- [ ] `KStatistic`
- [ ] `KImage`
- [ ] `KCarousel`
- [ ] `KPinInput`
- [ ] `KChart`（外部图表库适配）
- [ ] `KCommandPalette`
- [ ] `KNavigationMenu`

## P8 增强件

- [ ] `KContextMenu`
- [ ] `KScrollArea`
- [ ] `KKbd`
- [ ] `KUser`
- [ ] `KBanner`
- [ ] `KMarquee`
- [ ] `KSplitter`
- [ ] `KQRCode`
- [ ] `KWatermark`
- [ ] `KMasonry`
- [ ] `KTour`
- [ ] `KFloatButton`
- [ ] `KBorderBeam`
- [ ] `KListbox`

## P9 移动端专项

- [ ] `KActionSheet` / `KShareSheet`
- [ ] `KPicker` / `KPickerView`
- [ ] `KPullToRefresh`
- [ ] `KInfiniteScroll`
- [ ] `KSwipeCell` / `KSwipeAction`
- [ ] `KSearchBar`
- [ ] `KNoticeBar`
- [ ] `KIndexBar` / `KIndexAnchor`
- [ ] `KSideBar`
- [ ] `KNumberKeyboard` / `KPasscodeInput` / `KPasswordInput`
- [ ] `KFloatingBubble`
- [ ] `KFloatingPanel`
- [ ] `KSubmitBar` / `KActionBar`
- [ ] `KCountDown` / `KRollingText`
- [ ] `KPopup` / `KCenterPopup`
- [ ] `KSafeArea`
- [ ] `KSignature`

## 每件落地标准

- [ ] Props / Slots / Events 与 `classNames` / `styles` 部件齐全
- [ ] token 化样式，亮暗与 sm/md/lg 档可用
- [ ] 键盘、焦点、ARIA 与 disabled 态
- [ ] 文档页 + 演示 + 组件索引 / 侧边栏同步
- [ ] 数据/交互类补 DOM 回归测试
- [ ] 真实浏览器验收交互与视觉

## 暂不纳入基础库

- [ ] Nuxt UI `Page*` / `Pricing*` / `Blog*` / `AuthForm` 页面区块
- [ ] Nuxt UI `Dashboard*` / `Chat*` / `Editor*` / `Content*` 领域套件
- [ ] Nuxt UI `ColorMode*` / `LocaleSelect`（转为主题 / i18n 能力项）
- [ ] Vant `Address*` / `Coupon*` / `Contact*` / `Area` / `Barrage` 业务垂直件