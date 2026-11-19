/**
 * K UI 组件库入口（kit/vue/ui）。
 *
 * 业务侧日常使用走 KResolver 按需导入（见 resolver.ts），本 barrel 只服务
 * 全量引用与类型消费；新增组件时同步 index 与 resolver 的 GROUP_FILE 即可。
 */

/* -------------------------------------- 主题（纯函数，零 vue 依赖） -------------------------------------- */

export { defaultSeed, createTheme, mixOklab, darkSeedVariant, generateRamp, getColorPalette } from "./themes";
export type { KSeedToken, ThemeConfig, ThemePlatformConfig, ThemeResult, TokenValue } from "./themes";

/* -------------------------------------- 组合式与工具 -------------------------------------- */

export { useBreakpoint, getSharedBreakpoint, DEFAULT_BREAKPOINTS } from "./composables/useBreakpoint";
export type { KBreakpoint, KBreakpointState } from "./composables/useBreakpoint";
export {
  useResponsiveValue,
  parseResponsiveString,
  resolveResponsiveValue,
  isResponsiveString,
  isResponsiveMap,
} from "./composables/useResponsiveValue";
export type { KResponsiveMap, KResponsiveValue } from "./composables/useResponsiveValue";
export { provideKConfig, useKConfig, useProps } from "./composables/useKConfig";
export type { KConfig, KConfigInput, KComponentDefaults } from "./composables/useKConfig";
export { provideKApp, useKApp } from "./composables/useKApp";
export type { KAppContext } from "./composables/useKApp";
export type { KSpaceSize } from "./utils/size";
export { KResolver } from "./resolver";
export type { KResolverResult } from "./resolver";

/* -------------------------------------- 组件 -------------------------------------- */

export { default as KIcon } from "./components/Icon/Icon.vue";
export { default as KButton } from "./components/Button/Button.vue";
export { default as KButtonGroup } from "./components/Button/ButtonGroup.vue";
export { default as KSpace } from "./components/Space/Space.vue";
export { default as KControlGroup } from "./components/ControlGroup/ControlGroup.vue";
export { default as KControlGroupItem } from "./components/ControlGroup/ControlGroupItem.vue";
export { default as KFlex } from "./components/Flex/Flex.vue";
export { default as KDivider } from "./components/Divider/Divider.vue";
export { default as KTitle } from "./components/Typography/Title.vue";
export { default as KParagraph } from "./components/Typography/Paragraph.vue";
export { default as KText } from "./components/Typography/Text.vue";
export { default as KLink } from "./components/Link/Link.vue";
export { default as KRow } from "./components/Grid/Row.vue";
export { default as KCol } from "./components/Grid/Col.vue";
export { default as KLayout } from "./components/Layout/Layout.vue";
export { default as KLayoutHeader } from "./components/Layout/Header.vue";
export { default as KLayoutSider } from "./components/Layout/Sider.vue";
export { default as KLayoutContent } from "./components/Layout/Content.vue";
export { default as KLayoutFooter } from "./components/Layout/Footer.vue";
export { default as KConfigProvider } from "./components/ConfigProvider/ConfigProvider.vue";
export { default as KApp } from "./components/App/App.vue";
export { default as KInput } from "./components/Input/Input.vue";
export { default as KInputNumber } from "./components/InputNumber/InputNumber.vue";
export { default as KSelect } from "./components/Select/Select.vue";
export { default as KCheckbox } from "./components/Checkbox/Checkbox.vue";
export { default as KCheckboxGroup } from "./components/Checkbox/CheckboxGroup.vue";
export { default as KRadio } from "./components/Radio/Radio.vue";
export { default as KRadioGroup } from "./components/Radio/RadioGroup.vue";
export { default as KSwitch } from "./components/Switch/Switch.vue";
export { default as KForm } from "./components/Form/Form.vue";
export { default as KFormItem } from "./components/Form/FormItem.vue";
export { default as KTooltip } from "./components/Tooltip/Tooltip.vue";
export { default as KPopover } from "./components/Popover/Popover.vue";
export { default as KPopconfirm } from "./components/Popconfirm/Popconfirm.vue";
export { default as KModal } from "./components/Modal/Modal.vue";
export { default as KAlert } from "./components/Alert/Alert.vue";
export { default as KSpin } from "./components/Spin/Spin.vue";
export { default as KEmpty } from "./components/Empty/Empty.vue";
export { default as KPagination } from "./components/Pagination/Pagination.vue";
export { default as KNotification } from "./components/Notification/Notification.vue";
export { default as KDatePicker } from "./components/DatePicker/DatePicker.vue";
export { default as KDateRangePicker } from "./components/DateRangePicker/DateRangePicker.vue";
export { default as KUpload } from "./components/Upload/Upload.vue";
export { default as KImageCropper } from "./components/ImageCropper/ImageCropper.vue";
export { default as KSortable } from "./components/Sortable/Sortable.vue";
export type {
  KSortableOrientation,
  KSortableKey,
  KSortableItemKey,
  KSortableMoveInfo,
  KSortableRenderScope,
} from "./components/Sortable/types";
export { default as KPreview } from "./components/Preview/Preview.vue";
export type { KSelectOption, KSelectGroup, KSelectRenderScope } from "./components/Select/Select.vue";
export type { KDividerRenderScope } from "./components/Divider/Divider.vue";
export type { KTooltipRenderScope } from "./components/Tooltip/Tooltip.vue";
export type { KSpaceRenderScope } from "./components/Space/Space.vue";
export type { KFlexRenderScope } from "./components/Flex/Flex.vue";
export type { KRowRenderScope } from "./components/Grid/Row.vue";
export type { KColRenderScope } from "./components/Grid/Col.vue";
export type { KLayoutRenderScope } from "./components/Layout/Layout.vue";
export type { KLayoutHeaderRenderScope } from "./components/Layout/Header.vue";
export type { KLayoutSiderRenderScope } from "./components/Layout/Sider.vue";
export type { KLayoutContentRenderScope } from "./components/Layout/Content.vue";
export type { KLayoutFooterRenderScope } from "./components/Layout/Footer.vue";
export type { KTitleRenderScope } from "./components/Typography/Title.vue";
export type { KTextRenderScope } from "./components/Typography/Text.vue";
export type { KParagraphRenderScope } from "./components/Typography/Paragraph.vue";
export type { KIconRenderScope } from "./components/Icon/Icon.vue";
export type { KButtonGroupRenderScope } from "./components/Button/ButtonGroup.vue";
export type { KButtonRenderScope } from "./components/Button/Button.vue";
export type { KLinkRenderScope } from "./components/Link/Link.vue";
export type {
  KSwitchRenderScope,
  KSwitchLabelPosition,
} from "./components/Switch/Switch.vue";
export type { KCheckboxRenderScope } from "./components/Checkbox/Checkbox.vue";
export type { KCheckboxGroupRenderScope } from "./components/Checkbox/CheckboxGroup.vue";
export type { KRadioRenderScope } from "./components/Radio/Radio.vue";
export type { KRadioGroupRenderScope } from "./components/Radio/RadioGroup.vue";
export type { KInputRenderScope } from "./components/Input/Input.vue";
export type { KInputNumberRenderScope } from "./components/InputNumber/InputNumber.vue";
export type { KFormRenderScope } from "./components/Form/Form.vue";
export type { KFormItemRenderScope } from "./components/Form/FormItem.vue";
export type { KAlertRenderScope } from "./components/Alert/Alert.vue";
export type { KSpinRenderScope } from "./components/Spin/Spin.vue";
export type { KPopoverRenderScope } from "./components/Popover/Popover.vue";
export type { KPopconfirmRenderScope } from "./components/Popconfirm/Popconfirm.vue";
export type { KModalRenderScope } from "./components/Modal/Modal.vue";
export type { KNotificationRenderScope } from "./components/Notification/Notification.vue";
export type {
  KDatePickerRenderScope,
  KDatePickerNavigateDir,
  KDatePickerPreset,
  KDatePickerDisabledTime,
} from "./components/DatePicker/DatePicker.vue";
export type { KDateRange } from "./components/DateRangePicker/DateRangePicker.vue";
export type { KPickerMode, KDateViewLevel, KDateCell } from "./utils/date";
export type {
  KUploadFile,
  KUploadFileItem,
  KUploadFileStatus,
  KUploadListType,
  KUploadChangeReason,
  KUploadRenderScope,
  KUploadUpload,
  KUploadRequestOptions,
  KUploadRequestResult,
  KUploadCompressOptions,
  KUploadChunkInfo,
  KUploadMergeOptions,
  KUploadMerge,
  KUploadCropOptions,
  KUploadRemoveHook,
} from "./components/Upload/Upload.vue";
export type {
  KPreviewItem,
  KPreviewItemType,
  KPreviewRenderScope,
  KPreviewRenderer,
  KPreviewRendererContext,
} from "./components/Preview/Preview.vue";
export type { KRenderFn, KOnPack } from "./composables/useCustomRender";
export { onProps } from "./composables/useCustomRender";
export type { KCheckboxOption, KCheckboxOptionInput } from "./components/Checkbox/types";
export type { KRadioOption, KRadioOptionInput } from "./components/Radio/context";
export type { KOverlayPlacement } from "./utils/overlay";
export type {
  KModalApi,
  KModalFuncProps,
  KModalHandle,
  KModalPlacement,
} from "./components/Modal/service";
export type {
  KMessageApi,
  KMessageConfig,
  KMessageHandle,
  KMessageType,
} from "./components/Message/service";
export type {
  KNotificationApi,
  KNotificationClosable,
  KNotificationConfig,
  KNotificationGlobalConfig,
  KNotificationHandle,
  KNotificationPlacement,
  KNotificationSemanticPart,
  KNotificationType,
} from "./components/Notification/service";
