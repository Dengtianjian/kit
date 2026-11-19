<template>
  <template v-if="hasCustomRender">
    <slot v-if="$slots.render" name="render" v-bind="renderScope" />
    <component v-else :is="renderPropOutlet" />
  </template>
  <template v-else>
    <div
      ref="rootEl"
      v-bind="rootAttrs"
      :class="[rootClasses, classNames?.root]"
      :style="styles?.root"
      v-on="rootOn"
    >
      <!-- 卡片墙（方/圆）：file tiles + 添加 tile -->
      <TransitionGroup v-if="listType === 'picture-card' || listType === 'picture-circle'" tag="div" name="k-upload-card" class="k-upload__cards">
        <div
          v-for="f in list"
          :key="f.uid"
          class="k-upload__card"
          :class="classNames?.item"
          :style="styles?.item"
          v-bind="itemAttrs(f)"
          v-on="itemDragOn(f)"
        >
          <img
            v-if="thumbOf(f)"
            class="k-upload__card-img"
            :src="thumbOf(f)"
            :alt="f.name"
            :style="styles?.thumb"
            v-on="thumbOn(f)"
          />
          <span v-else class="k-upload__card-ext" :style="styles?.thumb">{{ extOf(f) }}</span>
          <span
            v-if="showActions || clickToUpload"
            class="k-upload__card-overlay"
            :class="classNames?.actions"
            :style="styles?.actions"
            v-on="overlayOn(f)"
          >
            <span v-if="showActions" role="button" tabindex="0" class="k-upload__card-overlay-action" aria-label="预览" title="预览" v-on="previewOn(f)">
              <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M1.5 8S4 3.8 8 3.8 14.5 8 14.5 8 12 12.2 8 12.2 1.5 8 1.5 8Z" /><circle cx="8" cy="8" r="1.8" /></svg>
            </span>
            <span v-if="showActions" role="button" tabindex="0" class="k-upload__card-overlay-action" aria-label="删除" title="删除" v-on="removeOn(f)">
              <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.7 9a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4" /></svg>
            </span>
            <span v-if="clickToUpload" role="button" tabindex="0" class="k-upload__card-overlay-action" aria-label="重新上传" title="重新上传" v-on="thumbOn(f)">
              <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.5-3.6" /><path d="M13 2.5V5h-2.5" /></svg>
            </span>
          </span>
          <span v-if="f.status === 'uploading'" class="k-upload__card-mask">
            <span>{{ f.percent ?? 0 }}%</span>
          </span>
          <span v-else-if="f.status === 'error'" class="k-upload__card-mask is-error" role="button" tabindex="0" aria-label="重试" v-on="retryOn(f)">重试</span>
        </div>
        <div
          v-if="canAdd"
          key="__add"
          v-bind="triggerAttrs"
          class="k-upload__card-add"
          :class="classNames?.trigger"
          :style="styles?.trigger"
          v-on="triggerOn"
        >
          <slot name="trigger" :open="openSelect" :disabled="disabled">
            <span class="k-upload__card-plus" aria-hidden="true">+</span>
            <span class="k-upload__card-hint">上传</span>
          </slot>
        </div>
      </TransitionGroup>

      <!-- 文本 / 图片列表：触发区 + 列表 -->
      <template v-else>
        <div
          v-bind="triggerAttrs"
          class="k-upload__trigger"
          :class="[classNames?.trigger, { 'is-full': !canAdd }]"
          :style="styles?.trigger"
          v-on="triggerOn"
        >
          <slot name="trigger" :open="openSelect" :disabled="disabled">
            <template v-if="drag">
              <svg class="k-upload__cloud k-upload__cloud--lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M7 17a4.5 4.5 0 0 1-.6-8.96 6 6 0 0 1 11.4 1.6A3.5 3.5 0 0 1 17.5 17" /><path d="M12 11v7M9.2 13.2 12 10.4l2.8 2.8" /></svg>
              <span>点击或拖拽文件到此处上传</span>
            </template>
            <template v-else>
              <svg class="k-upload__cloud" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 16V5M8 8.5 12 4.5l4 4" /><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" /></svg>
              <span>上传文件</span>
            </template>
          </slot>
        </div>

        <TransitionGroup
          tag="ul"
          name="k-upload-item"
          class="k-upload__list"
          :class="classNames?.list"
          :style="[styles?.list, { '--k-upload-shift': `${shiftPx}px` }]"
          v-on="listDragOn"
        >
          <li
            v-for="f in list"
            :key="f.uid"
            class="k-upload__item"
            :class="classNames?.item"
            :style="styles?.item"
            v-bind="itemAttrs(f)"
            v-on="itemDragOn(f)"
          >
            <template v-if="listType === 'picture'">
              <img
                v-if="thumbOf(f)"
                class="k-upload__thumb"
                :src="thumbOf(f)"
                :alt="f.name"
                :style="styles?.thumb"
                v-on="thumbOn(f)"
              />
              <span v-else class="k-upload__thumb k-upload__thumb--ext" :style="styles?.thumb">{{ extOf(f) }}</span>
            </template>
            <div class="k-upload__meta">
              <span
                class="k-upload__name"
                :class="classNames?.name"
                :style="styles?.name"
                role="button"
                tabindex="0"
                v-on="previewOn(f)"
              >{{ f.name }}</span>
              <div v-if="f.status === 'uploading'" class="k-upload__progress" :class="classNames?.progress" :style="styles?.progress">
                <i :style="{ width: `${f.percent ?? 0}%` }" />
              </div>
              <span v-else-if="f.status === 'error'" class="k-upload__fail">上传失败</span>
            </div>
            <span
              v-if="clickToUpload"
              class="k-upload__action k-upload__replace-action"
              role="button"
              tabindex="0"
              aria-label="重新上传"
              title="重新上传"
              v-on="thumbOn(f)"
            >
              <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.5-3.6" /><path d="M13 2.5V5h-2.5" /></svg>
            </span>
            <span class="k-upload__actions" :class="classNames?.actions" :style="styles?.actions">
              <span
                v-if="f.status === 'error'"
                class="k-upload__action"
                role="button"
                tabindex="0"
                aria-label="重试"
                title="重试"
                v-on="retryOn(f)"
              >
                <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.5-3.6" /><path d="M13 2.5V5h-2.5" /></svg>
              </span>
              <span
                v-if="showActions"
                class="k-upload__action"
                role="button"
                tabindex="0"
                aria-label="删除"
                title="删除"
                v-on="removeOn(f)"
              >
                <svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.7 9a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4" /></svg>
              </span>
            </span>
          </li>
        </TransitionGroup>
      </template>

      <input
        ref="inputEl"
        class="k-upload__input"
        v-bind="inputAttrs"
        v-on="inputOn"
      />

      <div v-if="drag && dragOver" class="k-upload__dragover">释放以上传</div>
    </div>

    <KModal
      :open="cropOpen"
      title="裁剪图片"
      :width="560"
      @update:open="onCropModalUpdate"
    >
      <KImageCropper
        :file="cropCurrent"
        :aspect-ratio="cropOptions?.aspectRatio"
        :type="cropOptions?.type"
        :quality="cropOptions?.quality"
        @confirm="onCropConfirm"
        @cancel="onCropCancel"
      />
    </KModal>
    <KPreview v-model:open="previewOpen" v-model:current="previewIndex" :items="previewItems" />
  </template>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useSlots, watch } from 'vue';
import type { CSSProperties, Ref, VNodeChild } from 'vue';
import { useCustomRender } from '../../composables/useCustomRender';
import type { KRenderFn, KOnPack } from '../../composables/useCustomRender';
import KPreview from '../Preview/Preview.vue';
import KImageCropper from '../ImageCropper/ImageCropper.vue';
import KModal from '../Modal/Modal.vue';

defineOptions({ name: 'KUpload' });

export type KUploadListType = 'text' | 'picture' | 'picture-card' | 'picture-circle';
export type KUploadFileStatus = 'uploading' | 'done' | 'error';

export interface KUploadCompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  /** 0~1，默认 0.85（PNG 会忽略质量参数，只靠尺寸压缩） */
  quality?: number;
  /** 输出 MIME；缺省沿用原图（PNG 保透明） */
  type?: string;
}
export type KUploadChangeReason = 'add' | 'progress' | 'success' | 'error' | 'retry' | 'remove' | 'move' | 'replace';

export interface KUploadFile {
  /** 列表 key；外部传入可缺省，内部归一后必有 */
  uid?: string;
  name?: string;
  status?: KUploadFileStatus;
  /** 0-100 */
  percent?: number;
  /** 下载 / 预览地址 */
  url?: string;
  /** 缩略图地址（缺省回退 url / 本地 raw 对象 URL） */
  thumbUrl?: string;
  size?: number;
  /** 原始文件（本地预览与重试依赖；外部传入的历史文件可不带） */
  raw?: File;
  [key: string]: unknown;
}

/** 归一后的文件项（uid/name/status 必有）：事件与 scope 里流转的形态 */
export interface KUploadFileItem extends KUploadFile {
  uid: string;
  name: string;
  status: KUploadFileStatus;
}

export interface KUploadChunkInfo {
  index: number;
  total: number;
  start: number;
  end: number;
  size: number;
}

export interface KUploadRequestOptions {
  file: File;
  /** 中止信号：fetch 等可直连；删除/卸载时 abort */
  signal: AbortSignal;
  /** 分片模式下当前分片信息；普通模式为 undefined */
  chunk?: KUploadChunkInfo;
  onProgress: (percent: number) => void;
  onSuccess: (response?: unknown) => void;
  onError: (err?: unknown) => void;
}

export interface KUploadMergeOptions {
  file: File;
  signal: AbortSignal;
  chunkCount: number;
  /** 各分片 onSuccess 返回值的数组（按分片下标） */
  responses: unknown[];
}
export type KUploadMerge = (options: KUploadMergeOptions) => unknown | Promise<unknown>;

export interface KUploadCropOptions {
  /** 固定宽高比；不传 = 自由裁剪 */
  aspectRatio?: number;
  type?: string;
  quality?: number;
}
/** 可返回 { abort } 句柄、Promise（拒绝 = 失败，resolve false = 拒绝该文件）或直接 false */
export type KUploadRequestResult = { abort?: () => void } | void | false | Promise<unknown>;
/** 上传实现：唯一上传入口（组件自身不发请求） */
export type KUploadUpload = (options: KUploadRequestOptions) => KUploadRequestResult;
export type KUploadRemoveHook = (file: KUploadFileItem) => boolean | Promise<boolean>;

/** headless scope：#render 插槽 / render prop 闭包参数；绑定包 spread 到自绘节点才继承逻辑 */
export interface KUploadRenderScope {
  fileList: KUploadFileItem[];
  listType: KUploadListType;
  accept: string | undefined;
  multiple: boolean | undefined;
  maxCount: number | undefined;
  maxSize: number | undefined;
  disabled: boolean | undefined;
  drag: boolean | undefined;
  /** 是否渲染预览/删除操作栏 */
  showActions: boolean | undefined;
  /** 点缩略图是否改为重新选择并原位替换 */
  clickToUpload: boolean | undefined;
  /** 列表项是否可拖拽换顺序 */
  sortable: boolean | undefined;
  /** 拖拽文件经过根区域 */
  dragOver: boolean;
  /** 正在被拖拽排序的文件 uid */
  draggingUid: string | null;
  canAdd: boolean;
  rootEl: Ref<HTMLElement | null>;
  inputEl: Ref<HTMLInputElement | null>;
  rootAttrs: Record<string, unknown>;
  /** 根节点拖放包（dragenter/over/leave/drop） */
  rootOn: KOnPack;
  triggerAttrs: Record<string, unknown>;
  triggerOn: KOnPack;
  inputAttrs: Record<string, unknown>;
  inputOn: KOnPack;
  itemAttrs: (file: KUploadFileItem) => Record<string, unknown>;
  /** 排序包：dragstart/dragover/dragleave/drop/dragend（sortable 开启才响应） */
  itemDragOn: (file: KUploadFileItem) => KOnPack;
  removeOn: (file: KUploadFileItem) => KOnPack;
  retryOn: (file: KUploadFileItem) => KOnPack;
  previewOn: (file: KUploadFileItem) => KOnPack;
  /** 缩略图点击：clickToUpload 开启为重新选择替换，否则预览 */
  thumbOn: (file: KUploadFileItem) => KOnPack;
  /** 缩略图源（thumbUrl > url > raw 本地对象 URL） */
  thumbOf: (file: KUploadFileItem) => string | undefined;
  isImage: (file: KUploadFileItem) => boolean;
  extOf: (file: KUploadFileItem) => string;
  openSelect: () => void;
  /** 打开选择框，选中后原位替换该文件（走完整上传管线） */
  openReplace: (file: KUploadFileItem) => void;
  addFiles: (files: File[] | FileList | ArrayLike<File>) => void;
  remove: (file: KUploadFileItem) => void;
  retry: (file: KUploadFileItem) => void;
  upload: (file: KUploadFileItem) => void;
  abort: (file: KUploadFileItem) => void;
  preview: (file: KUploadFileItem) => void;
  /** 把 from 移动到 to 的前/后（越界静默忽略） */
  reorder: (fromUid: string, toUid: string, position: 'before' | 'after') => void;
  slots: ReturnType<typeof useSlots>;
}

type UploadPart = 'root' | 'trigger' | 'list' | 'item' | 'name' | 'progress' | 'actions' | 'thumb';

interface KUploadProps {
  listType?: KUploadListType;
  accept?: string;
  multiple?: boolean;
  maxCount?: number;
  /** 单文件大小上限（字节），超出的直接拒绝并 emit reject */
  maxSize?: number;
  disabled?: boolean;
  /** 根区域作为拖放目标（dashboard 高亮） */
  drag?: boolean;
  /** 目录选择（webkitdirectory；强制多选，列表名显示相对路径） */
  directory?: boolean;
  /** 监听页面粘贴（Ctrl/Cmd+V 的文件/图片直接加入列表） */
  paste?: boolean;
  /** 并发上限：>0 时最多同时执行 N 个 upload，其余排队（0 / 不传 = 不限） */
  concurrency?: number;
  /** 图片前置压缩（canvas）：true = 1920px/0.85；非图片与 SVG/GIF 跳过 */
  compress?: boolean | KUploadCompressOptions;
  /** 分片大小（字节）：>0 且文件大于该值时按片调用 upload；0 = 关闭 */
  chunkSize?: number;
  /** 单文件内分片并发数（默认 3） */
  chunkConcurrency?: number;
  /** 全部分片成功后调用，返回值参与 mapResponse（无则不回传 url） */
  merge?: KUploadMerge;
  /** 选图后弹层裁剪再入列（true 或固定比例/编码参数；替换上传同样生效） */
  crop?: boolean | KUploadCropOptions;
  /** 是否渲染 hover 操作栏（picture-card 的预览/删除、列表的删除；error 重试不受控） */
  showActions?: boolean;
  /** 点缩略图改为重新选择文件并原位替换（关闭则点图预览） */
  clickToUpload?: boolean;
  /** 列表项可拖拽换顺序（原生 HTML5 DnD，不引第三方库） */
  sortable?: boolean;
  /** 上传实现（必传）：组件自身不发请求；返回 false / Promise<false> 拒绝该文件 */
  upload?: KUploadUpload;
  /** 删除前钩子（与 upload 对称）：返回 false 或 reject 则保留 */
  remove?: KUploadRemoveHook;
  /** 自定义渲染闭包（#render 插槽优先）；提供时整件视觉输出被替换（含预览 Modal） */
  render?: KRenderFn<KUploadRenderScope>;
  classNames?: Partial<Record<UploadPart, string>>;
  styles?: Partial<Record<UploadPart, CSSProperties>>;
}

const props = withDefaults(defineProps<KUploadProps>(), {
  listType: 'text',
  multiple: false,
  drag: false,
  directory: false,
  paste: false,
  concurrency: 0,
  compress: false,
  chunkSize: 0,
  chunkConcurrency: 3,
  crop: false,
  showActions: true,
  clickToUpload: false,
});

const emit = defineEmits<{
  change: [fileList: KUploadFileItem[], info: { file?: KUploadFileItem; reason: KUploadChangeReason }];
  success: [file: KUploadFileItem];
  error: [file: KUploadFileItem, err: unknown];
  reject: [file: File, reason: 'size' | 'maxCount' | 'upload'];
  remove: [file: KUploadFileItem];
  preview: [file: KUploadFileItem];
  /** 开始重传（error → uploading） */
  retry: [file: KUploadFileItem];
  /** 拖拽排序落位后（from/to 为最终下标） */
  reorder: [fileList: KUploadFileItem[], info: { file: KUploadFileItem; from: number; to: number; position: 'before' | 'after' }];
}>();

const model = defineModel<KUploadFile[]>('fileList', { default: () => [] });
const slots = useSlots();

const rootEl = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLInputElement | null>(null);
const dragOver = ref(false);
const dragUid = ref<string | null>(null);
const dragOverUid = ref<string | null>(null);
const dropPos = ref<'before' | 'after' | null>(null);
/** 列表拖拽让位距离（行高 + 行距）与上下让位集合 */
const shiftPx = ref(0);
/** 触屏排序：长按激活，避免与滚动冲突 */
interface SortPointerState {
  uid: string;
  el: HTMLElement;
  startX: number;
  startY: number;
  active: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}
let sortPointer: SortPointerState | null = null;
const sortingPointer = ref(false);
const shiftUpUids = ref<string[]>([]);
const shiftDownUids = ref<string[]>([]);
const isCardWall = computed(() => props.listType === 'picture-card' || props.listType === 'picture-circle');
const previewOpen = ref(false);
const previewIndex = ref(0);
const replaceUid = ref<string | null>(null);

interface CropTask {
  file: File;
  relative?: string;
  replaceUid?: string;
}
const cropQueue: CropTask[] = [];
const cropCurrent = ref<File | null>(null);
const cropOpen = ref(false);
const pendingCropCount = ref(0);
let activeCropTask: CropTask | null = null;

const cropOptions = computed(() => {
  if (!props.crop) return null;
  return props.crop === true ? {} : props.crop;
});

let uidSeed = 0;
let dragDepth = 0;
/** 最近一次 emit 的列表快照：同 tick 内 props 尚未回写，refuse/追加都以它为准 */
let lastEmitted: KUploadFileItem[] | null = null;
const requests = new Map<string, { abort?: () => void }>();
const controllers = new Map<string, AbortController>();
const objectUrls = new Map<string, string>();

function nextUid() {
  uidSeed += 1;
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : String(Date.now()) + uidSeed;
  return `k-upload-${rand}`;
}

function normalizeStatus(status: unknown): KUploadFileStatus {
  // 兼容旧业务数据的 finished
  if (status === 'finished') return 'done';
  if (status === 'uploading' || status === 'error') return status;
  return 'done';
}

/** 读取侧归一：旧状态映射 + uid/name 兜底；保留业务扩展字段 */
const list = computed<KUploadFileItem[]>(() =>
  (model.value ?? []).map((item, index) => ({
    ...item,
    status: normalizeStatus(item.status),
    uid: item.uid ?? (item.id != null ? `id-${item.id}` : `external-${index}`),
    name: item.name ?? '未命名文件',
  })),
);

const canAdd = computed(
  () =>
    !props.disabled &&
    (props.maxCount == null || list.value.length + pendingCropCount.value < props.maxCount),
);

function setList(next: KUploadFileItem[], reason: KUploadChangeReason, file?: KUploadFileItem) {
  lastEmitted = next;
  model.value = next;
  emit('change', next, { file, reason });
}

function updateItem(uid: string, patch: Partial<KUploadFileItem>, reason: KUploadChangeReason) {
  const source = lastEmitted ?? list.value;
  const current = source.find((f) => f.uid === uid);
  if (!current) return null;
  const next = { ...current, ...patch };
  setList(
    source.map((f) => (f.uid === uid ? next : f)),
    reason,
    next,
  );
  return next;
}

function isImage(file: KUploadFileItem) {
  if (file.raw?.type.startsWith('image/')) return true;
  const probe = file.thumbUrl ?? file.url ?? file.name;
  if (/^data:image\//i.test(probe)) return true;
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?|#|$)/i.test(probe);
}

function extOf(file: KUploadFileItem) {
  const m = /\.([a-z0-9]{1,5})$/i.exec(file.name);
  return m ? m[1].toUpperCase() : 'FILE';
}

function thumbOf(file: KUploadFileItem) {
  if (file.thumbUrl) return file.thumbUrl;
  if (file.url && isImage(file)) return file.url;
  if (file.raw && file.raw.type.startsWith('image/')) {
    let url = objectUrls.get(file.uid);
    if (!url) {
      url = URL.createObjectURL(file.raw);
      objectUrls.set(file.uid, url);
    }
    return url;
  }
  return undefined;
}

function revokeObjectUrl(uid: string) {
  const url = objectUrls.get(uid);
  if (url) {
    URL.revokeObjectURL(url);
    objectUrls.delete(uid);
  }
}

/* ---------- 上传管线（组件不发请求：upload 全权接管） ---------- */
function mapResponse(resp: unknown): Partial<KUploadFileItem> {
  if (resp == null) return {};
  if (typeof resp === 'string') return { url: resp };
  if (typeof resp === 'object') {
    const r = resp as Record<string, unknown>;
    const out: Partial<KUploadFileItem> = {};
    if (typeof r.url === 'string') out.url = r.url;
    if (typeof r.thumbUrl === 'string') out.thumbUrl = r.thumbUrl;
    if (typeof r.name === 'string') out.name = r.name;
    if (typeof r.size === 'number') out.size = r.size;
    return out;
  }
  return {};
}

const activeUids = new Set<string>();
const uploadQueue: KUploadFileItem[] = [];

function slotsFree(): boolean {
  return props.concurrency <= 0 || activeUids.size < props.concurrency;
}

function pumpQueue() {
  while (uploadQueue.length && slotsFree()) {
    const next = uploadQueue.shift()!;
    if (!list.value.some((f) => f.uid === next.uid)) continue;
    startRequest(next);
  }
}

function finishRequest(uid: string) {
  activeUids.delete(uid);
  pumpQueue();
}

function abortRequest(uid: string) {
  const queued = uploadQueue.findIndex((f) => f.uid === uid);
  if (queued >= 0) uploadQueue.splice(queued, 1);
  controllers.get(uid)?.abort();
  controllers.delete(uid);
  const handle = requests.get(uid);
  try {
    handle?.abort?.();
  } catch {
    /* 业务 abort 失败不影响列表移除 */
  }
  requests.delete(uid);
  if (activeUids.delete(uid)) pumpQueue();
}

/** 并发闸门：有空位直接执行，否则入队（返回 false 仅代表同步被 upload 拒绝） */
function startRequest(file: KUploadFileItem): boolean {
  if (!slotsFree()) {
    uploadQueue.push(file);
    return true;
  }
  return executeRequest(file);
}

async function runChunkedRequest(file: KUploadFileItem, controller: AbortController) {
  const raw = file.raw as File;
  const chunkSize = Math.max(1, props.chunkSize);
  const total = Math.ceil(raw.size / chunkSize) || 1;
  const sizes = Array.from({ length: total }, (_, i) =>
    Math.min(chunkSize, raw.size - i * chunkSize),
  );
  const percents = new Array<number>(total).fill(0);
  const responses: unknown[] = new Array(total);
  const handles = new Map<number, { abort?: () => void }>();
  let settled = false;

  const loaded = () => sizes.reduce((sum, size, i) => sum + (size * percents[i]) / 100, 0);
  const reportProgress = () => {
    if (controller.signal.aborted) return;
    const percent = Math.min(99, Math.floor((loaded() / Math.max(1, raw.size)) * 100));
    updateItem(file.uid, { percent }, 'progress');
  };

  requests.set(file.uid, {
    abort: () => {
      for (const handle of handles.values()) handle.abort?.();
    },
  });

  const cleanup = () => {
    controllers.delete(file.uid);
    requests.delete(file.uid);
  };
  const fail = (err: unknown) => {
    if (settled || controller.signal.aborted) return;
    settled = true;
    cleanup();
    const updated = updateItem(file.uid, { status: 'error' }, 'error');
    finishRequest(file.uid);
    if (updated) emit('error', updated, err);
  };
  const refuse = () => {
    if (settled || controller.signal.aborted) return;
    settled = true;
    cleanup();
    activeUids.delete(file.uid);
    revokeObjectUrl(file.uid);
    setList((lastEmitted ?? list.value).filter((f) => f.uid !== file.uid), 'remove', file);
    if (file.raw) emit('reject', file.raw, 'upload');
    pumpQueue();
  };
  const finish = async () => {
    if (settled || controller.signal.aborted) return;
    settled = true;
    let response: unknown;
    try {
      response = props.merge
        ? await props.merge({ file: raw, signal: controller.signal, chunkCount: total, responses })
        : undefined;
      if (response === false) {
        settled = false;
        refuse();
        return;
      }
    } catch (err) {
      settled = false;
      fail(err);
      return;
    }
    if (controller.signal.aborted) return;
    cleanup();
    const updated = updateItem(file.uid, { status: 'done', percent: 100, ...mapResponse(response) }, 'success');
    finishRequest(file.uid);
    if (updated) emit('success', updated);
  };

  const runChunk = (index: number) =>
    new Promise<void>((resolve, reject) => {
      const start = index * chunkSize;
      const end = Math.min(raw.size, start + chunkSize);
      const chunkFile = new File([raw.slice(start, end)], raw.name, {
        type: raw.type,
        lastModified: raw.lastModified,
      });
      const options: KUploadRequestOptions = {
        file: chunkFile,
        signal: controller.signal,
        chunk: { index, total, start, end, size: end - start },
        onProgress: (percent) => {
          percents[index] = Math.min(100, Math.max(0, Math.round(percent)));
          reportProgress();
        },
        onSuccess: (response) => {
          percents[index] = 100;
          responses[index] = response;
          reportProgress();
          resolve();
        },
        onError: (err) => reject(err),
      };
      try {
        const ret = props.upload!(options);
        if (ret === false) {
          reject({ __refuse: true });
          return;
        }
        if (ret && typeof (ret as Promise<unknown>).then === 'function') {
          (ret as Promise<unknown>)
            .then((handle) => {
              if (handle === false) {
                reject({ __refuse: true });
                return;
              }
              if (handle && typeof (handle as { abort?: unknown }).abort === 'function') {
                const h = handle as { abort?: () => void };
                handles.set(index, h);
                if (controller.signal.aborted) h.abort?.();
              }
            })
            .catch(reject);
        } else if (ret && typeof (ret as { abort?: unknown }).abort === 'function') {
          const h = ret as { abort?: () => void };
          handles.set(index, h);
          if (controller.signal.aborted) h.abort?.();
        }
      } catch (err) {
        reject(err);
      }
    });

  let next = 0;
  let remaining = total;
  const worker = async () => {
    while (!settled && !controller.signal.aborted) {
      const index = next++;
      if (index >= total) return;
      try {
        await runChunk(index);
        handles.delete(index);
        remaining -= 1;
        if (remaining === 0) void finish();
      } catch (err) {
        if (settled || controller.signal.aborted) return;
        if ((err as { __refuse?: boolean })?.__refuse) refuse();
        else fail(err);
        controller.abort();
        return;
      }
    }
  };
  const workerCount = Math.min(Math.max(1, props.chunkConcurrency), total);
  void Promise.all(Array.from({ length: workerCount }, worker));
}

function executeRequest(file: KUploadFileItem): boolean {
  if (!props.upload) {
    console.warn('[KUpload] 需要传入 upload：组件自身不发请求');
    updateItem(file.uid, { status: 'error' }, 'error');
    return true;
  }
  activeUids.add(file.uid);
  const controller = new AbortController();
  controllers.set(file.uid, controller);
  if (props.chunkSize > 0 && file.raw && file.raw.size > props.chunkSize) {
    void runChunkedRequest(file, controller);
    return true;
  }
  const ctx: KUploadRequestOptions = {
    file: file.raw as File,
    signal: controller.signal,
    onProgress: (percent) => {
      if (controller.signal.aborted) return;
      updateItem(file.uid, { percent: Math.min(100, Math.max(0, Math.round(percent))) }, 'progress');
    },
    onSuccess: (resp) => {
      if (controller.signal.aborted) return;
      const updated = updateItem(file.uid, { status: 'done', percent: 100, ...mapResponse(resp) }, 'success');
      controllers.delete(file.uid);
      requests.delete(file.uid);
      finishRequest(file.uid);
      if (updated) emit('success', updated);
    },
    onError: (err) => {
      if (controller.signal.aborted) return;
      const updated = updateItem(file.uid, { status: 'error' }, 'error');
      controllers.delete(file.uid);
      requests.delete(file.uid);
      finishRequest(file.uid);
      if (updated) emit('error', updated, err);
    },
  };
  /* upload 返回 false / Promise<false>：不上传、不占列表（同步 false 时与 add 同 tick 增删，无闪烁） */
  const refuse = () => {
    controllers.delete(file.uid);
    activeUids.delete(file.uid);
    revokeObjectUrl(file.uid);
    setList(
      (lastEmitted ?? list.value).filter((f) => f.uid !== file.uid),
      'remove',
      file,
    );
    if (file.raw) emit('reject', file.raw, 'upload');
    pumpQueue();
  };
  try {
    const ret = props.upload(ctx);
    if (ret === false) {
      refuse();
      return false;
    }
    if (ret && typeof (ret as Promise<unknown>).then === 'function') {
      (ret as Promise<unknown>)
        .then((r) => {
          if (r === false) {
            refuse();
            return;
          }
          if (r && typeof (r as { abort?: unknown }).abort === 'function') {
            requests.set(file.uid, r as { abort: () => void });
          }
        })
        .catch((err) => ctx.onError(err));
    } else if (ret && typeof (ret as { abort?: unknown }).abort === 'function') {
      requests.set(file.uid, ret as { abort: () => void });
    }
  } catch (err) {
    ctx.onError(err);
  }
  return true;
}

function compressOptions(): Required<KUploadCompressOptions> | null {
  if (!props.compress) return null;
  if (props.compress === true) return { maxWidth: 1920, maxHeight: 1920, quality: 0.85, type: '' };
  return {
    maxWidth: props.compress.maxWidth ?? 1920,
    maxHeight: props.compress.maxHeight ?? 1920,
    quality: Math.min(1, Math.max(0.1, props.compress.quality ?? 0.85)),
    type: props.compress.type ?? '',
  };
}

/** 图片压缩失败/不符合条件时原样返回，不阻断上传 */
async function compressFile(file: File): Promise<File> {
  const opts = compressOptions();
  if (!opts || typeof document === 'undefined') return file;
  if (!/^image\//.test(file.type) || /svg|gif/i.test(file.type)) return file;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, opts.maxWidth / bitmap.width, opts.maxHeight / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    if (scale === 1 && file.type === 'image/png') return file;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const outType = opts.type || (file.type === 'image/png' ? 'image/png' : 'image/jpeg');
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outType, opts.quality));
    if (!blob || blob.size >= file.size) return file;
    const out = new File([blob], file.name, { type: blob.type || outType, lastModified: file.lastModified });
    const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    if (relative) Object.defineProperty(out, 'webkitRelativePath', { value: relative });
    return out;
  } catch {
    return file;
  } finally {
    bitmap?.close?.();
  }
}

function createItem(file: File): KUploadFileItem {
  const relative = props.directory
    ? (file as File & { webkitRelativePath?: string }).webkitRelativePath
    : '';
  return {
    uid: nextUid(),
    name: relative || file.name,
    status: 'uploading',
    percent: 0,
    size: file.size,
    raw: file,
  };
}

function shouldCrop(file: File): boolean {
  return !!props.crop && /^image\//.test(file.type) && !/svg|gif/i.test(file.type);
}

async function acceptFile(raw: File) {
  const file = await compressFile(raw);
  if (props.maxSize != null && file.size > props.maxSize) {
    emit('reject', file, 'size');
    return;
  }
  const item = createItem(file);
  setList([...list.value, item], 'add', item);
  if (!startRequest(item)) {
    // 同步拒绝：refuse 已回写列表；这里无需再动工作数组
  }
}

function pumpCrop() {
  if (activeCropTask || !cropQueue.length) return;
  activeCropTask = cropQueue.shift()!;
  cropCurrent.value = activeCropTask.file;
  cropOpen.value = true;
}

function enqueueCrop(raw: File, replace?: string) {
  cropQueue.push({
    file: raw,
    replaceUid: replace,
    relative: (raw as File & { webkitRelativePath?: string }).webkitRelativePath,
  });
  pendingCropCount.value += 1;
  pumpCrop();
}

async function onCropConfirm(file: File) {
  const task = activeCropTask;
  activeCropTask = null;
  cropOpen.value = false;
  cropCurrent.value = null;
  pendingCropCount.value = Math.max(0, pendingCropCount.value - 1);
  if (task?.relative) Object.defineProperty(file, 'webkitRelativePath', { value: task.relative });
  if (task?.replaceUid) await replaceFile(task.replaceUid, file, true);
  else await acceptFile(file);
  pumpCrop();
}

function onCropCancel() {
  activeCropTask = null;
  cropOpen.value = false;
  cropCurrent.value = null;
  pendingCropCount.value = Math.max(0, pendingCropCount.value - 1);
  pumpCrop();
}

function onCropModalUpdate(open: boolean) {
  if (open) {
    cropOpen.value = true;
    return;
  }
  if (activeCropTask) onCropCancel();
  else cropOpen.value = false;
}

async function addFiles(source: File[] | FileList | ArrayLike<File>) {
  if (props.disabled) return;
  const raws = Array.from(source ?? []).filter(Boolean) as File[];
  if (!raws.length) return;

  const limited = props.multiple || props.directory ? raws : raws.slice(0, 1);
  const room =
    props.maxCount == null
      ? Infinity
      : Math.max(0, props.maxCount - list.value.length - pendingCropCount.value);
  const accepted = limited.slice(0, room);
  for (const overflow of limited.slice(accepted.length)) emit('reject', overflow, 'maxCount');

  for (const raw of accepted) {
    if (shouldCrop(raw)) enqueueCrop(raw);
    else await acceptFile(raw);
  }
}

async function remove(file: KUploadFileItem) {
  if (props.disabled) return;
  if (props.remove) {
    let allowed: boolean;
    try {
      allowed = await props.remove(file);
    } catch {
      return;
    }
    if (!allowed) return;
  }
  abortRequest(file.uid);
  revokeObjectUrl(file.uid);
  setList(
    list.value.filter((f) => f.uid !== file.uid),
    'remove',
    file,
  );
  emit('remove', file);
}

function retry(file: KUploadFileItem) {
  if (props.disabled || file.status !== 'error') return;
  const current = list.value.find((f) => f.uid === file.uid);
  if (!current?.raw) return;
  const next = updateItem(file.uid, { status: 'uploading', percent: 0 }, 'retry');
  if (next) {
    emit('retry', next);
    startRequest(next);
  }
}

/** 手动（重新）上传已有项：需要 raw；不受状态限制（retry 仅 error） */
function upload(file: KUploadFileItem) {
  if (props.disabled || !file.raw) return;
  const next = updateItem(file.uid, { status: 'uploading', percent: 0 }, 'retry');
  if (next) startRequest(next);
}

function abort(file: KUploadFileItem) {
  abortRequest(file.uid);
}

/** 图片项走内置 KPreview 画廊（多图可切换），非图片有 url 时新窗口打开 */
const previewItems = computed(() =>
  list.value
    .filter((f) => isImage(f))
    .map((f) => ({ src: f.url ?? thumbOf(f) ?? '', name: f.name, alt: f.name, type: 'image' as const, uid: f.uid }))
    .filter((item) => !!item.src),
);

function preview(file: KUploadFileItem) {
  emit('preview', file);
  if (file.status === 'error') return;
  if (isImage(file)) {
    const index = previewItems.value.findIndex((item) => item.uid === file.uid);
    if (index >= 0) {
      previewIndex.value = index;
      previewOpen.value = true;
      return;
    }
  }
  if (file.url) window.open(file.url, '_blank', 'noopener');
}

function openSelect() {
  if (!canAdd.value) return;
  replaceUid.value = null; // 取消替换后再次新增，别沿用上次的替换目标
  inputEl.value?.click();
}

/** 点缩略图重新选择：记住目标，选中后原位替换（不受 maxCount 约束） */
function openReplace(file: KUploadFileItem) {
  if (props.disabled) return;
  if (!list.value.some((f) => f.uid === file.uid)) return;
  replaceUid.value = file.uid;
  inputEl.value?.click();
}

async function replaceFile(uid: string, raw: File, skipCrop = false) {
  if (props.disabled) return;
  if (!skipCrop && shouldCrop(raw)) {
    enqueueCrop(raw, uid);
    return;
  }
  if (!props.upload) {
    console.warn('[KUpload] 需要传入 upload：组件自身不发请求');
    return;
  }
  const file = await compressFile(raw);
  if (props.maxSize != null && file.size > props.maxSize) {
    emit('reject', file, 'size');
    return;
  }
  const index = list.value.findIndex((f) => f.uid === uid);
  if (index < 0) {
    await acceptFile(file);
    return;
  }
  // 复用 uid：保住列表位置与节点身份；旧请求/对象 URL 先回收
  abortRequest(uid);
  revokeObjectUrl(uid);
  const item: KUploadFileItem = { uid, name: file.name, status: 'uploading', percent: 0, size: file.size, raw: file };
  const next = [...list.value];
  next[index] = item;
  setList(next, 'replace', item);
  startRequest(item);
}

function onThumbClick(file: KUploadFileItem) {
  if (props.clickToUpload) openReplace(file);
  else preview(file);
}

function onInputChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const raws = Array.from(input.files ?? []);
  input.value = ''; // 同一文件可重复选
  const target = replaceUid.value;
  replaceUid.value = null;
  if (!raws.length) return;
  if (target) void replaceFile(target, raws[0]);
  else addFiles(raws);
}

/* ---------- 拖拽（dragenter/leave 子元素反复触发，计数抵消） ---------- */
/** 只认文件拖拽：排序拖拽（text/plain）不触发文件投放语义 */
function hasFiles(e: DragEvent) {
  return !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
}
function onDragEnter(e: DragEvent) {
  if (!props.drag || props.disabled || !hasFiles(e)) return;
  e.preventDefault();
  dragDepth += 1;
  dragOver.value = true;
}
function onDragOver(e: DragEvent) {
  if (!props.drag || props.disabled || !hasFiles(e)) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
}
function onDragLeave(e: DragEvent) {
  if (!props.drag || props.disabled || !hasFiles(e)) return;
  e.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) dragOver.value = false;
}
function onDrop(e: DragEvent) {
  if (!props.drag || props.disabled || !hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  dragOver.value = false;
  const raws = Array.from(e.dataTransfer?.files ?? []);
  if (raws.length) addFiles(raws);
}

/* ---------- 粘贴上传（document paste；只消费文件，不拦截纯文本） ---------- */
function onDocumentPaste(e: ClipboardEvent) {
  if (!props.paste || props.disabled) return;
  const data = e.clipboardData;
  if (!data) return;
  const files = Array.from(data.files ?? []);
  if (!files.length) {
    for (const item of Array.from(data.items ?? [])) {
      if (item.kind !== 'file') continue;
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  if (!files.length) return;
  e.preventDefault();
  void addFiles(files);
}

function bindPaste(enable: boolean) {
  if (typeof document === 'undefined') return;
  document.removeEventListener('paste', onDocumentPaste);
  if (enable) document.addEventListener('paste', onDocumentPaste);
}

onMounted(() => bindPaste(props.paste));
watch(
  () => props.paste,
  (enable) => bindPaste(enable),
);
onBeforeUnmount(() => bindPaste(false));

watch(
  () => props.concurrency,
  () => pumpQueue(),
);

/* ---------- 列表排序（原生 HTML5 DnD；位置按行内中点或卡片横向中点判定） ---------- */
function resetSortDrag() {
  dragUid.value = null;
  dragOverUid.value = null;
  dropPos.value = null;
  shiftUpUids.value = [];
  shiftDownUids.value = [];
}
function onItemDragStart(file: KUploadFileItem, e: DragEvent) {
  if (!props.sortable || props.disabled) return;
  dragUid.value = file.uid;
  dragOverUid.value = null;
  dropPos.value = null;
  const el = e.currentTarget as HTMLElement;
  const ul = el.parentElement;
  // 让位距离 = 行高 + 行距：相邻项整体平移一格
  const gap = ul ? parseFloat(getComputedStyle(ul).rowGap) || 0 : 0;
  shiftPx.value = el.getBoundingClientRect().height + gap;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', file.uid); // Firefox 不 setData 不启动拖拽
  }
}
/* 卡片墙按横向中点判定（逐卡片）；列表走 ul 级坐标判定 + 实时让位 */
function onItemDragOver(file: KUploadFileItem, e: DragEvent) {
  if (!props.sortable || props.disabled || !dragUid.value || !isCardWall.value) return;
  if (dragUid.value === file.uid) {
    dragOverUid.value = null;
    dropPos.value = null;
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const before = e.clientX < rect.left + rect.width / 2;
  dragOverUid.value = file.uid;
  dropPos.value = before ? 'before' : 'after';
}
function onItemDragLeave(file: KUploadFileItem, e: DragEvent) {
  if (!isCardWall.value) return;
  if (dragOverUid.value !== file.uid) return;
  const t = e.relatedTarget as Node | null;
  if (t && (e.currentTarget as HTMLElement).contains(t)) return;
  dragOverUid.value = null;
  dropPos.value = null;
}
function onItemDrop(file: KUploadFileItem, e: DragEvent) {
  if (!props.sortable || props.disabled || !dragUid.value || !isCardWall.value) return;
  e.preventDefault();
  e.stopPropagation();
  const from = dragUid.value;
  const position = dropPos.value ?? 'before';
  resetSortDrag();
  if (from !== file.uid) reorder(from, file.uid, position);
}
/* 列表拖拽：按指针 Y 与各行 layout 中点算落点（offsetTop 不受让位 transform 影响），
   跨过中点即让出空位，中间项带 transform 过渡上/下平移 */
function onListDragOver(e: DragEvent) {
  if (!props.sortable || props.disabled || !dragUid.value || isCardWall.value) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  updateListSort(e.currentTarget as HTMLElement, e.clientY);
}

/** 列表落点/让位（HTML5 与触屏共用） */
function updateListSort(ul: HTMLElement, clientY: number) {
  const lis = Array.from(ul.querySelectorAll<HTMLElement>(':scope > .k-upload__item'));
  const fromIdx = list.value.findIndex((f) => f.uid === dragUid.value);
  if (!lis.length || fromIdx < 0) return;
  const y = clientY - ul.getBoundingClientRect().top + ul.scrollTop;
  let targetIdx = lis.length - 1;
  let before = false;
  for (let i = 0; i < lis.length; i++) {
    if (y < lis[i].offsetTop + lis[i].offsetHeight / 2) {
      targetIdx = i;
      before = true;
      break;
    }
  }
  const slot = targetIdx + (before ? 0 : 1);
  if (slot === fromIdx || slot === fromIdx + 1) {
    dragOverUid.value = null;
    dropPos.value = null;
    shiftUpUids.value = [];
    shiftDownUids.value = [];
    return;
  }
  dragOverUid.value = list.value[targetIdx]?.uid ?? null;
  dropPos.value = before ? 'before' : 'after';
  const up: string[] = [];
  const down: string[] = [];
  if (slot > fromIdx) {
    for (let i = fromIdx + 1; i < slot; i++) up.push(list.value[i].uid);
  } else {
    for (let i = slot; i < fromIdx; i++) down.push(list.value[i].uid);
  }
  shiftUpUids.value = up;
  shiftDownUids.value = down;
}
function onListDragLeave(e: DragEvent) {
  if (isCardWall.value) return;
  const t = e.relatedTarget as Node | null;
  if (t && (e.currentTarget as HTMLElement).contains(t)) return;
  dragOverUid.value = null;
  dropPos.value = null;
  shiftUpUids.value = [];
  shiftDownUids.value = [];
}
function onListDrop(e: DragEvent) {
  if (!props.sortable || props.disabled || !dragUid.value || isCardWall.value) return;
  e.preventDefault();
  e.stopPropagation();
  const from = dragUid.value;
  const toUid = dragOverUid.value;
  const position = dropPos.value;
  resetSortDrag();
  if (toUid && position && from !== toUid) reorder(from, toUid, position);
}
/** 卡片墙横向落点（触屏用；HTML5 仍走逐卡片事件） */
function updateCardSort(clientX: number) {
  const root = rootEl.value;
  if (!root) return;
  const cards = Array.from(root.querySelectorAll<HTMLElement>('.k-upload__cards > .k-upload__card')).filter(
    (card) => card.dataset.uid != null && card.dataset.uid !== dragUid.value,
  );
  if (!cards.length) {
    dragOverUid.value = null;
    dropPos.value = null;
    return;
  }
  let best = cards[0];
  let bestD = Infinity;
  for (const card of cards) {
    const r = card.getBoundingClientRect();
    const d = Math.abs(clientX - (r.left + r.width / 2));
    if (d < bestD) {
      bestD = d;
      best = card;
    }
  }
  const rect = best.getBoundingClientRect();
  dragOverUid.value = best.dataset.uid ?? null;
  dropPos.value = clientX < rect.left + rect.width / 2 ? 'before' : 'after';
}

function blockSortClick(ev: Event) {
  ev.preventDefault();
  ev.stopPropagation();
  window.removeEventListener('click', blockSortClick, true);
}

function cleanupSortPointer() {
  window.removeEventListener('pointermove', onSortPointerMove);
  window.removeEventListener('pointerup', onSortPointerUp);
  window.removeEventListener('pointercancel', onSortPointerCancel);
  window.removeEventListener('keydown', onSortPointerKey);
  if (sortPointer?.timer) clearTimeout(sortPointer.timer);
  sortPointer = null;
  sortingPointer.value = false;
  document.body.style.userSelect = '';
  (document.body.style as unknown as Record<string, string>).webkitUserSelect = '';
  document.body.style.touchAction = '';
  setTimeout(() => window.removeEventListener('click', blockSortClick, true), 0);
  resetSortDrag();
}

function activateSortPointer() {
  if (!sortPointer) return;
  const el = sortPointer.el;
  const parent = el.parentElement;
  dragUid.value = sortPointer.uid;
  dragOverUid.value = null;
  dropPos.value = null;
  shiftUpUids.value = [];
  shiftDownUids.value = [];
  if (parent) {
    const cs = getComputedStyle(parent);
    const gap = isCardWall.value ? parseFloat(cs.columnGap) || 0 : parseFloat(cs.rowGap) || 0;
    const rect = el.getBoundingClientRect();
    shiftPx.value = (isCardWall.value ? rect.width : rect.height) + gap;
  }
  sortingPointer.value = true;
  document.body.style.userSelect = 'none';
  (document.body.style as unknown as Record<string, string>).webkitUserSelect = 'none';
  document.body.style.touchAction = 'none';
  window.addEventListener('click', blockSortClick, true);
}

function onSortPointerDown(file: KUploadFileItem, e: PointerEvent) {
  if (!props.sortable || props.disabled) return;
  if (e.pointerType === 'mouse') return; // 鼠标继续走原生 HTML5 拖拽
  // 覆盖在项上的按钮（预览/删除/重传）不触发排序
  if ((e.target as HTMLElement).closest('button, a, [role="button"]')) return;
  const el = e.currentTarget as HTMLElement;
  sortPointer = {
    uid: file.uid,
    el,
    startX: e.clientX,
    startY: e.clientY,
    active: false,
    timer: null,
  };
  window.addEventListener('pointermove', onSortPointerMove, { passive: false });
  window.addEventListener('pointerup', onSortPointerUp);
  window.addEventListener('pointercancel', onSortPointerCancel);
  window.addEventListener('keydown', onSortPointerKey);
  sortPointer.timer = setTimeout(() => {
    if (sortPointer && !sortPointer.active) {
      sortPointer.active = true;
      activateSortPointer();
    }
  }, 250);
}

function onSortPointerMove(e: PointerEvent) {
  if (!sortPointer) return;
  if (!sortPointer.active) {
    if (Math.hypot(e.clientX - sortPointer.startX, e.clientY - sortPointer.startY) > 8) {
      if (sortPointer.timer) clearTimeout(sortPointer.timer);
      sortPointer = null;
      window.removeEventListener('pointermove', onSortPointerMove);
      window.removeEventListener('pointerup', onSortPointerUp);
      window.removeEventListener('pointercancel', onSortPointerCancel);
      window.removeEventListener('keydown', onSortPointerKey);
    }
    return;
  }
  e.preventDefault();
  if (!dragUid.value) return;
  if (isCardWall.value) {
    updateCardSort(e.clientX);
  } else {
    const ul = rootEl.value?.querySelector<HTMLElement>('.k-upload__list');
    if (ul) updateListSort(ul, e.clientY);
  }
}

function onSortPointerUp() {
  if (!sortPointer) return;
  const wasActive = sortPointer.active;
  if (wasActive) {
    const from = dragUid.value;
    const toUid = dragOverUid.value;
    const position = dropPos.value;
    if (from && toUid && position && from !== toUid) reorder(from, toUid, position);
  }
  cleanupSortPointer();
}

function onSortPointerCancel() {
  cleanupSortPointer();
}

function onSortPointerKey(e: KeyboardEvent) {
  if (e.key === 'Escape') cleanupSortPointer();
}

function reorder(fromUid: string, toUid: string, position: 'before' | 'after') {
  const cur = [...list.value];
  const fromIdx = cur.findIndex((f) => f.uid === fromUid);
  if (fromIdx < 0) return;
  const [moved] = cur.splice(fromIdx, 1);
  const toIdx = cur.findIndex((f) => f.uid === toUid);
  if (toIdx < 0) return;
  cur.splice(position === 'after' ? toIdx + 1 : toIdx, 0, moved);
  setList(cur, 'move', moved);
  emit('reorder', cur, { file: moved, from: fromIdx, to: cur.findIndex((f) => f.uid === moved.uid), position });
}

onBeforeUnmount(() => {
  uploadQueue.length = 0;
  activeUids.clear();
  for (const controller of controllers.values()) controller.abort();
  for (const handle of requests.values()) {
    try {
      handle.abort?.();
    } catch {
      /* ignore */
    }
  }
  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
});

/* ---------- headless 绑定包 ---------- */
const rootClasses = computed(() => [
  'k-upload',
  `k-upload--${props.listType}`,
  {
    'is-disabled': props.disabled,
    'is-dragover': dragOver.value,
    'is-drag': props.drag,
    'is-sortable': props.sortable,
    'is-sort-dragging': sortingPointer.value,
  },
]);

const rootAttrs = { 'data-part': 'root' };
const rootOn: KOnPack = {
  dragenter: (e) => onDragEnter(e as DragEvent),
  dragover: (e) => onDragOver(e as DragEvent),
  dragleave: (e) => onDragLeave(e as DragEvent),
  drop: (e) => onDrop(e as DragEvent),
};
const triggerAttrs = computed(() => ({
  'data-part': 'trigger',
  role: 'button',
  tabindex: props.disabled || !canAdd.value ? -1 : 0,
  'aria-disabled': props.disabled || !canAdd.value || undefined,
}));
const triggerOn: KOnPack = {
  click: () => openSelect(),
  keydown: (e) => {
    const key = (e as KeyboardEvent).key;
    if (key === 'Enter' || key === ' ') {
      e.preventDefault();
      openSelect();
    }
  },
};
const inputAttrs = computed(() => ({
  'data-part': 'input',
  type: 'file',
  accept: props.accept,
  multiple: props.multiple || props.directory || undefined,
  webkitdirectory: props.directory || undefined,
  disabled: props.disabled || undefined,
}));
const inputOn: KOnPack = { change: onInputChange };
const itemAttrs = (file: KUploadFileItem) => ({
  'data-part': 'item',
  'data-status': file.status,
  'data-uid': file.uid,
  draggable: props.sortable && !props.disabled ? 'true' : undefined,
  'data-dragging': dragUid.value === file.uid || undefined,
  'data-drop': dragOverUid.value === file.uid ? (dropPos.value ?? undefined) : undefined,
  'data-shift': shiftUpUids.value.includes(file.uid) ? 'up' : shiftDownUids.value.includes(file.uid) ? 'down' : undefined,
});
const listDragOn: KOnPack = {
  dragover: (e) => onListDragOver(e as DragEvent),
  dragleave: (e) => onListDragLeave(e as DragEvent),
  drop: (e) => onListDrop(e as DragEvent),
};
const itemDragOn = (file: KUploadFileItem): KOnPack => ({
  pointerdown: (e) => onSortPointerDown(file, e as PointerEvent),
  dragstart: (e) => onItemDragStart(file, e as DragEvent),
  dragover: (e) => onItemDragOver(file, e as DragEvent),
  dragleave: (e) => onItemDragLeave(file, e as DragEvent),
  drop: (e) => onItemDrop(file, e as DragEvent),
  dragend: () => resetSortDrag(),
});
function onActivateKey(e: KeyboardEvent, run: () => void) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  e.preventDefault();
  e.stopPropagation();
  run();
}
const removeOn = (file: KUploadFileItem): KOnPack => ({
  click: (e) => {
    e.stopPropagation();
    void remove(file);
  },
  keydown: (e) => onActivateKey(e as KeyboardEvent, () => void remove(file)),
});
const retryOn = (file: KUploadFileItem): KOnPack => ({
  click: (e) => {
    e.stopPropagation();
    retry(file);
  },
  keydown: (e) => onActivateKey(e as KeyboardEvent, () => retry(file)),
});
const previewOn = (file: KUploadFileItem): KOnPack => ({
  click: (e) => {
    e.stopPropagation();
    preview(file);
  },
  keydown: (e) => onActivateKey(e as KeyboardEvent, () => preview(file)),
});
const thumbOn = (file: KUploadFileItem): KOnPack => ({
  click: (e) => {
    e.stopPropagation();
    onThumbClick(file);
  },
  keydown: (e) => onActivateKey(e as KeyboardEvent, () => onThumbClick(file)),
});
/* 卡片蒙层空白处点击 = 预览（有操作栏时）；操作项各自 stopPropagation */
const overlayOn = (file: KUploadFileItem): KOnPack => ({
  click: () => {
    if (props.showActions) preview(file);
  },
});

const { renderScope, hasCustomRender, renderPropOutlet } = useCustomRender<KUploadRenderScope>(
  () => props.render,
  () => ({
    fileList: list.value,
    listType: props.listType,
    accept: props.accept,
    multiple: props.multiple,
    maxCount: props.maxCount,
    maxSize: props.maxSize,
    disabled: props.disabled,
    drag: props.drag,
    directory: props.directory,
    paste: props.paste,
    concurrency: props.concurrency,
    compress: props.compress,
    chunkSize: props.chunkSize,
    chunkConcurrency: props.chunkConcurrency,
    crop: props.crop,
    showActions: props.showActions,
    clickToUpload: props.clickToUpload,
    sortable: props.sortable,
    dragOver: dragOver.value,
    draggingUid: dragUid.value,
    canAdd: canAdd.value,
    rootEl,
    inputEl,
    rootAttrs,
    rootOn,
    triggerAttrs: triggerAttrs.value,
    triggerOn,
    inputAttrs: inputAttrs.value,
    inputOn,
    itemAttrs,
    itemDragOn,
    removeOn,
    retryOn,
    previewOn,
    thumbOn,
    thumbOf,
    isImage,
    extOf,
    openSelect,
    openReplace,
    addFiles,
    remove,
    retry,
    upload,
    abort,
    preview,
    reorder,
    slots,
  }),
);

defineSlots<{
  trigger?(scope: { open: () => void; disabled: boolean | undefined }): VNodeChild;
  render?(scope: KUploadRenderScope): VNodeChild;
}>();

defineExpose({ openSelect, addFiles, upload, remove, retry, abort, preview, reorder, inputEl });
</script>

<style>
/* ---------- 部件变量 ---------- */
.k-upload {
  --k-upload-item-bg: var(--k-color-fill-tertiary);
  --k-upload-item-hover-bg: var(--k-color-fill-quaternary);
  --k-upload-item-radius: var(--k-border-radius-sm);
  --k-upload-border-color: var(--k-color-border);
  --k-upload-trigger-color: var(--k-color-text);
  --k-upload-hint-color: var(--k-color-text-tertiary);
  --k-upload-action-color: var(--k-color-text-tertiary);
  --k-upload-action-hover: var(--k-color-text);
  --k-upload-error-color: var(--k-color-error);
  --k-upload-thumb-size: 40px;
  --k-upload-card-size: 96px;
  /* 破格登记：hover 蒙层压暗图片，恒黑不随主题文字色反相（同 card-mask / Modal mask 先例） */
  --k-upload-replace-overlay-bg: rgb(0 0 0 / 65%);
  --k-upload-replace-overlay-color: #fff;
  --k-upload-progress-color: var(--k-color-primary);

  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--k-size-sm);
  font-family: inherit;
  font-size: var(--k-font-size);
  color: var(--k-color-text);
}
.k-upload *,
.k-upload *::before,
.k-upload *::after {
  box-sizing: border-box;
}

.k-upload__input {
  display: none;
}

/* ---------- 触发区：默认按钮感 / drag 虚线大区 ---------- */
.k-upload__trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xs);
  width: fit-content;
  padding: var(--k-size-xs) var(--k-size);
  border: var(--k-line-width) solid var(--k-upload-border-color);
  border-radius: var(--k-border-radius);
  color: var(--k-upload-trigger-color);
  cursor: pointer;
  user-select: none;
  transition:
    border-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-upload__trigger:hover:not(.is-full) {
  border-color: var(--k-color-primary);
  color: var(--k-color-primary);
}
.k-upload.is-drag:not(.is-disabled) .k-upload__trigger {
  display: flex;
  width: 100%;
  justify-content: center;
  padding: var(--k-size-lg) var(--k-size);
  border-style: dashed;
  color: var(--k-upload-hint-color);
}
.k-upload.is-dragover .k-upload__trigger {
  border-color: var(--k-color-primary);
  color: var(--k-color-primary);
}
.k-upload__trigger.is-full {
  cursor: not-allowed;
  opacity: 0.5;
}
.k-upload__cloud {
  flex: none;
  width: 1.2em;
  height: 1.2em;
}
/* 拖拽大区保持更大的图标（按钮形态 1.2em 比 1em 更贴文字视觉中心） */
.k-upload__cloud--lg {
  width: 1.5em;
  height: 1.5em;
}

/* ---------- 文本 / 图片列表 ---------- */
/* 双类名压过站点主题的 `.vp-doc ul`（padding-left / margin-bottom 会漏进来） */
.k-upload .k-upload__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--k-size-xs);
}
.k-upload .k-upload__item {
  /* margin 归零：站点主题 `.vp-doc li + li` 的 margin-top 会漏进行距 */
  margin: 0;
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--k-size-xs);
  min-height: var(--k-upload-thumb-size);
  padding: var(--k-size-xs);
  border-radius: var(--k-upload-item-radius);
  transition:
    background-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    transform 0.18s var(--k-motion-ease-out-cubic);
}
.k-upload .k-upload__item:hover {
  background-color: var(--k-upload-item-hover-bg);
}
/* ---------- 排序反馈（sortable）：拖拽源半透明，目标行上/下、卡片左/右描主色 ---------- */
.k-upload__item[draggable='true'],
.k-upload__card[draggable='true'] {
  cursor: grab;
}
.k-upload__item[data-dragging],
.k-upload__card[data-dragging] {
  opacity: 0.45;
}
.k-upload__item[data-drop='before'] {
  box-shadow: inset 0 2px 0 var(--k-color-primary);
}
.k-upload__item[data-drop='after'] {
  box-shadow: inset 0 -2px 0 var(--k-color-primary);
}
/* 拖拽让位：中间项整体上/下平移一格（距离=行高+行距），过渡见基础行 */
.k-upload .k-upload__item[data-shift='up'] {
  transform: translateY(calc(-1 * var(--k-upload-shift, 0px)));
  pointer-events: none;
}
.k-upload .k-upload__item[data-shift='down'] {
  transform: translateY(var(--k-upload-shift, 0px));
  pointer-events: none;
}
.k-upload__card[data-drop='before'] {
  box-shadow: inset 2px 0 0 var(--k-color-primary);
}
.k-upload__card[data-drop='after'] {
  box-shadow: inset -2px 0 0 var(--k-color-primary);
}
.k-upload__thumb {
  flex: none;
  width: var(--k-upload-thumb-size);
  height: var(--k-upload-thumb-size);
  object-fit: cover;
  border-radius: var(--k-upload-item-radius);
  cursor: pointer;
  background-color: var(--k-upload-item-bg);
}
.k-upload__thumb--ext {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--k-upload-hint-color);
  font-size: 10px;
  font-weight: var(--k-font-weight-strong);
  letter-spacing: 0.04em;
}
.k-upload__meta {
  flex: auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.k-upload__name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-upload__name:hover {
  color: var(--k-color-primary);
}
.k-upload__progress {
  height: 2px;
  border-radius: 1px;
  background-color: var(--k-upload-item-bg);
  overflow: hidden;
}
.k-upload__progress i {
  display: block;
  height: 100%;
  background-color: var(--k-upload-progress-color);
  transition: width var(--k-motion-duration-fast) linear;
}
.k-upload__fail {
  color: var(--k-upload-error-color);
  font-size: var(--k-font-size-sm);
}
.k-upload__actions {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xs);
}
.k-upload__action {
  display: inline-flex;
  color: var(--k-upload-action-color);
  cursor: pointer;
  transition: color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-upload__action:hover {
  color: var(--k-upload-action-hover);
}

/* ---------- picture-card 卡片墙 ---------- */
.k-upload__cards {
  display: flex;
  flex-wrap: wrap;
  gap: var(--k-size-sm);
}
.k-upload__card {
  position: relative;
  width: var(--k-upload-card-size);
  height: var(--k-upload-card-size);
  border: var(--k-line-width) solid var(--k-color-border-secondary);
  border-radius: var(--k-border-radius);
  background-color: var(--k-upload-item-bg);
  overflow: hidden;
}
.k-upload__card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
}
.k-upload__card-ext {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--k-upload-hint-color);
  font-size: var(--k-font-size-sm);
  font-weight: var(--k-font-weight-strong);
  letter-spacing: 0.04em;
}
/* 卡片 hover 操作蒙层：预览 / 删除 / 重新上传 同款（白字图标，恒黑 65% 破格登记） */
.k-upload__card-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: var(--k-size-sm);
  background-color: var(--k-upload-replace-overlay-bg);
  color: var(--k-upload-replace-overlay-color);
  font-size: var(--k-font-size-sm);
  opacity: 0;
  transition: opacity var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-upload__card:hover .k-upload__card-overlay {
  opacity: 1;
}
.k-upload__card-overlay-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.9;
}
.k-upload__card-overlay-action:hover {
  opacity: 1;
}
/* clickToUpload（列表）：hover 行尾出「重新上传」图标按钮，与删除同款；不覆盖整行、不撑高行 */
.k-upload__replace-action {
  display: none;
}
.k-upload__item:hover .k-upload__replace-action {
  display: inline-flex;
}
.k-upload__card-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: color-mix(in oklab, black 45%, transparent);
  color: #fff;
  font-size: var(--k-font-size-sm);
  cursor: pointer;
}
.k-upload__card-mask.is-error {
  color: #fff;
  background-color: color-mix(in oklab, var(--k-color-error) 55%, black 15%);
}
.k-upload__card-add {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: var(--k-upload-card-size);
  height: var(--k-upload-card-size);
  border: var(--k-line-width) dashed var(--k-color-border-secondary);
  border-radius: var(--k-border-radius);
  color: var(--k-upload-hint-color);
  cursor: pointer;
  user-select: none;
  transition:
    border-color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic),
    color var(--k-motion-duration-fast) var(--k-motion-ease-in-out-cubic);
}
.k-upload__card-add:hover {
  border-color: var(--k-color-primary);
  color: var(--k-color-primary);
}
.k-upload__card-plus {
  font-size: 20px;
  line-height: 1;
}
.k-upload__card-hint {
  font-size: var(--k-font-size-sm);
}
.k-upload.is-dragover .k-upload__card-add {
  border-color: var(--k-color-primary);
  color: var(--k-color-primary);
}
/* 圆形卡片墙：卡片与「+」块同尺寸正圆，蒙层/遮罩随 overflow 裁圆 */
.k-upload--picture-circle .k-upload__card,
.k-upload--picture-circle .k-upload__card-add {
  border-radius: 50%;
}

/* ---------- 拖拽反馈 / 禁用 ---------- */
.k-upload__dragover {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--k-color-primary);
  border-radius: var(--k-border-radius);
  background-color: color-mix(in oklab, var(--k-color-primary) 6%, transparent);
  color: var(--k-color-primary);
  pointer-events: none;
}
.k-upload.is-disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* ---------- 触屏排序 ------------- */
.k-upload.is-sortable .k-upload__item,
.k-upload.is-sortable .k-upload__card {
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
.k-upload.is-sort-dragging .k-upload__item,
.k-upload.is-sort-dragging .k-upload__card {
  user-select: none;
}

/* ---------- 预览大图 ---------- */

/* ---------- 交互动画（默认模板；headless 自管） ---------- */
.k-upload__list,
.k-upload__cards {
  position: relative;
}
/* 列表项：新增进场 / 删除退场 / 排序 FLIP */
.k-upload .k-upload-item-enter-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.k-upload .k-upload-item-leave-active {
  position: absolute;
  inset-inline: 0;
  top: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
  pointer-events: none;
}
.k-upload .k-upload-item-enter-from {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
.k-upload .k-upload-item-leave-to {
  opacity: 0;
  transform: translateX(24px) scale(0.98);
}
.k-upload .k-upload-item-move {
  transition: transform 0.22s var(--k-motion-ease-out-cubic);
}
/* 卡片：进场 / 退场 / 排序 */
.k-upload .k-upload-card-enter-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.k-upload .k-upload-card-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
  pointer-events: none;
}
.k-upload .k-upload-card-enter-from {
  opacity: 0;
  transform: scale(0.88);
}
.k-upload .k-upload-card-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
.k-upload .k-upload-card-move {
  transition: transform 0.22s var(--k-motion-ease-out-cubic);
}
/* 失败抖动：进入 error 态即播一次；重试后再次失败会重播 */
.k-upload__item[data-status='error'],
.k-upload__card[data-status='error'] {
  animation: k-upload-shake 0.32s var(--k-motion-ease-in-out-cubic);
}
@keyframes k-upload-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  50% { transform: translateX(4px); }
  75% { transform: translateX(-2px); }
}

/* 触屏：无 hover，卡片操作常显为底部小按钮；列表重传按钮常显 */
@media (hover: none) {
  .k-upload__card-overlay {
    opacity: 1;
    flex-direction: row;
    align-items: flex-end;
    justify-content: center;
    gap: var(--k-size-xs);
    padding-bottom: var(--k-size-xs);
    background: linear-gradient(to top, rgb(0 0 0 / 45%), transparent 55%);
  }
  .k-upload__card-overlay-action {
    width: 28px;
    height: 28px;
    justify-content: center;
    border-radius: 50%;
    background-color: rgb(0 0 0 / 55%);
  }
  .k-upload__replace-action {
    display: inline-flex;
  }
}
.k-upload__card-overlay-action:focus-visible,
.k-upload__action:focus-visible,
.k-upload__name:focus-visible,
.k-upload__card-mask:focus-visible {
  outline: 2px solid var(--k-color-primary);
  outline-offset: 2px;
  border-radius: var(--k-border-radius-sm);
}
</style>
