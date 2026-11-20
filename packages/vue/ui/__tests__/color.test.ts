import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatColor,
  hexToRgb,
  hslToRgb,
  hsvToRgb,
  parseColor,
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
} from '../utils/color.ts';

test('hex parsing supports short, long and alpha forms', () => {
  assert.deepEqual(hexToRgb('#f80'), { r: 255, g: 136, b: 0, a: 1 });
  assert.deepEqual(hexToRgb('#ff8800'), { r: 255, g: 136, b: 0, a: 1 });
  assert.deepEqual(hexToRgb('#ff880080'), { r: 255, g: 136, b: 0, a: 128 / 255 });
  assert.equal(hexToRgb('#xyz'), null);
});

test('rgb/hsl strings parse and format', () => {
  assert.deepEqual(parseColor('rgb(255, 136, 0)'), { r: 255, g: 136, b: 0, a: 1 });
  assert.deepEqual(parseColor('rgba(255, 136, 0, 0.5)'), { r: 255, g: 136, b: 0, a: 0.5 });
  const hsl = parseColor('hsl(32, 100%, 50%)');
  assert.ok(hsl);
  assert.equal(hsl.r, 255);
  assert.equal(formatColor({ r: 255, g: 136, b: 0, a: 1 }, 'rgb'), 'rgb(255, 136, 0)');
  assert.equal(formatColor({ r: 255, g: 136, b: 0, a: 0.5 }, 'rgb'), 'rgba(255, 136, 0, 0.5)');
  assert.equal(formatColor({ r: 255, g: 136, b: 0, a: 1 }, 'hex'), '#ff8800');
});

test('rgb/hsv/hsl conversions round trip primary colors', () => {
  assert.deepEqual(hsvToRgb(0, 1, 1), { r: 255, g: 0, b: 0 });
  assert.deepEqual(rgbToHsv(0, 255, 0), { h: 120, s: 1, v: 1 });
  const hsl = rgbToHsl(0, 0, 255);
  assert.equal(Math.round(hsl.h), 240);
  assert.deepEqual(hslToRgb(240, 1, 0.5), { r: 0, g: 0, b: 255 });
  assert.equal(rgbToHex({ r: 255, g: 136, b: 0, a: 1 }), '#ff8800');
});