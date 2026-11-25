import { useEffect, useState } from 'react';
import type { CompositionAnalysis, CompositionGuide } from '../types/analysis';
import { generateCompositionSketchDataUrl, loadImageElement } from '../utils/imageCanvas';

interface ModuleCompositionProps {
  imageUrl: string;
  composition: CompositionAnalysis;
  showGuides: boolean;
}

function renderSvgGuide(guide: CompositionGuide, idx: number) {
  const red = '#C85252';
  const softRed = 'rgba(200, 82, 82, 0.72)';

  if (guide.kind === 'rule_of_thirds') {
    return (
      <g key={`g-${idx}`} stroke={softRed} strokeWidth="2.2" strokeDasharray="12 10">
        <line x1="333" y1="0" x2="333" y2="1000" />
        <line x1="667" y1="0" x2="667" y2="1000" />
        <line x1="0" y1="333" x2="1000" y2="333" />
        <line x1="0" y1="667" x2="1000" y2="667" />
      </g>
    );
  }

  if (guide.kind === 'center_axis') {
    return (
      <g key={`g-${idx}`} stroke={softRed} strokeWidth="2.4" strokeDasharray="14 10">
        <line x1="500" y1="0" x2="500" y2="1000" />
        <line x1="0" y1="500" x2="1000" y2="500" />
      </g>
    );
  }

  if (
    (guide.kind === 'leading_line' || guide.kind === 'diagonal') &&
    guide.coords.length >= 4
  ) {
    const [x1, y1, x2, y2] = guide.coords;
    return (
      <line
        key={`g-${idx}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={red}
        strokeWidth="3.2"
        strokeDasharray={guide.kind === 'diagonal' ? '14 8' : undefined}
      />
    );
  }

  if (guide.kind === 'frame_box' && guide.coords.length >= 4) {
    const [xmin, ymin, xmax, ymax] = guide.coords;
    return (
      <rect
        key={`g-${idx}`}
        x={xmin}
        y={ymin}
        width={Math.max(10, xmax - xmin)}
        height={Math.max(10, ymax - ymin)}
        fill="none"
        stroke={red}
        strokeWidth="3"
        strokeDasharray="12 8"
      />
    );
  }

  if (guide.kind === 'curve' && guide.coords.length >= 6) {
    const [x1, y1, cx, cy, x2, y2] = guide.coords;
    return (
      <path
        key={`g-${idx}`}
        d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
        fill="none"
        stroke={red}
        strokeWidth="3.5"
      />
    );
  }

  if (
    (guide.kind === 'vanishing_point' || guide.kind === 'focal_point') &&
    guide.coords.length >= 2
  ) {
    const [cx, cy] = guide.coords;
    return (
      <g key={`g-${idx}`}>
        <circle cx={cx} cy={cy} r="28" fill="none" stroke={red} strokeWidth="3.2" />
        <circle cx={cx} cy={cy} r="9" fill={red} />
      </g>
    );
  }

  return null;
}

export function ModuleComposition({
  imageUrl,
  composition,
  showGuides,
}: ModuleCompositionProps) {
  const [sketchUrl, setSketchUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    loadImageElement(imageUrl)
      .then((img) => {
        if (!active) return;
        const url = generateCompositionSketchDataUrl(img, 540);
        setSketchUrl(url);
      })
      .catch(() => {
        if (active) setSketchUrl('');
      });
    return () => {
      active = false;
    };
  }, [imageUrl]);

  return (
    <section
      id="module-composition"
      aria-labelledby="heading-module-c"
      className="rounded-xl border border-[#B8D0C2]/15 bg-[#121B17] p-4 sm:p-5"
    >
      <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-2 border-b border-[#B8D0C2]/12 pb-2.5">
        <div className="flex items-baseline gap-2.5">
          <span className="font-mono-tabular text-xs font-medium text-[#8EB09C]">03</span>
          <h2 id="heading-module-c" className="font-editorial text-base font-semibold text-[#F1F4F1]">
            构图与机位分析
          </h2>
        </div>
        <span className="text-xs text-[#9AB6A6]">{composition.primaryMethod}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* Archival Off-White Paper Composition Line Sketch + Pale-Red Guides */}
        <div className="flex flex-col justify-between rounded-lg bg-[#EFECE6] p-3 text-[#2B312D]">
          <div className="flex flex-1 items-center justify-center py-1">
            <div className="relative flex w-full items-center justify-center overflow-hidden rounded border border-[#2B312D]/20 bg-[#EFECE6]">
              {sketchUrl ? (
                <div className="relative inline-flex w-full items-center justify-center">
                  <img
                    src={sketchUrl}
                    alt="基于原图生成的构图轮廓线稿"
                    className="block max-h-[260px] w-full object-contain"
                  />
                  {showGuides && (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 1000 1000"
                      preserveAspectRatio="none"
                      className="pointer-events-none absolute inset-0 h-full w-full"
                    >
                      {composition.guides.map((guide, idx) => renderSvgGuide(guide, idx))}
                    </svg>
                  )}
                </div>
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center text-xs text-[#59635D]">
                  正在提取构图线稿…
                </div>
              )}
            </div>
          </div>

          <div className="mt-2.5 border-t border-[#2B312D]/12 pt-2">
            <div className="flex items-center justify-between text-[11px] font-medium text-[#424C46]">
              <span>忠实轮廓线稿 · 淡红辅助线</span>
              <span className="font-mono-tabular">
                {showGuides ? `${composition.guides.length} 组结构` : '辅助线已隐藏'}
              </span>
            </div>
            {showGuides && composition.guides.some((g) => g.label) && (
              <p className="mt-1 text-[11px] leading-snug text-[#7C3A3A]">
                {composition.guides
                  .map((g) => g.label)
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </div>
        </div>

        {/* Two structured analysis columns: 构图要点 & 机位与镜头 */}
        <div className="flex flex-col gap-3">
          <div className="flex-1 rounded-lg border border-[#B8D0C2]/12 bg-[#0E1612] p-3">
            <h3 className="text-xs font-semibold text-[#B6D1C1]">构图要点</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-[#C4D0C9]">
              {composition.compositionPoints}
            </p>
          </div>
          <div className="flex-1 rounded-lg border border-[#B8D0C2]/12 bg-[#0E1612] p-3">
            <h3 className="text-xs font-semibold text-[#B6D1C1]">机位与镜头</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-[#C4D0C9]">
              {composition.cameraAndLens}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
