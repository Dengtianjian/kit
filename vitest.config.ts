import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    include: ['packages/vue/ui/__tests__/dom/**/*.test.ts'],
    setupFiles: ['./scripts/vitest-setup.ts'],
    restoreMocks: true,
  },
});