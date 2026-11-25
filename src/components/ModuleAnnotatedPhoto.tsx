import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import type { DetailCrop, VisualAnnotation } from '../types/analysis';
import { computeAnnotationLayout } from '../utils/analysisLogic';

interface ModuleAnnotatedPhotoProps {
  imageUrl: string;
  imageAlt: string;
  annotations: VisualAnnotation[];
  showAnnotations: boolean;
  activeAnnotationId: string | null;
  activeDetailCrop: DetailCrop | null;
  onSelectAnnotation: (id: string | null) => void;
  onTriggerUpload: () => void;
}

interface StageGeometry {
  stageW: number;
  stageH: number;
  imgLeft: number;
  imgTop: number;
  imgW: number;
  imgH: number;
}

export function ModuleAnnotatedPhoto({
  imageUrl,
  imageAlt,
  annotations,
  showAnnotations,
  activeAnnotationId,
  activeDetailCrop,
  onSelectAnnotation,
  onTriggerUpload,
}: ModuleAnnotatedPhotoProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [geom, setGeom] = useState<StageGeometry | null>(null);
  const [imgError, setImgError] = useState(false);

  const placed = useMemo(() => computeAnnotationLayout(annotations, 0.24), [annotations]);
  const leftCards = useMemo(
    () => placed.filter((p) => p.side === 'left').sort((a, b) => a.cardY - b.cardY),
    [placed]
  );
  const rightCards = useMemo(
    () => placed.filter((p) => p.side === 'right').sort((a, b) => a.cardY - b.cardY),
    [placed]
  );

  useEffect(() => {
    setImgError(false);
  }, [imageUrl]);

  useEffect(() => {
    const measure = () => {
      const stage = stageRef.current;
      const img = imgRef.current;
      if (!stage || !img) return;
      const sRect = stage.getBoundingClientRect();
      const iRect = img.getBoundingClientRect();
      if (sRect.width === 0 || iRect.width === 0) return;
      setGeom({
        stageW: sRect.width,
        stageH: sRect.height,
        imgLeft: iRect.left - sRect.left,
        imgTop: iRect.top - sRect.top,
        imgW: iRect.width,
        imgH: iRect.height,
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    if (imgRef.current) ro.observe(imgRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [imageUrl, showAnnotations]);

  // Measure card anchor edges cleanly using refs
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const getLeaderPolyline = (
    annId: string,
    side: 'left' | 'right',
    anchorX: number,
    anchorY: number
  ): { points: string; ax: number; ay: number } | null => {
    if (!geom || !stageRef.current) return null;
    const ax = geom.imgLeft + (anchorX / 1000) * geom.imgW;
    const ay = geom.imgTop + (anchorY / 1000) * geom.imgH;

    const cardEl = cardRefs.current[annId];
    if (!cardEl) return null;
    const sRect = stageRef.current.getBoundingClientRect();
    const cRect = cardEl.getBoundingClientRect();

    const startX = side === 'left' ? cRect.right - sRect.left : cRect.left - sRect.left;
    const startY = cRect.top - sRect.top + Math.min(22, cRect.height / 2);
    const elbowX =
      side === 'left'
        ? Math.min(geom.imgLeft - 8, startX + 14)
        : Math.max(geom.imgLeft + geom.imgW + 8, startX - 14);

    return {
      points: `${startX},${startY} ${elbowX},${startY} ${ax},${ay}`,
      ax,
      ay,
    };
  };

  return (
    <section
      id="module-photo"
      aria-labelledby="heading-module-a"
      className="flex flex-col rounded-xl border border-[#B8D0C2]/15 bg-[#121B17] p-4 sm:p-5"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#B8D0C2]/12 pb-2.5">
        <div className="flex items-baseline gap-2.5">
          <span className="font-mono-tabular text-xs font-medium text-[#8EB09C]">01</span>
          <h2 id="heading-module-a" className="font-editorial text-base font-semibold text-[#F1F4F1]">
            原图主体与视觉标注
          </h2>
        </div>
        <button
          type="button"
          onClick={onTriggerUpload}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A8C2B3] transition-colors hover:text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8EB09C] rounded"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          <span>更换参考照片</span>
        </button>
      </div>

      {/* Desktop 3-lane editorial annotation stage */}
      <div
        ref={stageRef}
        className="relative flex flex-col gap-4 lg:grid lg:min-h-[460px] lg:grid-cols-[182px_minmax(0,1fr)_182px] lg:items-center lg:gap-3"
        data-testid="annotated-photo-stage"
      >
        {/* Left annotation lane (Desktop) */}
        <div
          className={`hidden lg:flex lg:flex-col lg:justify-around lg:gap-2.5 lg:self-stretch ${
            showAnnotations ? 'opacity-100' : 'pointer-events-none opacity-0'
          } transition-opacity duration-200`}
        >
          {leftCards.map(({ annotation }) => {
            const isActive = activeAnnotationId === annotation.id;
            return (
              <button
                key={annotation.id}
                ref={(el) => {
                  cardRefs.current[annotation.id] = el;
                }}
                type="button"
                onMouseEnter={() => onSelectAnnotation(annotation.id)}
                onMouseLeave={() => onSelectAnnotation(null)}
                onClick={() =>
                  onSelectAnnotation(isActive ? null : annotation.id)
                }
                aria-pressed={isActive}
                className={`group rounded-lg border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8EB09C] ${
                  isActive
                    ? 'border-white/55 bg-[#1B2B23]/95'
                    : 'border-white/12 bg-[#0D1411]/88 hover:border-white/30'
                }`}
              >
                <div className="text-xs font-semibold text-[#F4F7F5] leading-snug">
                  {annotation.title}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-[#A8B6AE]">
                  {annotation.observation}
                </p>
              </button>
            );
          })}
        </div>

        {/* Center Unaltered Original Photo */}
        <div className="relative flex items-center justify-center rounded-lg bg-[#0A0F0D] p-1.5 sm:p-2">
          {imgError ? (
            <div className="flex aspect-[4/3] w-full flex-col items-center justify-center rounded border border-[#B8D0C2]/15 bg-[#141E1A] p-6 text-center">
              <p className="text-sm font-medium text-[#DCE8E0]">照片加载失败</p>
              <p className="mt-1 text-xs text-[#889A90]">请点击右上角重新上传本地照片</p>
            </div>
          ) : (
            <div className="relative inline-flex max-h-[520px] w-full items-center justify-center">
              <img
                ref={imgRef}
                src={imageUrl}
                alt={imageAlt}
                referrerPolicy="no-referrer"
                onLoad={() => {
                  // Trigger geometry re-measurement once natural image dimensions settle
                  window.dispatchEvent(new Event('resize'));
                }}
                onError={() => setImgError(true)}
                className="max-h-[510px] w-full rounded object-contain shadow-2xl"
              />

              {/* Mobile / Tablet direct anchor dots on photo */}
              {showAnnotations && (
                <div className="pointer-events-none absolute inset-0 lg:hidden">
                  {annotations.map((ann, index) => {
                    const isActive = activeAnnotationId === ann.id;
                    return (
                      <button
                        key={ann.id}
                        type="button"
                        onClick={() => onSelectAnnotation(isActive ? null : ann.id)}
                        aria-label={`标注 ${index + 1}: ${ann.title}`}
                        style={{
                          left: `${ann.anchorX / 10}%`,
                          top: `${ann.anchorY / 10}%`,
                        }}
                        className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-mono-tabular font-semibold transition-transform ${
                          isActive
                            ? 'scale-110 border-white bg-[#284235] text-white'
                            : 'border-white/85 bg-[#0C1410]/85 text-white'
                        }`}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Active Detail Crop Focus Reticle */}
              {activeDetailCrop && (
                <div
                  aria-label={`当前高亮局部：${activeDetailCrop.title}`}
                  style={{
                    top: `${activeDetailCrop.box[0] / 10}%`,
                    left: `${activeDetailCrop.box[1] / 10}%`,
                    height: `${(activeDetailCrop.box[2] - activeDetailCrop.box[0]) / 10}%`,
                    width: `${(activeDetailCrop.box[3] - activeDetailCrop.box[1]) / 10}%`,
                  }}
                  className="pointer-events-none absolute rounded-sm border-2 border-[#DCE8E0] bg-[#DCE8E0]/10 shadow-[0_0_0_9999px_rgba(7,12,9,0.42)] transition-all duration-200"
                >
                  <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-[#0E1612]/92 px-2 py-0.5 text-[11px] font-medium text-[#E5F0E9] border border-white/20">
                    局部：{activeDetailCrop.title}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right annotation lane (Desktop) */}
        <div
          className={`hidden lg:flex lg:flex-col lg:justify-around lg:gap-2.5 lg:self-stretch ${
            showAnnotations ? 'opacity-100' : 'pointer-events-none opacity-0'
          } transition-opacity duration-200`}
        >
          {rightCards.map(({ annotation }) => {
            const isActive = activeAnnotationId === annotation.id;
            return (
              <button
                key={annotation.id}
                ref={(el) => {
                  cardRefs.current[annotation.id] = el;
                }}
                type="button"
                onMouseEnter={() => onSelectAnnotation(annotation.id)}
                onMouseLeave={() => onSelectAnnotation(null)}
                onClick={() =>
                  onSelectAnnotation(isActive ? null : annotation.id)
                }
                aria-pressed={isActive}
                className={`group rounded-lg border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8EB09C] ${
                  isActive
                    ? 'border-white/55 bg-[#1B2B23]/95'
                    : 'border-white/12 bg-[#0D1411]/88 hover:border-white/30'
                }`}
              >
                <div className="text-xs font-semibold text-[#F4F7F5] leading-snug">
                  {annotation.title}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-[#A8B6AE]">
                  {annotation.observation}
                </p>
              </button>
            );
          })}
        </div>

        {/* Crisp Ultra-Fine White SVG Leader Lines + Circular Anchor Points (Desktop) */}
        {showAnnotations && geom && (
          <svg
            aria-hidden="true"
            width={geom.stageW}
            height={geom.stageH}
            viewBox={`0 0 ${geom.stageW} ${geom.stageH}`}
            className="pointer-events-none absolute inset-0 hidden lg:block overflow-visible"
          >
            {placed.map(({ annotation, side }) => {
              const line = getLeaderPolyline(
                annotation.id,
                side,
                annotation.anchorX,
                annotation.anchorY
              );
              if (!line) return null;
              const isActive = activeAnnotationId === annotation.id;
              const isDimmed = activeAnnotationId !== null && !isActive;

              return (
                <g
                  key={annotation.id}
                  opacity={isDimmed ? 0.28 : 1}
                  className="transition-opacity duration-150"
                >
                  {/* Subtle dark underlay stroke for visibility over bright sky/windows */}
                  <polyline
                    points={line.points}
                    fill="none"
                    stroke="rgba(10, 15, 13, 0.55)"
                    strokeWidth={isActive ? 3.2 : 2.2}
                    strokeLinejoin="round"
                  />
                  {/* Ultra-fine crisp white leader line */}
                  <polyline
                    points={line.points}
                    fill="none"
                    stroke={isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.84)'}
                    strokeWidth={isActive ? 1.5 : 1}
                    strokeLinejoin="round"
                  />
                  {/* Circular anchor point */}
                  <circle
                    cx={line.ax}
                    cy={line.ay}
                    r={isActive ? 8 : 6.5}
                    fill="rgba(12, 19, 16, 0.65)"
                    stroke="#FFFFFF"
                    strokeWidth={isActive ? 1.5 : 1.1}
                  />
                  <circle
                    cx={line.ax}
                    cy={line.ay}
                    r={isActive ? 3.2 : 2.5}
                    fill="#FFFFFF"
                  />
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Mobile / Tablet Annotation Cards Grid */}
      {showAnnotations && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:hidden">
          {annotations.map((ann, index) => {
            const isActive = activeAnnotationId === ann.id;
            return (
              <button
                key={ann.id}
                type="button"
                onClick={() => onSelectAnnotation(isActive ? null : ann.id)}
                className={`rounded-lg border p-2.5 text-left transition-colors ${
                  isActive
                    ? 'border-white/50 bg-[#1B2B23]'
                    : 'border-[#B8D0C2]/15 bg-[#0E1612]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono-tabular text-[11px] font-semibold text-[#9EC0AC]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-xs font-semibold text-[#F1F4F1]">{ann.title}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[#A3B2A9]">{ann.observation}</p>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
