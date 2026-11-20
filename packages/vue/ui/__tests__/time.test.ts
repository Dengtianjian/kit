import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTimeList,
  clampTimePart,
  formatTimeLabel,
  formatTimeString,
  normalizeTimeParts,
  parseTimeString,
  timeToSeconds,
} from '../utils/time.ts';

test('time parsing accepts HH:mm and HH:mm:ss', () => {
  assert.deepEqual(parseTimeString('09:05'), { hour: 9, minute: 5, second: 0 });
  assert.deepEqual(parseTimeString('23:59:58'), { hour: 23, minute: 59, second: 58 });
  assert.equal(parseTimeString('24:00'), null);
  assert.equal(parseTimeString('12:60'), null);
  assert.equal(parseTimeString('noon'), null);
});

test('time formatting pads and can omit seconds', () => {
  assert.equal(formatTimeString({ hour: 7, minute: 3, second: 4 }), '07:03:04');
  assert.equal(formatTimeString({ hour: 7, minute: 3, second: 4 }, false), '07:03');
  assert.equal(formatTimeLabel(7), '07');
});

test('time parts normalize and convert to seconds', () => {
  assert.deepEqual(normalizeTimeParts({ hour: 30, minute: -1, second: 80 }), {
    hour: 23,
    minute: 0,
    second: 59,
  });
  assert.equal(clampTimePart(12.6, 23), 13);
  assert.equal(timeToSeconds({ hour: 1, minute: 2, second: 3 }), 3723);
});

test('time lists honor step and bounds', () => {
  assert.deepEqual(buildTimeList(15, 59), [0, 15, 30, 45]);
  assert.deepEqual(buildTimeList(0, 10), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});