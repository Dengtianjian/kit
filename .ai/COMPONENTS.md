# K UI 组件对照清单

> 更新：2026-11-21
> kit 已落地 63 个组件；另有 31 个通用缺口、17 个移动端专项缺口。
> `[x]` = kit 已落地且有文档页；`[ ]` = 未落地。

## 参考组件库

- Ant Design `6.7.1`
- Ant Design Mobile `5.43.0`
- Vant `4.10.2`
- Nuxt UI `4.13.0`

## 布局与主题

- [x] `KApp` — App（Ant Design、Nuxt UI）
- [x] `KConfigProvider` — ConfigProvider / Theme（四套）
- [x] `KSpace` — Space（Ant Design、Ant Design Mobile、Vant）
- [x] `KFlex` — Flex（Ant Design）
- [x] `KGrid`（KRow / KCol）— Grid / Row / Col（四套）
- [x] `KLayout`（Header / Sider / Content / Footer）— Layout（Ant Design、Nuxt UI）
- [x] `KDivider` — Divider / Separator（四套）
- [x] `KTypography` — Typography / TextEllipsis（Ant Design、Vant）
- [x] `KLink` — Link（Ant Design、Nuxt UI）
- [ ] `KFieldGroup` — FieldGroup（Nuxt UI）；`KControlGroup` 只是视觉拼接，不等价
- [ ] `KScrollArea` — ScrollArea（Nuxt UI）
- [ ] `KSplitter` — Splitter（Ant Design、Nuxt UI）

## 基础展示

- [x] `KButton` — Button（四套）
- [x] `KIcon` — Icon（四套）
- [x] `KTag` — Tag（Ant Design、Ant Design Mobile、Vant）；Nuxt UI Chip 可组合覆盖
- [x] `KBadge` — Badge（四套）
- [x] `KCard` — Card（四套）
- [x] `KEmpty` — Empty（四套）
- [x] `KSkeleton` — Skeleton（四套）
- [x] `KProgress` — Progress / ProgressBar / ProgressCircle（四套）
- [x] `KResult` — Result / Error / ErrorBlock（Ant Design、Ant Design Mobile）
- [x] `KImageCropper` — 无直接参考（kit 增强件）
- [x] `KPreview` — ImageViewer / ImagePreview（Ant Design Mobile、Vant）
- [ ] `KAvatar`、`KAvatarGroup` — Avatar / AvatarGroup（Ant Design、Ant Design Mobile、Nuxt UI）
- [ ] `KList`、`KCell` — List / Cell / CellGroup / CheckList（四套中的前三套）
- [ ] `KCollapse` — Collapse / Accordion / Collapsible（四套）
- [ ] `KDescriptions` — Descriptions（Ant Design）
- [ ] `KTree` — Tree（Ant Design、Nuxt UI）
- [ ] `KCalendar` — Calendar（四套）
- [ ] `KTimeline` — Timeline（Ant Design、Nuxt UI）
- [ ] `KStatistic` — Statistic（Ant Design）
- [ ] `KImage` — Image（Ant Design、Ant Design Mobile、Vant）
- [ ] `KCarousel` — Carousel / Swiper（四套）
- [ ] `KQRCode` — QRCode（Ant Design）
- [ ] `KWatermark` — Watermark（Ant Design、Ant Design Mobile、Vant）
- [ ] `KMasonry` — Masonry（Ant Design）
- [ ] `KBorderBeam` — BorderBeam（Ant Design）
- [ ] `KMarquee` — Marquee（Nuxt UI）
- [ ] `KUser` — User（Nuxt UI）；可由 Avatar + Typography 组合
- [ ] `KBanner` — Banner（Nuxt UI）；可由 Alert 变体覆盖
- [ ] `KKbd` — Kbd（Nuxt UI）
- [ ] `KChart` — Chart（Nuxt UI）；需接外部图表库
- [ ] `KFloatButton` — FloatButton（Ant Design、Ant Design Mobile）

## 表单与录入

- [x] `KInput` — Input / Textarea（四套）
- [x] `KInputNumber` — InputNumber / Stepper（四套）
- [x] `KSelect` — Select / SelectMenu / InputMenu（四套）；Listbox 场景部分覆盖
- [x] `KControlGroup` — Space.Compact（Ant Design）；视觉拼接件
- [x] `KCheckbox` — Checkbox / CheckboxGroup（四套）
- [x] `KRadio` — Radio / RadioGroup（四套）
- [x] `KSwitch` — Switch / Toggle（四套）
- [x] `KForm` — Form / FormField（四套）
- [x] `KDatePicker` — DatePicker / CalendarPicker（四套）
- [x] `KDateRangePicker` — RangePicker（Ant Design）
- [x] `KTimePicker` — TimePicker / InputTime（四套）
- [x] `KCascader` — Cascader / CascadePicker（四套）
- [x] `KTreeSelect` — TreeSelect（四套）
- [x] `KColorPicker` — ColorPicker（四套）
- [x] `KUpload` — Upload / Uploader / FileUpload / ImageUploader（四套）
- [x] `KMentions` — Mentions（Ant Design、Vant）
- [x] `KAutoComplete` — AutoComplete（Ant Design）；InputMenu 部分覆盖
- [x] `KRate` — Rate / InputRating（四套）
- [x] `KSlider` — Slider（四套）
- [x] `KTransfer` — Transfer（Ant Design）
- [x] `KSortable` — 无直接参考（kit 交互工具）
- [ ] `KSegmented`、`KToggleGroup` — Segmented / ToggleGroup / Selector（Ant Design、Ant Design Mobile、Nuxt UI）
- [ ] `KInputTags` — InputTags（Nuxt UI）；`KSelect tag` 部分覆盖
- [ ] `KPinInput` — PinInput / PasscodeInput / PasswordInput（Ant Design Mobile、Vant、Nuxt UI）
- [ ] `KListbox` — Listbox（Nuxt UI）；无触发器 headless 选择基座

## 反馈与浮层

- [x] `KTooltip` — Tooltip（四套）
- [x] `KPopover` — Popover（四套）
- [x] `KPopconfirm` — Popconfirm（Ant Design）
- [x] `KModal` — Modal / Dialog（四套）
- [x] `KMessage` — Message / Toast（四套）
- [x] `KNotification` — Notification / Notify（Ant Design、Vant）
- [x] `KAlert` — Alert（四套）
- [x] `KSpin` — Spin / Loading / DotLoading（四套）
- [x] `KDrawer` — Drawer / Slideover（Ant Design、Nuxt UI）
- [ ] `KCommandPalette` — CommandPalette（Nuxt UI）
- [ ] `KNavigationMenu` — NavigationMenu（Nuxt UI）
- [ ] `KContextMenu` — ContextMenu（Nuxt UI）
- [ ] `KTour` — Tour（Ant Design）

## 导航与滚动辅助

- [x] `KBreadcrumb` — Breadcrumb（四套）
- [x] `KSteps` — Steps / Stepper（四套）
- [x] `KTabs` — Tabs / CapsuleTabs / JumboTabs（四套）
- [x] `KDropdown` — Dropdown / DropdownMenu（Ant Design、Nuxt UI、Vant 部分）
- [x] `KMenu` — Menu / Sidebar（Ant Design、Nuxt UI、Vant 部分）
- [x] `KAnchor` — Anchor（Ant Design、Nuxt UI）
- [x] `KBackTop` — BackTop（Ant Design、Vant）
- [x] `KAffix` — Affix / Sticky（Ant Design、Vant）
- [x] `KNavBar` — NavBar（Ant Design Mobile、Vant）
- [x] `KTabBar` — TabBar / Tabbar（Ant Design Mobile、Vant）

## 数据展示

- [x] `KTable` — Table（四套）
- [x] `KPagination` — Pagination（四套）
- [x] `KVirtualList` — VirtualList / Listy（kit、Ant Design）

## 移动端专项

- [ ] `KActionSheet`、`KShareSheet` — ActionSheet / ShareSheet（Ant Design Mobile、Vant）
- [ ] `KPicker`、`KPickerView` — Picker / PickerView / PickerGroup（Ant Design Mobile、Vant）
- [ ] `KPullToRefresh` — PullToRefresh / PullRefresh（Ant Design Mobile、Vant）
- [ ] `KInfiniteScroll` — InfiniteScroll（Ant Design Mobile）
- [ ] `KSwipeCell`、`KSwipeAction` — SwipeCell / SwipeAction / Swipe（Ant Design Mobile、Vant）
- [ ] `KSearchBar` — SearchBar / Search（Ant Design Mobile、Vant）
- [ ] `KNoticeBar` — NoticeBar（Ant Design Mobile、Vant）
- [ ] `KIndexBar`、`KIndexAnchor` — IndexBar / IndexAnchor（Ant Design Mobile、Vant）
- [ ] `KSideBar` — SideBar（Ant Design Mobile、Vant）
- [ ] `KNumberKeyboard`、`KPasscodeInput`、`KPasswordInput` — NumberKeyboard / PasscodeInput / PasswordInput（Ant Design Mobile、Vant）
- [ ] `KFloatingBubble` — FloatingBubble（Ant Design Mobile、Vant）
- [ ] `KFloatingPanel` — FloatingPanel（Ant Design Mobile、Vant）
- [ ] `KSubmitBar`、`KActionBar` — SubmitBar / ActionBar（Vant）
- [ ] `KCountDown`、`KRollingText` — CountDown / RollingText（Vant）
- [ ] `KPopup`、`KCenterPopup` — Popup / CenterPopup（Ant Design Mobile、Vant）
- [ ] `KSafeArea` — SafeArea（Ant Design Mobile）
- [ ] `KSignature` — Signature（Vant）

## 已覆盖、不单列

Toast / Notify / Dialog / Loading / DotLoading / Circle / Field / Uploader / ImageViewer / Sticky / DropdownMenu / Listy / Ellipsis / Footer / Container / Main / Header / Separator / Theme / Toggle / InputRating / FileUpload / Textarea / SelectMenu / InputMenu / Slideover / ProgressGroup 均已有直接组件或组合覆盖。

## 不纳入基础库

- Nuxt UI 页面级套件：`Page*`、`Pricing*`、`Blog*`、`AuthForm`
- Nuxt UI 领域套件：`Dashboard*`、`Chat*`、`Editor*`、`Content*`
- Nuxt UI 集成件：`ColorMode*`、`LocaleSelect`（主题 / i18n 能力，另立能力项）
- Vant 业务垂直件：`Address*`、`Coupon*`、`Contact*`、`Area`、`Barrage`