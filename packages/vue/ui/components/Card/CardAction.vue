<template>
  <KButton class="k-card__action" :wave="false" v-bind="$attrs">
    <slot />
  </KButton>
</template>

<script setup lang="ts">
import type { VNodeChild } from 'vue';
import KButton from '../Button/Button.vue';

defineOptions({ name: 'KCardAction', inheritAttrs: false });

defineSlots<{
  default?(): VNodeChild;
}>();
</script>