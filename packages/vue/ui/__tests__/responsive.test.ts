import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isResponsiveMap,
  isResponsiveString,
  parseResponsiveString,
  resolveResponsiveValue,
} from '../composables/useResponsiveValue.ts';
import { computeOverlayPosition } from '../utils/overlay.ts';

test('responsive string sugar parses known breakpoints only', () => {
  assert.deepEqual(parseResponsiveString('xs:8px md:24px'), { xs: '8px', md: '24px' });
  assert.deepEqual(parseResponsiveString('xs:8 foo:20 md:24'), { xs: '8', md: '24' });
  assert.equal(isResponsiveString('xs:8'), true);
  assert.equal(isResponsiveString('hello'), false);
});

test('responsive map detection rejects empty/unknown keys', () => {
  assert.equal(isResponsiveMap({ xs: 8, md: 24 }), true);
  assert.equal(isResponsiveMap({}), false);
  assert.equal(isResponsiveMap({ huge: 8 }), false);
  assert.equal(isResponsiveMap([8]), false);
});

test('resolveResponsiveValue falls back to lower breakpoints', () => {
  const map = { xs: 8, md: 24 };
  assert.equal(resolveResponsiveValue(map, 'xs'), 8);
  assert.equal(resolveResponsiveValue(map, 'sm'), 8);
  assert.equal(resolveResponsiveValue(map, 'md'), 24);
  assert.equal(resolveResponsiveValue(map, 'xxl'), 24);
  assert.equal(resolveResponsiveValue({ md: 24 }, 'sm'), undefined);
  assert.equal(resolveResponsiveValue('fixed', 'md'), 'fixed');
});

test('overlay flips only when the preferred side does not fit', () => {
  const anchor = { top: 100, bottom: 130, left: 100, right: 200 };
  const size = { width: 120, height: 80 };
  const viewport = { width: 800, height: 600 };
  const top = computeOverlayPosition(anchor, size, 'top', 8, viewport);
  assert.equal(top.placement, 'top');
  const bottom = computeOverlayPosition(anchor, size, 'bottom', 8, viewport);
  assert.equal(bottom.placement, 'bottom');
  const nearTop = { ...anchor, top: 10, bottom: 40 };
  assert.equal(computeOverlayPosition(nearTop, size, 'top', 8, viewport).placement, 'bottom');
  const nearRight = { top: 100, bottom: 130, left: 720, right: 780 };
  assert.equal(computeOverlayPosition(nearRight, size, 'right', 8, viewport).placement, 'left');
});