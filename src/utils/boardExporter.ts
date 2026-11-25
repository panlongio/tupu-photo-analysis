import type { CompositionGuide, PhotoAnalysisReport } from '../types/analysis';
import { computeAnnotationLayout, computeCropPixelRect } from './analysisLogic';
import { generateCompositionSketchDataUrl, loadImageElement } from './imageCanvas';

const BOARD_W = 2560;
const BOARD_H = 1440;

const COLORS = {
  bg: '#0E1512',
  panel: '#131D19',
  panelElevated: '#18241F',
  divider: 'rgba(184, 208, 194, 0.18)',
  sageTagBg: '#25382F',
  sageTagBorder: 'rgba(155, 192, 171, 0.32)',
  sageTagText: '#C5DDD0',
  textPrimary: '#F2F5F2',
  textSecondary: '#B3C0B8',
  textMuted: '#7F9187',
  paperBg: '#EFECE6',
  guideRed: '#C85252',
  cardScrim: 'rgba(12, 19, 16, 0.88)',
};

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  if (!text) return [];
  const lines: string[] = [];
  let current = '';

  const chars = Array.from(text.replace(/\s+/g, ' ').trim());
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = current + ch;
    if (ctx.measureText(next).width > maxWidth && current.length > 0) {
      // Avoid breaking inside an English word if a recent space exists
      const lastSpace = current.lastIndexOf(' ');
      if (lastSpace > current.length * 0.55 && /[A-Za-z0-9]/.test(ch)) {
        lines.push(current.slice(0, lastSpace).trim());
        current = current.slice(lastSpace + 1) + ch;
      } else {
        lines.push(current.trim());
        current = ch === ' ' ? '' : ch;
      }
      if (lines.length === maxLines) {
        const last = lines[maxLines - 1];
        lines[maxLines - 1] = last.length > 2 ? `${last.slice(0, -1)}…` : last;
        return lines;
      }
    } else {
      current = next;
    }
  }
  if (current.trim() && lines.length < maxLines) {
    lines.push(current.trim());
  }
  return lines;
}

function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): number {
  const lines = wrapTextLines(ctx, text, maxWidth, maxLines);
  lines.forEach((line, idx) => {
    ctx.fillText(line, x, y + idx * lineHeight);
  });
  return lines.length * lineHeight;
}

function drawSectionHeader(
  ctx: CanvasRenderingContext2D,
  code: string,
  title: string,
  x: number,
  y: number,
  width: number
) {
  ctx.save();
  ctx.font = '500 16px "JetBrains Mono", monospace';
  ctx.fillStyle = COLORS.sageTagText;
  ctx.fillText(code, x, y);

  ctx.font = '600 22px "Noto Serif SC", "Noto Sans SC", serif';
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(title, x + 46, y);

  ctx.strokeStyle = COLORS.divider;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + 14);
  ctx.lineTo(x + width, y + 14);
  ctx.stroke();
  ctx.restore();
}

function drawCompositionGuidesOnCanvas(
  ctx: CanvasRenderingContext2D,
  guides: CompositionGuide[],
  rx: number,
  ry: number,
  rw: number,
  rh: number
) {
  ctx.save();
  ctx.strokeStyle = COLORS.guideRed;
  ctx.fillStyle = COLORS.guideRed;
  ctx.lineWidth = 2;

  const px = (nx: number) => rx + (nx / 1000) * rw;
  const py = (ny: number) => ry + (ny / 1000) * rh;

  for (const guide of guides) {
    ctx.setLineDash([7, 5]);
    if (guide.kind === 'rule_of_thirds') {
      ctx.beginPath();
      ctx.moveTo(rx + rw / 3, ry);
      ctx.lineTo(rx + rw / 3, ry + rh);
      ctx.moveTo(rx + (2 * rw) / 3, ry);
      ctx.lineTo(rx + (2 * rw) / 3, ry + rh);
      ctx.moveTo(rx, ry + rh / 3);
      ctx.lineTo(rx + rw, ry + rh / 3);
      ctx.moveTo(rx, ry + (2 * rh) / 3);
      ctx.lineTo(rx + rw, ry + (2 * rh) / 3);
      ctx.stroke();
    } else if (guide.kind === 'center_axis') {
      ctx.beginPath();
      ctx.moveTo(rx + rw / 2, ry);
      ctx.lineTo(rx + rw / 2, ry + rh);
      ctx.moveTo(rx, ry + rh / 2);
      ctx.lineTo(rx + rw, ry + rh / 2);
      ctx.stroke();
    } else if (
      (guide.kind === 'leading_line' || guide.kind === 'diagonal') &&
      guide.coords.length >= 4
    ) {
      ctx.setLineDash(guide.kind === 'diagonal' ? [8, 5] : []);
      ctx.beginPath();
      ctx.moveTo(px(guide.coords[0]), py(guide.coords[1]));
      ctx.lineTo(px(guide.coords[2]), py(guide.coords[3]));
      ctx.stroke();
    } else if (guide.kind === 'frame_box' && guide.coords.length >= 4) {
      const [xmin, ymin, xmax, ymax] = guide.coords;
      ctx.strokeRect(
        px(xmin),
        py(ymin),
        Math.max(4, px(xmax) - px(xmin)),
        Math.max(4, py(ymax) - py(ymin))
      );
    } else if (guide.kind === 'curve' && guide.coords.length >= 6) {
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(px(guide.coords[0]), py(guide.coords[1]));
      ctx.quadraticCurveTo(
        px(guide.coords[2]),
        py(guide.coords[3]),
        px(guide.coords[4]),
        py(guide.coords[5])
      );
      ctx.stroke();
    } else if (
      (guide.kind === 'vanishing_point' || guide.kind === 'focal_point') &&
      guide.coords.length >= 2
    ) {
      const cx = px(guide.coords[0]);
      const cy = py(guide.coords[1]);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Renders the entire 7-module Universal Photo Visual Analysis System V2.0 board
 * as a crisp 16:9 (2560 × 1440) publication-grade PNG Data URL.
 */
export async function renderAnalysisBoardToPng(
  imageUrl: string,
  report: PhotoAnalysisReport
): Promise<string> {
  const img = await loadImageElement(imageUrl);
  const sketchDataUrl = generateCompositionSketchDataUrl(img, 540);
  const sketchImg = await loadImageElement(sketchDataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = BOARD_W;
  canvas.height = BOARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法初始化导出画布。');

  // Ensure fonts are ready before drawing
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  // 1. Background canvas
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, BOARD_W, BOARD_H);

  // Outer editorial border
  ctx.strokeStyle = COLORS.divider;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(24, 24, BOARD_W - 48, BOARD_H - 48);

  // 2. Top Board Masthead (y: 24..92)
  ctx.font = '600 28px "Noto Serif SC", serif';
  ctx.fillStyle = COLORS.textPrimary;
  const titleW = ctx.measureText(report.title).width;
  ctx.fillText(report.title, 48, 69);

  ctx.font = '500 14px "JetBrains Mono", monospace';
  ctx.fillStyle = COLORS.textMuted;
  const editionMark = 'UNIVERSAL PHOTO VISUAL ANALYSIS · 16:9 ARCHIVE';
  const markW = ctx.measureText(editionMark).width;
  const markX = BOARD_W - 48 - markW;
  ctx.fillText(editionMark, markX, 67);

  ctx.font = '400 16px "Noto Sans SC", sans-serif';
  ctx.fillStyle = COLORS.sageTagText;
  const subX = 48 + titleW + 24;
  const maxSubW = Math.max(200, markX - subX - 36);
  const subText = `${report.genre}  ·  ${report.visualSignature}`;
  drawTextBlock(ctx, subText, subX, 68, maxSubW, 20, 1);

  ctx.strokeStyle = COLORS.divider;
  ctx.beginPath();
  ctx.moveTo(24, 92);
  ctx.lineTo(BOARD_W - 24, 92);
  ctx.stroke();

  // Main column split
  const leftX = 48;
  const leftW = 1488;
  const rightX = 1564;
  const rightW = 948;

  // Vertical column separator
  ctx.beginPath();
  ctx.moveTo(1550, 92);
  ctx.lineTo(1550, BOARD_H - 24);
  ctx.stroke();

  // =========================================================================
  // MODULE A: Original Photo + White Leader-Line Visual Annotations (Top-Left)
  // =========================================================================
  const modAY = 110;
  const modAH = 795;
  drawRoundedRect(ctx, leftX, modAY, leftW, modAH, 10);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();
  ctx.strokeStyle = COLORS.divider;
  ctx.stroke();

  // Photo framing centered inside Module A, leaving clean side annotation lanes
  ctx.font = '500 14px "JetBrains Mono", monospace';
  ctx.fillStyle = COLORS.sageTagText;
  ctx.fillText('01', leftX + 20, modAY + 30);
  ctx.font = '600 18px "Noto Serif SC", "Noto Sans SC", serif';
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText('原图主体与视觉标注', leftX + 52, modAY + 31);

  const laneW = 282;
  const photoBoxX = leftX + laneW + 22;
  const photoBoxY = modAY + 46;
  const photoBoxW = leftW - (laneW + 22) * 2;
  const photoBoxH = modAH - 68;

  const imgAspect = img.naturalWidth / Math.max(1, img.naturalHeight);
  const boxAspect = photoBoxW / photoBoxH;
  let drawW = photoBoxW;
  let drawH = photoBoxH;
  if (imgAspect > boxAspect) {
    drawH = photoBoxW / imgAspect;
  } else {
    drawW = photoBoxH * imgAspect;
  }
  const drawX = photoBoxX + (photoBoxW - drawW) / 2;
  const drawY = photoBoxY + (photoBoxH - drawH) / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 24;
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  ctx.restore();

  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  ctx.strokeRect(drawX, drawY, drawW, drawH);

  // Leader lines & translucent dark cards
  const placed = computeAnnotationLayout(report.annotations, 0.22);
  for (const item of placed) {
    const ax = drawX + (item.annotation.anchorX / 1000) * drawW;
    const ay = drawY + (item.annotation.anchorY / 1000) * drawH;

    const cardW = 264;
    const cardH = 112;
    const cardX = item.side === 'left' ? leftX + 18 : leftX + leftW - 18 - cardW;
    const cardCenterY = modAY + 64 + item.cardY * (modAH - 98);
    const cardY = Math.max(modAY + 46, Math.min(modAY + modAH - cardH - 16, cardCenterY - cardH / 2));

    const connectX = item.side === 'left' ? cardX + cardW : cardX;
    const connectY = cardY + 26;
    const elbowX = item.side === 'left' ? Math.min(drawX - 12, connectX + 18) : Math.max(drawX + drawW + 12, connectX - 18);

    // Thin white leader line
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(connectX, connectY);
    ctx.lineTo(elbowX, connectY);
    ctx.lineTo(ax, ay);
    ctx.stroke();

    // Anchor ring + solid dot
    ctx.fillStyle = 'rgba(14, 21, 18, 0.72)';
    ctx.beginPath();
    ctx.arc(ax, ay, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ax, ay, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Translucent dark card
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 6);
    ctx.fillStyle = COLORS.cardScrim;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = '600 15px "Noto Sans SC", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(item.annotation.title, cardX + 14, cardY + 25);

    ctx.font = '400 12.5px "Noto Sans SC", sans-serif';
    ctx.fillStyle = COLORS.textSecondary;
    drawTextBlock(ctx, item.annotation.observation, cardX + 14, cardY + 46, cardW - 28, 18, 4);
    ctx.restore();
  }

  // =========================================================================
  // MODULE D: 5 Key Detail Crops (Bottom-Left Upper)
  // =========================================================================
  const modDY = 928;
  drawSectionHeader(ctx, '04', '关键细节参考', leftX, modDY + 20, leftW);

  const details = report.details.slice(0, 5);
  const gapD = 16;
  const cardDW = (leftW - gapD * 4) / 5;
  const thumbH = 148;

  details.forEach((detail, idx) => {
    const cx = leftX + idx * (cardDW + gapD);
    const cy = modDY + 46;

    drawRoundedRect(ctx, cx, cy, cardDW, 230, 8);
    ctx.fillStyle = COLORS.panel;
    ctx.fill();
    ctx.strokeStyle = COLORS.divider;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Real crop drawn directly from original image
    const rect = computeCropPixelRect(detail.box, img.naturalWidth, img.naturalHeight);
    const srcAspect = rect.width / Math.max(1, rect.height);
    const dstAspect = (cardDW - 16) / thumbH;
    let sx = rect.x;
    let sy = rect.y;
    let sw = rect.width;
    let sh = rect.height;
    if (srcAspect > dstAspect) {
      const nw = sh * dstAspect;
      sx += (sw - nw) / 2;
      sw = nw;
    } else {
      const nh = sw / dstAspect;
      sy += (sh - nh) / 2;
      sh = nh;
    }

    ctx.save();
    drawRoundedRect(ctx, cx + 8, cy + 8, cardDW - 16, thumbH, 5);
    ctx.clip();
    ctx.drawImage(img, sx, sy, sw, sh, cx + 8, cy + 8, cardDW - 16, thumbH);
    ctx.restore();

    ctx.font = '600 15px "Noto Sans SC", sans-serif';
    ctx.fillStyle = COLORS.textPrimary;
    ctx.fillText(detail.title, cx + 12, cy + thumbH + 30);

    ctx.font = '400 12.5px "Noto Sans SC", sans-serif';
    ctx.fillStyle = COLORS.textSecondary;
    drawTextBlock(ctx, detail.explanation, cx + 12, cy + thumbH + 50, cardDW - 24, 17, 2);
  });

  // =========================================================================
  // MODULE F: 6 Vertical Color Swatch Cards (Bottom-Left Lower)
  // =========================================================================
  const modFY = 1222;
  drawSectionHeader(ctx, '06', '配色参考（近似）', leftX, modFY + 18, leftW);

  const palette = report.palette.slice(0, 6);
  const gapF = 14;
  const swW = (leftW - gapF * 5) / 6;

  palette.forEach((swatch, idx) => {
    const sx = leftX + idx * (swW + gapF);
    const sy = modFY + 42;
    const swH = 146;

    drawRoundedRect(ctx, sx, sy, swW, swH, 8);
    ctx.fillStyle = COLORS.panel;
    ctx.fill();
    ctx.strokeStyle = COLORS.divider;
    ctx.stroke();

    // Swatch color bar
    ctx.save();
    drawRoundedRect(ctx, sx + 8, sy + 8, swW - 16, 62, 5);
    ctx.fillStyle = swatch.hex;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.stroke();
    ctx.restore();

    ctx.font = '500 14px "JetBrains Mono", monospace';
    ctx.fillStyle = COLORS.textPrimary;
    ctx.fillText(swatch.hex, sx + 12, sy + 92);

    ctx.font = '600 14px "Noto Sans SC", sans-serif';
    ctx.fillStyle = COLORS.sageTagText;
    ctx.fillText(swatch.name, sx + 12, sy + 112);

    ctx.font = '400 12px "Noto Sans SC", sans-serif';
    ctx.fillStyle = COLORS.textSecondary;
    drawTextBlock(ctx, swatch.usage, sx + 12, sy + 131, swW - 24, 16, 1);
  });

  // =========================================================================
  // MODULE B: Core Keyword Anchors (Top-Right)
  // =========================================================================
  const modBY = 110;
  drawSectionHeader(ctx, '02', '核心关键词锚点', rightX, modBY + 20, rightW);

  const keywords = report.keywords.slice(0, 8);
  keywords.forEach((kw, idx) => {
    const rowY = modBY + 48 + idx * 38;
    const pillW = 132;
    const pillH = 28;

    drawRoundedRect(ctx, rightX, rowY, pillW, pillH, 14);
    ctx.fillStyle = COLORS.sageTagBg;
    ctx.fill();
    ctx.strokeStyle = COLORS.sageTagBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = '500 13.5px "Noto Sans SC", sans-serif';
    ctx.fillStyle = COLORS.sageTagText;
    const labelW = ctx.measureText(kw.label).width;
    ctx.fillText(kw.label, rightX + (pillW - labelW) / 2, rowY + 19);

    ctx.font = '400 14.5px "Noto Sans SC", sans-serif';
    ctx.fillStyle = COLORS.textPrimary;
    drawTextBlock(ctx, kw.description, rightX + pillW + 16, rowY + 19, rightW - pillW - 18, 20, 1);
  });

  // =========================================================================
  // MODULE C: Composition Sketch + Camera & Lens (Mid-Right)
  // =========================================================================
  const modCY = 474;
  drawSectionHeader(ctx, '03', '构图与机位分析', rightX, modCY + 20, rightW);

  // Left archival paper sketch box
  const sketchBoxX = rightX;
  const sketchBoxY = modCY + 46;
  const sketchBoxW = 412;
  const sketchBoxH = 286;

  drawRoundedRect(ctx, sketchBoxX, sketchBoxY, sketchBoxW, sketchBoxH, 8);
  ctx.fillStyle = COLORS.paperBg;
  ctx.fill();

  const skAspect = sketchImg.naturalWidth / Math.max(1, sketchImg.naturalHeight);
  const skBoxAspect = (sketchBoxW - 24) / (sketchBoxH - 44);
  let skW = sketchBoxW - 24;
  let skH = sketchBoxH - 44;
  if (skAspect > skBoxAspect) {
    skH = skW / skAspect;
  } else {
    skW = skH * skAspect;
  }
  const skX = sketchBoxX + (sketchBoxW - skW) / 2;
  const skY = sketchBoxY + 12 + (sketchBoxH - 44 - skH) / 2;

  ctx.drawImage(sketchImg, skX, skY, skW, skH);
  ctx.strokeStyle = 'rgba(42, 48, 44, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(skX, skY, skW, skH);

  drawCompositionGuidesOnCanvas(ctx, report.composition.guides, skX, skY, skW, skH);

  ctx.font = '500 12px "Noto Sans SC", sans-serif';
  ctx.fillStyle = '#4B554F';
  ctx.fillText(`主构图法：${report.composition.primaryMethod}`, sketchBoxX + 14, sketchBoxY + sketchBoxH - 11);

  // Right two text columns stacked cleanly beside sketch
  const compTextX = sketchBoxX + sketchBoxW + 22;
  const compTextW = rightW - sketchBoxW - 22;

  drawRoundedRect(ctx, compTextX, sketchBoxY, compTextW, 136, 8);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();
  ctx.strokeStyle = COLORS.divider;
  ctx.stroke();

  ctx.font = '600 15px "Noto Sans SC", sans-serif';
  ctx.fillStyle = COLORS.sageTagText;
  ctx.fillText('构图要点', compTextX + 16, sketchBoxY + 28);
  ctx.font = '400 13.5px "Noto Sans SC", sans-serif';
  ctx.fillStyle = COLORS.textSecondary;
  drawTextBlock(ctx, report.composition.compositionPoints, compTextX + 16, sketchBoxY + 52, compTextW - 32, 20, 4);

  const camY = sketchBoxY + 150;
  drawRoundedRect(ctx, compTextX, camY, compTextW, 136, 8);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();
  ctx.strokeStyle = COLORS.divider;
  ctx.stroke();

  ctx.font = '600 15px "Noto Sans SC", sans-serif';
  ctx.fillStyle = COLORS.sageTagText;
  ctx.fillText('机位与镜头', compTextX + 16, camY + 28);
  ctx.font = '400 13.5px "Noto Sans SC", sans-serif';
  ctx.fillStyle = COLORS.textSecondary;
  drawTextBlock(ctx, report.composition.cameraAndLens, compTextX + 16, camY + 52, compTextW - 32, 20, 4);

  // =========================================================================
  // MODULE E: Lighting & Color Features (Lower-Right Upper)
  // =========================================================================
  const modEY = 824;
  drawSectionHeader(ctx, '05', '光影与色彩特征', rightX, modEY + 20, rightW);

  const lightingItems = report.lighting.slice(0, 5);
  lightingItems.forEach((item, idx) => {
    const ly = modEY + 46 + idx * 38;
    const tagW = 120;
    drawRoundedRect(ctx, rightX, ly, tagW, 27, 6);
    ctx.fillStyle = COLORS.sageTagBg;
    ctx.fill();
    ctx.strokeStyle = COLORS.sageTagBorder;
    ctx.stroke();

    ctx.font = '500 13px "Noto Sans SC", sans-serif';
    ctx.fillStyle = COLORS.sageTagText;
    const tw = ctx.measureText(item.tag).width;
    ctx.fillText(item.tag, rightX + (tagW - tw) / 2, ly + 18);

    ctx.font = '400 14px "Noto Sans SC", sans-serif';
    ctx.fillStyle = COLORS.textSecondary;
    drawTextBlock(ctx, item.description, rightX + tagW + 14, ly + 18, rightW - tagW - 16, 19, 1);
  });

  // =========================================================================
  // MODULE G: Complete Reverse Generation Prompts (Bottom-Right)
  // =========================================================================
  const modGY = 1074;
  drawSectionHeader(ctx, '07', '完整反推提示词（可直接用于图像生成）', rightX, modGY + 20, rightW);

  const promptBoxY = modGY + 44;
  const promptBoxW = (rightW - 16) / 2;
  const promptBoxH = 290;

  // Chinese Prompt
  drawRoundedRect(ctx, rightX, promptBoxY, promptBoxW, promptBoxH, 8);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();
  ctx.strokeStyle = COLORS.divider;
  ctx.stroke();

  ctx.font = '600 14px "Noto Sans SC", sans-serif';
  ctx.fillStyle = COLORS.sageTagText;
  ctx.fillText('中文 Prompt', rightX + 16, promptBoxY + 28);

  ctx.font = '400 13px "Noto Sans SC", sans-serif';
  ctx.fillStyle = COLORS.textSecondary;
  drawTextBlock(ctx, report.prompts.chinese, rightX + 16, promptBoxY + 52, promptBoxW - 32, 20, 11);

  // English Prompt
  const enX = rightX + promptBoxW + 16;
  drawRoundedRect(ctx, enX, promptBoxY, promptBoxW, promptBoxH, 8);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();
  ctx.strokeStyle = COLORS.divider;
  ctx.stroke();

  ctx.font = '600 14px "DM Sans", sans-serif';
  ctx.fillStyle = COLORS.sageTagText;
  ctx.fillText('English Prompt', enX + 16, promptBoxY + 28);

  ctx.font = '400 12.5px "DM Sans", sans-serif';
  ctx.fillStyle = COLORS.textSecondary;
  drawTextBlock(ctx, report.prompts.english, enX + 16, promptBoxY + 52, promptBoxW - 32, 19, 12);

  return canvas.toDataURL('image/png');
}
