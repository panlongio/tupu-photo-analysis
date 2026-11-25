import { useEffect, useState } from 'react';
import { Focus } from 'lucide-react';
import type { DetailCrop } from '../types/analysis';
import { cropDetailThumbnail, loadImageElement } from '../utils/imageCanvas';

interface ModuleDetailsProps {
  imageUrl: string;
  details: DetailCrop[];
  activeDetailId: string | null;
  onSelectDetail: (detail: DetailCrop | null) => void;
}

export function ModuleDetails({
  imageUrl,
  details,
  activeDetailId,
  onSelectDetail,
}: ModuleDetailsProps) {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    loadImageElement(imageUrl)
      .then((img) => {
        if (!active) return;
        const next: Record<string, string> = {};
        for (const item of details) {
          next[item.id] = cropDetailThumbnail(img, item.box, 360, 260);
        }
        setThumbnails(next);
      })
      .catch(() => {
        if (active) setThumbnails({});
      });
    return () => {
      active = false;
    };
  }, [imageUrl, details]);

  return (
    <section
      id="module-details"
      aria-labelledby="heading-module-d"
      className="rounded-xl border border-[#B8D0C2]/15 bg-[#121B17] p-4 sm:p-5"
    >
      <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-2 border-b border-[#B8D0C2]/12 pb-2.5">
        <div className="flex items-baseline gap-2.5">
          <span className="font-mono-tabular text-xs font-medium text-[#8EB09C]">04</span>
          <h2 id="heading-module-d" className="font-editorial text-base font-semibold text-[#F1F4F1]">
            关键细节参考
          </h2>
        </div>
        <span className="text-xs text-[#7E9287]">点击任意局部可在原图中定位裁切区域</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {details.slice(0, 5).map((detail) => {
          const thumb = thumbnails[detail.id];
          const isActive = activeDetailId === detail.id;

          return (
            <button
              key={detail.id}
              type="button"
              onClick={() => onSelectDetail(isActive ? null : detail)}
              aria-pressed={isActive}
              aria-label={`定位细节：${detail.title}`}
              className={`group flex flex-col overflow-hidden rounded-lg border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8EB09C] ${
                isActive
                  ? 'border-[#DCE8E0] bg-[#1C2C24]'
                  : 'border-[#B8D0C2]/14 bg-[#0D1511] hover:border-[#7EA48E]/60'
              }`}
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#090E0C]">
                {thumb ? (
                  <img
                    src={thumb}
                    alt={detail.title}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[11px] text-[#7A8C82]">
                    裁切提取中…
                  </div>
                )}
                {isActive && (
                  <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-[#0C1410]/88 px-1.5 py-0.5 text-[10px] font-medium text-[#E4F0E8] border border-white/25">
                    <Focus className="h-3 w-3" aria-hidden="true" />
                    <span>已定位</span>
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-2.5">
                <h3 className="text-xs font-semibold text-[#EFF4F1] leading-snug">
                  {detail.title}
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-[#9DB0A5]">
                  {detail.explanation}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
