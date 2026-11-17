import { Fragment, h } from 'vue';

/**
 * 内部工具：把 `string | VNode` 型 prop（Modal title/content、Message content…）渲染成节点。
 * h(Fragment, [node]) 对字符串与 VNode 都成立，模板侧 `<component :is="KNode" :node="x" />`。
 */
export function KNode(props: { node: unknown }) {
  return h(Fragment, [props.node]);
}
