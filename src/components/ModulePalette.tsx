import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { ColorSwatch } from '../types/analysis';

interface ModulePaletteProps {
  palette: ColorSwatch[];
}

export function ModulePalette({ palette }: ModulePaletteProps) {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const handleCopyHex = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopiedHex(hex);
      window.setTimeout(() => {
        setCopiedHex((prev) => (prev === hex ? null : prev));
      }, 1600);
    } catch {
      // Clipboard fallback ignored gracefully
    }
  };

  return (
    <section
      aria-labelledby="heading-module-f"
      className="rounded-xl border border-[#B8D0C2]/15 bg-[#121B17] p-4 sm:p-5"
    >
      <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-2 border-b border-[#B8D0C2]/12 pb-2.5">
        <div className="flex items-baseline gap-2.5">
          <span className="font-mono-tabular text-xs font-medium text-[#8EB09C]">06</span>
          <h2 id="heading-module-f" className="font-editorial text-base font-semibold text-[#F1F4F1]">
            配色参考（近似）
          </h2>
        </div>
        <span className="text-xs text-[#7E9287]">点击色卡复制 HEX 色值</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {palette.slice(0, 6).map((swatch, idx) => {
          const isCopied = copiedHex === swatch.hex;
          return (
            <button
              key={`${swatch.hex}-${idx}`}
              type="button"
              onClick={() => handleCopyHex(swatch.hex)}
              aria-label={`复制颜色 ${swatch.name} ${swatch.hex}`}
              className="group flex flex-col overflow-hidden rounded-lg border border-[#B8D0C2]/14 bg-[#0D1511] p-2 text-left transition-colors hover:border-[#89AE99]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8EB09C]"
            >
              <div
                className="relative h-16 w-full rounded border border-white/10"
                style={{ backgroundColor: swatch.hex }}
              >
                <span className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {isCopied ? (
                    <Check className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3 w-3" aria-hidden="true" />
                  )}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-1">
                <span className="font-mono-tabular text-xs font-medium text-[#F0F4F1]">
                  {isCopied ? '已复制' : swatch.hex}
                </span>
              </div>
              <div className="mt-0.5 text-xs font-semibold text-[#B9D3C4] truncate">
                {swatch.name}
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-[#8FA297] line-clamp-2">
                {swatch.usage}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
