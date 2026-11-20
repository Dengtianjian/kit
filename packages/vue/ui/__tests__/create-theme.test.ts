import test from 'node:test';
import assert from 'node:assert/strict';
import { createTheme } from '../themes/create-theme.ts';

test('breakpoints emit --k-screen-* tokens in sorted order', () => {
  const css = createTheme({ breakpoints: { md: 1000, sm: 480 } }).cssText();
  assert.match(css, /--k-screen-md: 1000px;/);
  assert.match(css, /--k-screen-sm: 480px;/);
  assert.ok(css.indexOf('--k-screen-md') < css.indexOf('--k-screen-sm'));
});

test('platform.mobile media query follows custom md', () => {
  const css = createTheme({
    breakpoints: { md: 1000 },
    platform: { mobile: { alias: { padding: 20 } } },
  }).cssText();
  assert.match(css, /@media \(max-width: 999px\)/);
  assert.match(css, /--k-padding: 20px;/);
});

test('platform.mobile keeps 767px default without breakpoints', () => {
  const css = createTheme({ platform: { mobile: { alias: { padding: 20 } } } }).cssText();
  assert.match(css, /@media \(max-width: 767px\)/);
});

test('breakpoints alone still emit a scoped block', () => {
  const css = createTheme({ breakpoints: { lg: 1100 } }).cssText('.k-scope-x');
  assert.match(css, /\.k-scope-x \{/);
  assert.match(css, /--k-screen-lg: 1100px;/);
});

test('component variables get px unless dimensionless', () => {
  const css = createTheme({
    components: { KButton: { radius: 10, lineHeight: 1.6 } },
  }).cssText();
  assert.match(css, /--k-button-radius: 10px;/);
  assert.match(css, /--k-button-line-height: 1.6;/);
});

test('cssText is stable for the same config', () => {
  const config = { seed: { colorPrimary: '#1677ff' }, breakpoints: { md: 900 } };
  assert.equal(createTheme(config).cssText(), createTheme(config).cssText());
});