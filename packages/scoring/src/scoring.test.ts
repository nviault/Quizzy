import assert from 'node:assert';
import { test } from 'node:test';
import { ScoringEngine } from './index.js';

test('ScoringEngine - incorrect answer yields 0', () => {
  const score = ScoringEngine.calculateScore({
    basePoints: 1000,
    durationMs: 20000,
    responseTimeMs: 1000,
    isCorrect: false
  });
  assert.strictEqual(score, 0);
});

test('ScoringEngine - instant correct answer yields full points', () => {
  const score = ScoringEngine.calculateScore({
    basePoints: 1000,
    durationMs: 20000,
    responseTimeMs: 0,
    isCorrect: true
  });
  assert.strictEqual(score, 1000);
});

test('ScoringEngine - half duration answer yields 75% points', () => {
  const score = ScoringEngine.calculateScore({
    basePoints: 1000,
    durationMs: 20000,
    responseTimeMs: 10000,
    isCorrect: true
  });
  assert.strictEqual(score, 750);
});

test('ScoringEngine - NoSpeed mode yields full points regardless of speed', () => {
  const score = ScoringEngine.calculateScore({
    basePoints: 1000,
    durationMs: 20000,
    responseTimeMs: 19000,
    isCorrect: true,
    mode: 'NoSpeed'
  });
  assert.strictEqual(score, 1000);
});
