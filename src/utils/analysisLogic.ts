import type {
  ColorSwatch,
  CompositionGuide,
  CompositionGuideKind,
  DetailCrop,
  KeywordAnchor,
  LightingFeature,
  PhotoAnalysisReport,
  PixelRect,
  PlacedAnnotation,
  VisualAnnotation,
} from '../types/analysis';

const VALID_GUIDE_KINDS: ReadonlySet<CompositionGuideKind> = new Set([
  'rule_of_thirds',
  'center_axis',
  'leading_line',
  'diagonal',
  'vanishing_point',
  'frame_box',
  'focal_point',
  'curve',
]);

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function normalizeHexColor(input: string, fallback = '#2E3A33'): string {
  const cleaned = String(input || '').trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned.toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const expanded = cleaned
      .split('')
      .map((c) => c + c)
      .join('');
    return `#${expanded.toUpperCase()}`;
  }
  return fallback;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toByte = (v: number) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`.toUpperCase();
}

export function normalizeCropBox(raw: unknown): [number, number, number, number] {
  if (!Array.isArray(raw) || raw.length < 4) {
    return [250, 250, 650, 650];
  }
  let ymin = clamp(Number(raw[0]), 0, 1000);
  let xmin = clamp(Number(raw[1]), 0, 1000);
  let ymax = clamp(Number(raw[2]), 0, 1000);
  let xmax = clamp(Number(raw[3]), 0, 1000);

  if (ymin > ymax) [ymin, ymax] = [ymax, ymin];
  if (xmin > xmax) [xmin, xmax] = [xmax, xmin];

  const minSpan = 100;
  if (ymax - ymin < minSpan) {
    const mid = (ymin + ymax) / 2;
    ymin = clamp(mid - minSpan / 2, 0, 1000 - minSpan);
    ymax = ymin + minSpan;
  }
  if (xmax - xmin < minSpan) {
    const mid = (xmin + xmax) / 2;
    xmin = clamp(mid - minSpan / 2, 0, 1000 - minSpan);
    xmax = xmin + minSpan;
  }

  return [Math.round(ymin), Math.round(xmin), Math.round(ymax), Math.round(xmax)];
}

export function computeCropPixelRect(
  box: [number, number, number, number],
  imgWidth: number,
  imgHeight: number
): PixelRect {
  const safeW = Math.max(1, Math.round(imgWidth));
  const safeH = Math.max(1, Math.round(imgHeight));
  const [ymin, xmin, ymax, xmax] = normalizeCropBox(box);

  const x = Math.round((xmin / 1000) * safeW);
  const y = Math.round((ymin / 1000) * safeH);
  const right = Math.round((xmax / 1000) * safeW);
  const bottom = Math.round((ymax / 1000) * safeH);

  return {
    x: clamp(x, 0, safeW - 1),
    y: clamp(y, 0, safeH - 1),
    width: Math.max(1, Math.min(safeW - x, right - x)),
    height: Math.max(1, Math.min(safeH - y, bottom - y)),
  };
}

/**
 * Distributes 5–8 visual annotations into Left and Right editorial margin lanes
 * and resolves vertical overlap so callout cards never collide or cover the core subject.
 */
export function computeAnnotationLayout(
  annotations: VisualAnnotation[],
  minGap = 0.21
): PlacedAnnotation[] {
  if (!annotations.length) return [];

  const leftItems: PlacedAnnotation[] = [];
  const rightItems: PlacedAnnotation[] = [];

  for (const ann of annotations) {
    const side: 'left' | 'right' =
      ann.preferredSide ?? (ann.anchorX <= 500 ? 'left' : 'right');
    const target: PlacedAnnotation = {
      annotation: ann,
      side,
      cardY: clamp(ann.anchorY / 1000, 0.08, 0.92),
    };
    if (side === 'left') {
      leftItems.push(target);
    } else {
      rightItems.push(target);
    }
  }

  // Rebalance if one side has way more than the other (e.g. > 5 on one side)
  const rebalance = (heavy: PlacedAnnotation[], light: PlacedAnnotation[], lightSide: 'left' | 'right') => {
    while (heavy.length - light.length > 2 && heavy.length > 4) {
      // Pick the item closest to the horizontal center (x = 500)
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < heavy.length; i++) {
        const dist = Math.abs(heavy[i].annotation.anchorX - 500);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      const [moved] = heavy.splice(bestIdx, 1);
      moved.side = lightSide;
      light.push(moved);
    }
  };

  rebalance(leftItems, rightItems, 'right');
  rebalance(rightItems, leftItems, 'left');

  const relaxLane = (lane: PlacedAnnotation[]) => {
    if (lane.length === 0) return;
    lane.sort((a, b) => a.annotation.anchorY - b.annotation.anchorY);

    const topBound = 0.08;
    const bottomBound = 0.92;
    const availableSpan = bottomBound - topBound;
    const effectiveGap =
      lane.length > 1 ? Math.min(minGap, availableSpan / (lane.length - 1)) : minGap;

    // Forward pass: enforce minimum spacing downward
    lane[0].cardY = clamp(lane[0].cardY, topBound, bottomBound);
    for (let i = 1; i < lane.length; i++) {
      if (lane[i].cardY - lane[i - 1].cardY < effectiveGap) {
        lane[i].cardY = lane[i - 1].cardY + effectiveGap;
      }
    }

    // Backward pass: pull back if the last item exceeded bottomBound
    if (lane[lane.length - 1].cardY > bottomBound) {
      lane[lane.length - 1].cardY = bottomBound;
      for (let i = lane.length - 2; i >= 0; i--) {
        if (lane[i + 1].cardY - lane[i].cardY < effectiveGap) {
          lane[i].cardY = lane[i + 1].cardY - effectiveGap;
        }
      }
    }

    // Clamp top again just in case
    for (let i = 0; i < lane.length; i++) {
      lane[i].cardY = Number(clamp(lane[i].cardY, topBound, bottomBound).toFixed(4));
    }
  };

  relaxLane(leftItems);
  relaxLane(rightItems);

  return [...leftItems, ...rightItems];
}

/**
 * Deterministic quantized color extraction from raw RGBA pixel buffer.
 * Useful for verifying authentic palette hues directly from uploaded photos.
 */
export function extractPaletteFromPixels(
  rgba: Uint8ClampedArray | number[],
  width: number,
  height: number,
  count = 6
): string[] {
  const totalPixels = Math.floor(Math.min(rgba.length / 4, width * height));
  if (totalPixels <= 0 || count <= 0) return [];

  const buckets = new Map<
    string,
    { rSum: number; gSum: number; bSum: number; n: number }
  >();
  const step = Math.max(1, Math.floor(totalPixels / 4000));

  for (let p = 0; p < totalPixels; p += step) {
    const idx = p * 4;
    const a = rgba[idx + 3] ?? 255;
    if (a < 128) continue;
    const r = rgba[idx] ?? 0;
    const g = rgba[idx + 1] ?? 0;
    const b = rgba[idx + 2] ?? 0;

    // 5-bit quantization (32 levels per channel -> 24-unit buckets)
    const qr = Math.floor(r / 24);
    const qg = Math.floor(g / 24);
    const qb = Math.floor(b / 24);
    const key = `${qr}-${qg}-${qb}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.rSum += r;
      bucket.gSum += g;
      bucket.bSum += b;
      bucket.n += 1;
    } else {
      buckets.set(key, { rSum: r, gSum: g, bSum: b, n: 1 });
    }
  }

  const sorted = Array.from(buckets.values())
    .map((b) => ({
      r: b.rSum / b.n,
      g: b.gSum / b.n,
      b: b.bSum / b.n,
      n: b.n,
    }))
    .sort((a, b) => b.n - a.n);

  const selected: Array<{ r: number; g: number; b: number }> = [];
  const colorDist = (
    c1: { r: number; g: number; b: number },
    c2: { r: number; g: number; b: number }
  ) => Math.hypot(c1.r - c2.r, c1.g - c2.g, c1.b - c2.b);

  // First pass: pick perceptually distinct dominant colors
  for (const candidate of sorted) {
    if (selected.length >= count) break;
    if (selected.every((s) => colorDist(s, candidate) >= 44)) {
      selected.push(candidate);
    }
  }

  // Second pass with relaxed threshold if monochrome / minimal palette
  for (const candidate of sorted) {
    if (selected.length >= count) break;
    if (selected.every((s) => colorDist(s, candidate) >= 16)) {
      selected.push(candidate);
    }
  }

  // Fill remainder from top sorted buckets if image is extremely uniform
  for (const candidate of sorted) {
    if (selected.length >= count) break;
    selected.push(candidate);
  }

  return selected.slice(0, count).map((c) => rgbToHex(c.r, c.g, c.b));
}

export function normalizeAnalysisReport(raw: unknown): PhotoAnalysisReport {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const rawAnnotations = Array.isArray(data.annotations) ? data.annotations : [];
  const annotations: VisualAnnotation[] = rawAnnotations
    .slice(0, 8)
    .map((item, idx) => {
      const a = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const anchorX = Math.round(clamp(Number(a.anchorX ?? 500), 30, 970));
      const anchorY = Math.round(clamp(Number(a.anchorY ?? 500), 30, 970));
      const preferredSide: 'left' | 'right' =
        a.preferredSide === 'left' || a.preferredSide === 'right'
          ? a.preferredSide
          : anchorX <= 500
            ? 'left'
            : 'right';
      return {
        id: String(a.id || `ann-${idx + 1}`),
        title: String(a.title || `视觉要点 ${idx + 1}`).trim(),
        observation: String(a.observation || '').trim(),
        anchorX,
        anchorY,
        preferredSide,
      };
    })
    .filter((a) => a.title.length > 0 && a.observation.length > 0);

  const rawKeywords = Array.isArray(data.keywords) ? data.keywords : [];
  const keywords: KeywordAnchor[] = rawKeywords
    .slice(0, 9)
    .map((item) => {
      const k = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      return {
        label: String(k.label || '').trim(),
        description: String(k.description || '').trim(),
      };
    })
    .filter((k) => k.label.length > 0 && k.description.length > 0);

  const compRaw = (data.composition && typeof data.composition === 'object'
    ? data.composition
    : {}) as Record<string, unknown>;
  const rawGuides = Array.isArray(compRaw.guides) ? compRaw.guides : [];
  const guides: CompositionGuide[] = rawGuides
    .slice(0, 8)
    .map((item) => {
      const g = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const kind = VALID_GUIDE_KINDS.has(g.kind as CompositionGuideKind)
        ? (g.kind as CompositionGuideKind)
        : 'focal_point';
      const coords = Array.isArray(g.coords)
        ? g.coords.map((n) => Math.round(clamp(Number(n), 0, 1000)))
        : [];
      return {
        kind,
        label: g.label ? String(g.label).trim() : undefined,
        coords,
      };
    });

  const rawDetails = Array.isArray(data.details) ? data.details : [];
  const details: DetailCrop[] = rawDetails
    .slice(0, 5)
    .map((item, idx) => {
      const d = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      return {
        id: String(d.id || `detail-${idx + 1}`),
        title: String(d.title || `细节 ${idx + 1}`).trim(),
        explanation: String(d.explanation || '').trim(),
        box: normalizeCropBox(d.box),
      };
    })
    .filter((d) => d.title.length > 0);

  const rawLighting = Array.isArray(data.lighting) ? data.lighting : [];
  const lighting: LightingFeature[] = rawLighting
    .slice(0, 6)
    .map((item) => {
      const l = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      return {
        tag: String(l.tag || '').trim(),
        description: String(l.description || '').trim(),
      };
    })
    .filter((l) => l.tag.length > 0 && l.description.length > 0);

  const rawPalette = Array.isArray(data.palette) ? data.palette : [];
  const palette: ColorSwatch[] = rawPalette.slice(0, 6).map((item, idx) => {
    const p = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      hex: normalizeHexColor(String(p.hex || ''), '#3A4A40'),
      name: String(p.name || `色阶 ${idx + 1}`).trim(),
      usage: String(p.usage || '画面色彩组成部分').trim(),
      approximate: p.approximate !== false,
    };
  });

  const promptsRaw = (data.prompts && typeof data.prompts === 'object'
    ? data.prompts
    : {}) as Record<string, unknown>;

  return {
    title: String(data.title || '照片视觉基因分析档案').trim(),
    genre: String(data.genre || '综合摄影').trim(),
    visualSignature: String(data.visualSignature || '').trim(),
    annotations,
    keywords,
    composition: {
      primaryMethod: String(compRaw.primaryMethod || '视觉重心与空间层次组织').trim(),
      compositionPoints: String(compRaw.compositionPoints || '').trim(),
      cameraAndLens: String(compRaw.cameraAndLens || '').trim(),
      guides: guides.length > 0 ? guides : [{ kind: 'rule_of_thirds', coords: [] }],
    },
    details,
    lighting,
    palette,
    prompts: {
      chinese: String(promptsRaw.chinese || '').trim(),
      english: String(promptsRaw.english || '').trim(),
    },
  };
}

export function formatPromptsForClipboard(report: PhotoAnalysisReport): string {
  return [
    `【${report.title} · 视觉反推提示词】`,
    '',
    '中文 Prompt：',
    report.prompts.chinese,
    '',
    'English Prompt:',
    report.prompts.english,
  ].join('\n');
}
