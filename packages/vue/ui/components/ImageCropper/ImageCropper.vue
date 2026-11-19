<template>
  <div class="k-cropper" :class="classNames?.root" :style="styles?.root">
    <KAlert
      class="k-cropper__alert"
      type="info"
      message="拖动裁剪框移动，四角 + 四边中点调整大小；PC 按住 Shift + 鼠标拖动控制点临时锁定比例，也可选固定比例或打开「锁定比例」开关。键盘：方向键移动（Shift 加速），Alt + 方向键调整大小。"
    />
    <div ref="stage" class="k-cropper__stage">
      <img
        v-if="src"
        ref="imgEl"
        class="k-cropper__image"
        :src="src"
        alt="待裁剪图片"
        draggable="false"
        @load="onImgLoad"
      />
      <div
        v-if="ready"
        class="k-cropper__box"
        :class="classNames?.box"
        :style="[boxStyle, styles?.box]"
        role="group"
        tabindex="0"
        aria-label="裁剪框：方向键移动，Shift 加速，Alt 加方向键调整大小"
        @pointerdown="startDrag($event, 'move')"
        @keydown="onBoxKeydown"
      >
        <span
          aria-hidden="true"
          class="k-cropper__handle k-cropper__handle--nw" :class="classNames?.handle"
          @pointerdown.stop="startDrag($event, 'nw')"
        />
        <span
          aria-hidden="true"
          class="k-cropper__handle k-cropper__handle--ne" :class="classNames?.handle"
          @pointerdown.stop="startDrag($event, 'ne')"
        />
        <span
          aria-hidden="true"
          class="k-cropper__handle k-cropper__handle--sw" :class="classNames?.handle"
          @pointerdown.stop="startDrag($event, 'sw')"
        />
        <span
          aria-hidden="true"
          class="k-cropper__handle k-cropper__handle--se" :class="classNames?.handle"
          @pointerdown.stop="startDrag($event, 'se')"
        />
        <template v-if="!aspectRatio">
          <span
            aria-hidden="true"
            class="k-cropper__handle k-cropper__handle--n" :class="classNames?.handle"
            @pointerdown.stop="startDrag($event, 'n')"
          />
          <span
            aria-hidden="true"
            class="k-cropper__handle k-cropper__handle--e" :class="classNames?.handle"
            @pointerdown.stop="startDrag($event, 'e')"
          />
          <span
            aria-hidden="true"
            class="k-cropper__handle k-cropper__handle--s" :class="classNames?.handle"
            @pointerdown.stop="startDrag($event, 's')"
          />
          <span
            aria-hidden="true"
            class="k-cropper__handle k-cropper__handle--w" :class="classNames?.handle"
            @pointerdown.stop="startDrag($event, 'w')"
          />
        </template>
      </div>
    </div>
    <div class="k-cropper__toolbar">
      <span v-if="!aspectRatio" class="k-cropper__ratios">
        <KButton
          v-for="preset in ratioPresets"
          :key="preset.label"
          size="xs"
          :type="
            (
              preset.value === null
                ? !ratioLocked
                : ratioLocked && activeRatio === preset.value
            )
              ? 'primary'
              : 'default'
          "
          @click="applyRatio(preset.value)"
        >
          <template #icon>
            <component :is="preset.icon" :stroke-width="1.5" />
          </template>
          {{ preset.label }}
        </KButton>
      </span>
      <span class="k-cropper__lock">
        <KSwitch
          :model-value="aspectRatio ? true : ratioLocked"
          :disabled="!!aspectRatio"
          size="small"
          @update:model-value="onLockChange"
        />
        <span>锁定比例</span>
      </span>
    </div>
    <div class="k-cropper__footer">
      <KButton size="sm" @click="closeWithCancel">取消</KButton>
      <KButton size="sm" @click="resetBox">重置</KButton>
      <KButton
        size="sm"
        type="primary"
        :disabled="!file || !ready"
        @click="confirmCrop"
        >确定</KButton
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import type { CSSProperties } from "vue";
import KButton from "../Button/Button.vue";
import KSwitch from "../Switch/Switch.vue";
import KAlert from "../Alert/Alert.vue";
import {
  IconAspectRatio,
  IconCrop11,
  IconCrop169,
  IconCrop32,
  IconCropLandscape,
  IconCropPortrait,
  IconCrop54,
  IconCrop75,
} from "@tabler/icons-vue";

defineOptions({ name: "KImageCropper" });

export type KImageCropperPart = "root" | "alert" | "stage" | "box" | "handle" | "toolbar" | "ratios" | "footer";

const props = withDefaults(
  defineProps<{
    file: File | null;
    aspectRatio?: number;
    /** 输出 MIME；缺省沿用原图（PNG 保透明） */
    type?: string;
    quality?: number;
    classNames?: Partial<Record<KImageCropperPart, string>>;
    styles?: Partial<Record<KImageCropperPart, CSSProperties>>;
  }>(),
  { quality: 0.92 },
);

const emit = defineEmits<{
  confirm: [file: File];
  cancel: [];
}>();

const stage = ref<HTMLElement | null>(null);
const imgEl = ref<HTMLImageElement | null>(null);
const ready = ref(false);
const ratioLocked = ref(false);
const lockedRatio = ref<number | null>(null);
const box = reactive({ x: 0, y: 0, w: 0, h: 0 });
const imageRect = reactive({ x: 0, y: 0, w: 0, h: 0 });
let objectUrl = "";
const src = ref("");

watch(
  () => props.file,
  (file) => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = file ? URL.createObjectURL(file) : "";
    src.value = objectUrl;
    ready.value = false;
    ratioLocked.value = false;
    lockedRatio.value = null;
    void nextTick(() => {
      const img = imgEl.value;
      if (img?.complete) measureImage();
    });
  },
  { immediate: true },
);

function measureImage() {
  const s = stage.value;
  const img = imgEl.value;
  if (!s || !img || !img.complete || !img.naturalWidth) return;
  // offset* 不受 Modal 入场 transform 缩放影响
  imageRect.x = img.offsetLeft;
  imageRect.y = img.offsetTop;
  imageRect.w = img.offsetWidth;
  imageRect.h = img.offsetHeight;
  if (!ready.value) resetBox();
  else clampBox();
  ready.value = true;
}

const ratioPresets = [
  { label: "自由", value: null as number | null, icon: IconAspectRatio },
  { label: "1:1", value: 1, icon: IconCrop11 },
  { label: "4:3", value: 4 / 3, icon: IconCropLandscape },
  { label: "3:4", value: 3 / 4, icon: IconCropPortrait },
  { label: "16:9", value: 16 / 9, icon: IconCrop169 },
  { label: "3:2", value: 3 / 2, icon: IconCrop32 },
  { label: "5:4", value: 5 / 4, icon: IconCrop54 },
  { label: "7:5", value: 7 / 5, icon: IconCrop75 },
];

const activeRatio = computed<number | null | undefined>(() => {
  if (!ratioLocked.value || lockedRatio.value == null) return null;
  const hit = ratioPresets.find(
    (preset) =>
      preset.value != null &&
      Math.abs(preset.value - lockedRatio.value!) < 0.01,
  );
  return hit ? hit.value : undefined;
});

function onLockChange(locked: boolean) {
  if (props.aspectRatio) return;
  if (locked) {
    lockedRatio.value = box.h > 0 ? box.w / box.h : null;
    ratioLocked.value = true;
  } else {
    ratioLocked.value = false;
    lockedRatio.value = null;
  }
}

function applyRatio(ratio: number | null) {
  if (ratio == null) {
    ratioLocked.value = false;
    lockedRatio.value = null;
    return;
  }
  lockedRatio.value = ratio;
  ratioLocked.value = true;
  const maxW = imageRect.w * 0.8;
  const maxH = imageRect.h * 0.8;
  const w = Math.min(maxW, maxH * ratio);
  const h = w / ratio;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  box.w = w;
  box.h = h;
  box.x = cx - w / 2;
  box.y = cy - h / 2;
  clampBox();
}

function resetBox() {
  const ratio = props.aspectRatio;
  let w = imageRect.w * 0.8;
  let h = imageRect.h * 0.8;
  if (ratio) {
    if (w / h > ratio) w = h * ratio;
    else h = w / ratio;
  }
  box.w = w;
  box.h = h;
  box.x = imageRect.x + (imageRect.w - w) / 2;
  box.y = imageRect.y + (imageRect.h - h) / 2;
}

function clampBox() {
  box.w = Math.min(box.w, imageRect.w);
  box.h = Math.min(box.h, imageRect.h);
  box.x = Math.min(
    Math.max(box.x, imageRect.x),
    imageRect.x + imageRect.w - box.w,
  );
  box.y = Math.min(
    Math.max(box.y, imageRect.y),
    imageRect.y + imageRect.h - box.h,
  );
}

function onBoxKeydown(e: KeyboardEvent) {
  if (!ready.value) return;
  const moveKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
  if (!moveKeys.includes(e.key)) return;
  e.preventDefault();
  const step = e.shiftKey ? 10 : 1;
  const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
  const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
  if (!e.altKey) {
    box.x = Math.min(
      Math.max(box.x + dx, imageRect.x),
      imageRect.x + imageRect.w - box.w,
    );
    box.y = Math.min(
      Math.max(box.y + dy, imageRect.y),
      imageRect.y + imageRect.h - box.h,
    );
    return;
  }
  const ratio = props.aspectRatio ?? (ratioLocked.value ? lockedRatio.value : null);
  const maxW = imageRect.x + imageRect.w - box.x;
  const maxH = imageRect.y + imageRect.h - box.y;
  let w = box.w;
  let h = box.h;
  if (ratio) {
    if (dx) w = Math.min(Math.max(box.w + dx, MIN), maxW);
    else h = Math.min(Math.max(box.h + dy, MIN), maxH);
    if (dx) h = w / ratio;
    else w = h * ratio;
    if (w > maxW) {
      w = maxW;
      h = w / ratio;
    }
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
    if (w < MIN) {
      w = MIN;
      h = w / ratio;
    }
    if (h < MIN) {
      h = MIN;
      w = h * ratio;
    }
  } else {
    w = Math.min(Math.max(box.w + dx, MIN), maxW);
    h = Math.min(Math.max(box.h + dy, MIN), maxH);
  }
  box.w = w;
  box.h = h;
  clampBox();
}

const boxStyle = computed(() => ({
  left: `${box.x}px`,
  top: `${box.y}px`,
  width: `${box.w}px`,
  height: `${box.h}px`,
}));

type DragMode = "move" | "nw" | "ne" | "sw" | "se" | "n" | "e" | "s" | "w";
let dragMode: DragMode | null = null;
let startX = 0;
let startY = 0;
let startBox = { x: 0, y: 0, w: 0, h: 0 };
let shiftDown = false;

function onShiftKey(e: KeyboardEvent) {
  shiftDown = e.shiftKey;
}

function stagePoint(e: PointerEvent) {
  const r = stage.value!.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function startDrag(e: PointerEvent, mode: DragMode) {
  if (!ready.value) return;
  e.preventDefault();
  dragMode = mode;
  startBox = { ...box };
  shiftDown = e.shiftKey;
  const p = stagePoint(e);
  startX = p.x;
  startY = p.y;
  window.addEventListener("pointermove", onDrag);
  window.addEventListener("pointerup", endDrag, { once: true });
  window.addEventListener("keydown", onShiftKey);
  window.addEventListener("keyup", onShiftKey);
}

const MIN = 28;

function onDrag(e: PointerEvent) {
  if (!dragMode) return;
  const p = stagePoint(e);
  const dx = p.x - startX;
  const dy = p.y - startY;
  const ratio =
    props.aspectRatio ??
    (ratioLocked.value
      ? (lockedRatio.value ?? startBox.w / startBox.h)
      : e.shiftKey || shiftDown
        ? startBox.w / startBox.h
        : undefined);
  if (dragMode === "move") {
    box.x = Math.min(
      Math.max(startBox.x + dx, imageRect.x),
      imageRect.x + imageRect.w - box.w,
    );
    box.y = Math.min(
      Math.max(startBox.y + dy, imageRect.y),
      imageRect.y + imageRect.h - box.h,
    );
    return;
  }
  const right = startBox.x + startBox.w;
  const bottom = startBox.y + startBox.h;
  let x = startBox.x;
  let y = startBox.y;
  let w = startBox.w;
  let h = startBox.h;
  if (dragMode.includes("w")) {
    x = Math.min(Math.max(imageRect.x, startBox.x + dx), right - MIN);
    w = right - x;
  }
  if (dragMode.includes("e")) {
    w = Math.min(imageRect.x + imageRect.w - x, Math.max(MIN, startBox.w + dx));
  }
  if (dragMode.includes("n")) {
    y = Math.min(Math.max(imageRect.y, startBox.y + dy), bottom - MIN);
    h = bottom - y;
  }
  if (dragMode.includes("s")) {
    h = Math.min(imageRect.y + imageRect.h - y, Math.max(MIN, startBox.h + dy));
  }
  if (ratio) {
    // 纯上下边以高为主，其余以宽为主；再反推另一轴，避免两边互相抵消
    if (dragMode === "n" || dragMode === "s") w = h * ratio;
    else h = w / ratio;
    if (dragMode.includes("w")) x = right - w;
    if (dragMode.includes("n")) y = bottom - h;
    const maxW = imageRect.x + imageRect.w - x;
    const maxH = imageRect.y + imageRect.h - y;
    if (w > maxW) {
      w = maxW;
      h = w / ratio;
    }
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
    if (w < MIN) {
      w = MIN;
      h = w / ratio;
    }
    if (h < MIN) {
      h = MIN;
      w = h * ratio;
    }
  }
  box.x = x;
  box.y = y;
  box.w = w;
  box.h = h;
  clampBox();
}

function endDrag() {
  dragMode = null;
  shiftDown = false;
  window.removeEventListener("pointermove", onDrag);
  window.removeEventListener("keydown", onShiftKey);
  window.removeEventListener("keyup", onShiftKey);
}

function closeWithCancel() {
  emit("cancel");
}

function confirmCrop() {
  const img = imgEl.value;
  if (!img || !props.file || !imageRect.w) return;
  const scaleX = img.naturalWidth / imageRect.w;
  const scaleY = img.naturalHeight / imageRect.h;
  const sx = (box.x - imageRect.x) * scaleX;
  const sy = (box.y - imageRect.y) * scaleY;
  const sw = box.w * scaleX;
  const sh = box.h * scaleY;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const outType =
    props.type ||
    (props.file.type === "image/png" ? "image/png" : "image/jpeg");
  canvas.toBlob(
    (blob) => {
      if (!blob) return;
      const ext =
        outType === "image/png"
          ? "png"
          : outType === "image/webp"
            ? "webp"
            : "jpg";
      const name = props.file!.name.replace(/\.[^.]+$/, "") + `.${ext}`;
      const out = new File([blob], name, {
        type: blob.type || outType,
        lastModified: Date.now(),
      });
      emit("confirm", out);
    },
    outType,
    props.quality,
  );
}

function onImgLoad() {
  void nextTick(measureImage);
}

function onResize() {
  if (props.file) measureImage();
}

if (typeof window !== "undefined") window.addEventListener("resize", onResize);
onBeforeUnmount(() => {
  window.removeEventListener("resize", onResize);
  window.removeEventListener("pointermove", onDrag);
  if (objectUrl) URL.revokeObjectURL(objectUrl);
});
</script>

<style>
.k-cropper {
  width: 100%;
}
.k-cropper__alert {
  margin-bottom: 12px;
}
.k-cropper__stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 360px;
  max-height: 52vh;
  overflow: hidden;
  background: #111;
  border-radius: var(--k-border-radius);
  user-select: none;
  touch-action: none;
}
.k-cropper__image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  pointer-events: none;
}
.k-cropper__box {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid #fff;
  box-shadow: 0 0 0 9999px rgb(0 0 0 / 50%);
  cursor: move;
  outline: none;
}
.k-cropper__box:focus-visible {
  outline: 2px solid var(--k-color-primary);
  outline-offset: 2px;
}
.k-cropper__handle {
  position: absolute;
  width: 12px;
  height: 12px;
  background: #fff;
  border: 1px solid rgb(0 0 0 / 30%);
  border-radius: 2px;
}
.k-cropper__handle--nw {
  left: -7px;
  top: -7px;
  cursor: nwse-resize;
}
.k-cropper__handle--ne {
  right: -7px;
  top: -7px;
  cursor: nesw-resize;
}
.k-cropper__handle--sw {
  left: -7px;
  bottom: -7px;
  cursor: nesw-resize;
}
.k-cropper__handle--se {
  right: -7px;
  bottom: -7px;
  cursor: nwse-resize;
}
.k-cropper__handle--n {
  left: 50%;
  top: -7px;
  transform: translateX(-50%);
  cursor: ns-resize;
}
.k-cropper__handle--s {
  left: 50%;
  bottom: -7px;
  transform: translateX(-50%);
  cursor: ns-resize;
}
.k-cropper__handle--e {
  top: 50%;
  right: -7px;
  transform: translateY(-50%);
  cursor: ew-resize;
}
.k-cropper__handle--w {
  top: 50%;
  left: -7px;
  transform: translateY(-50%);
  cursor: ew-resize;
}
@media (hover: none), (pointer: coarse) {
  /* 裁剪弹窗在移动端放大到接近全屏，保证裁剪区、比例和 footer 同时可见 */
  .k-modal__wrap:has(.k-cropper) {
    padding: 8px;
    justify-content: center;
  }
  .k-modal__dialog:has(.k-cropper) {
    max-height: calc(100vh - 16px);
  }
  .k-cropper {
    width: 100%;
  }
  .k-cropper__alert {
    margin-bottom: 8px;
  }
  .k-cropper__stage {
    height: min(36vh, 280px);
  }
  /* 视觉保持小点，命中区扩到 ~26px，触屏更好抓 */
  .k-cropper__handle::after {
    content: "";
    position: absolute;
    inset: -8px;
  }
  .k-cropper__toolbar {
    margin-top: 8px;
  }
  .k-cropper__toolbar .k-cropper__ratios {
    width: 100%;
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 2px;
  }
}
.k-cropper__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--k-size);
  margin-top: 10px;
  flex-wrap: wrap;
}
.k-cropper__ratios {
  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xxs);
  flex-wrap: wrap;
}
.k-cropper__ratios .k-button__icon {
  font-size: 16px;
}
.k-cropper__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--k-size-xs);
  margin-top: var(--k-size);
}
.k-cropper__lock {
  display: inline-flex;
  align-items: center;
  gap: var(--k-size-xxs);
  flex: none;
  font-size: var(--k-font-size-sm);
  color: var(--k-color-text-secondary);
}
</style>
