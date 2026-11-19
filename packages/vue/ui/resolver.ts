/**
 * unplugin-vue-components / unplugin-auto-import 解析器：按需单文件，永不指向 barrel。
 *
 * 用法（业务 vite.config）：
 *   Components({ resolvers: [KResolver()] })
 * 打包产物只含用到的 `<Name>.vue` 单文件；themes 侧函数走 kit/vue/ui 具名导入，
 * 由 ESM tree-shaking 处理（无副作用标记见 package.json sideEffects）。
 */

export interface KResolverResult {
  name: string;
  as?: string;
  from: string;
}

/** 一组多件的目录映射；其余按 KButton → components/Button/Button.vue 机械规则解析 */
const GROUP_FILE: Record<string, string> = {
  KButtonGroup: 'Button/ButtonGroup',
  KTitle: 'Typography/Title',
  KParagraph: 'Typography/Paragraph',
  KText: 'Typography/Text',
  KRow: 'Grid/Row',
  KCol: 'Grid/Col',
  KLayout: 'Layout/Layout',
  KLayoutHeader: 'Layout/Header',
  KLayoutSider: 'Layout/Sider',
  KLayoutContent: 'Layout/Content',
  KLayoutFooter: 'Layout/Footer',
  KConfigProvider: 'ConfigProvider/ConfigProvider',
  KCheckboxGroup: 'Checkbox/CheckboxGroup',
  KRadioGroup: 'Radio/RadioGroup',
  KFormItem: 'Form/FormItem',
  KBreadcrumbItem: 'Breadcrumb/BreadcrumbItem',
  KStep: 'Steps/Step',
  KTabPane: 'Tabs/TabPane',
};

export function KResolver(): (name: string) => KResolverResult | undefined {
  return (name: string) => {
    // 仅 K + 大写字母开头的组件名参与（KButton、KRow…）
    if (!/^K[A-Z]/.test(name)) return undefined;
    // KButton → Button/Button.vue；分组件直接用表内相对路径
    const path = GROUP_FILE[name] ?? `${name.slice(1)}/${name.slice(1)}`;
    return { name: "default", as: name, from: `kit/vue/ui/components/${path}.vue` };
  };
}
