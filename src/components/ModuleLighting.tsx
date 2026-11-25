import type { LightingFeature } from '../types/analysis';

interface ModuleLightingProps {
  lighting: LightingFeature[];
}

export function ModuleLighting({ lighting }: ModuleLightingProps) {
  return (
    <section
      aria-labelledby="heading-module-e"
      className="rounded-xl border border-[#B8D0C2]/15 bg-[#121B17] p-4 sm:p-5"
    >
      <div className="mb-3.5 flex items-baseline gap-2.5 border-b border-[#B8D0C2]/12 pb-2.5">
        <span className="font-mono-tabular text-xs font-medium text-[#8EB09C]">05</span>
        <h2 id="heading-module-e" className="font-editorial text-base font-semibold text-[#F1F4F1]">
          光影与色彩特征
        </h2>
      </div>

      <ul className="space-y-2.5">
        {lighting.map((item, idx) => (
          <li
            key={`${item.tag}-${idx}`}
            className="grid grid-cols-[100px_minmax(0,1fr)] items-baseline gap-3"
          >
            {/* Explicitly requested low-saturation green label from Section 08 */}
            <span className="inline-flex items-center justify-center rounded-md border border-[#5D806C]/40 bg-[#21332A] px-2 py-0.5 text-center text-xs font-medium text-[#C5DDD0] whitespace-nowrap truncate">
              {item.tag}
            </span>
            <p className="text-[13px] leading-relaxed text-[#CBD7D0]">{item.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
