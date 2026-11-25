import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAnnotationLayout,
  computeCropPixelRect,
  extractPaletteFromPixels,
  formatPromptsForClipboard,
  normalizeAnalysisReport,
  normalizeCropBox,
  normalizeHexColor,
} from './analysisLogic';
import type { VisualAnnotation } from '../types/analysis';

test('normalizeHexColor validates 6-digit, 3-digit, and invalid strings', () => {
  assert.equal(normalizeHexColor('#a1b2c3'), '#A1B2C3');
  assert.equal(normalizeHexColor('0f8'), '#00FF88');
  assert.equal(normalizeHexColor('not-a-color', '#112233'), '#112233');
});

test('normalizeCropBox clamps coordinates, fixes inverted bounds, and enforces minimum span', () => {
  assert.deepEqual(normalizeCropBox([800, 700, 200, 100]), [200, 100, 800, 700]);
  const tiny = normalizeCropBox([500, 500, 505, 505]);
  assert.ok(tiny[2] - tiny[0] >= 100);
  assert.ok(tiny[3] - tiny[1] >= 100);
});

test('computeCropPixelRect converts normalized box into valid integer pixel bounds', () => {
  const rect = computeCropPixelRect([100, 200, 500, 700], 1600, 1200);
  assert.deepEqual(rect, { x: 320, y: 120, width: 800, height: 480 });
});

test('computeAnnotationLayout prevents vertical collisions in dense annotation clusters', () => {
  const clustered: VisualAnnotation[] = [
    { id: '1', title: 'A', observation: 'o1', anchorX: 150, anchorY: 300 },
    { id: '2', title: 'B', observation: 'o2', anchorX: 180, anchorY: 310 },
    { id: '3', title: 'C', observation: 'o3', anchorX: 200, anchorY: 320 },
    { id: '4', title: 'D', observation: 'o4', anchorX: 800, anchorY: 400 },
    { id: '5', title: 'E', observation: 'o5', anchorX: 820, anchorY: 410 },
  ];

  const placed = computeAnnotationLayout(clustered, 0.2);
  assert.equal(placed.length, 5);

  const leftCards = placed
    .filter((p) => p.side === 'left')
    .sort((a, b) => a.cardY - b.cardY);
  for (let i = 1; i < leftCards.length; i++) {
    assert.ok(
      leftCards[i].cardY - leftCards[i - 1].cardY >= 0.199,
      `Expected non-overlapping gap on left lane, got ${leftCards[i].cardY - leftCards[i - 1].cardY}`
    );
  }
});

test('extractPaletteFromPixels extracts distinct representative HEX swatches', () => {
  // Build a 10x10 synthetic image with two clear color blocks: deep forest green & warm amber
  const pixels = new Uint8ClampedArray(10 * 10 * 4);
  for (let i = 0; i < 100; i++) {
    const isFirstHalf = i < 60;
    pixels[i * 4] = isFirstHalf ? 24 : 210;
    pixels[i * 4 + 1] = isFirstHalf ? 48 : 140;
    pixels[i * 4 + 2] = isFirstHalf ? 36 : 70;
    pixels[i * 4 + 3] = 255;
  }
  const palette = extractPaletteFromPixels(pixels, 10, 10, 2);
  assert.equal(palette.length, 2);
  assert.equal(palette[0], '#183024');
  assert.equal(palette[1], '#D28C46');
});

test('normalizeAnalysisReport sanitizes partial AI output safely', () => {
  const report = normalizeAnalysisReport({
    title: '测试肖像分析',
    genre: '人物肖像',
    annotations: [
      { title: '窗侧高光', observation: '柔光塑造颧骨轮廓', anchorX: 1200, anchorY: -50 },
    ],
    keywords: [{ label: '侧逆光', description: '高光与暗部过渡自然' }],
    composition: {
      primaryMethod: '三分法构图',
      compositionPoints: '主体位于右侧三分线。',
      cameraAndLens: '视觉推测接近中焦段平视视角。',
      guides: [{ kind: 'invalid_kind', coords: [500, 500] }],
    },
    details: [{ title: '毛呢肌理', explanation: '织物细节清晰', box: [400, 600, 700, 900] }],
    lighting: [{ tag: '主光方向', description: '左侧窗光柔和漫射' }],
    palette: [{ hex: '2a3b32', name: '深墨绿', usage: '暗部主基调' }],
    prompts: { chinese: '中文描述', english: 'English prompt' },
  });

  assert.equal(report.annotations[0].anchorX, 970);
  assert.equal(report.annotations[0].anchorY, 30);
  assert.equal(report.composition.guides[0].kind, 'focal_point');
  assert.equal(report.palette[0].hex, '#2A3B32');

  const formatted = formatPromptsForClipboard(report);
  assert.ok(formatted.includes('中文描述'));
  assert.ok(formatted.includes('English prompt'));
});
