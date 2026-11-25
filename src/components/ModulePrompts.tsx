import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { PhotoAnalysisReport } from '../types/analysis';
import { formatPromptsForClipboard } from '../utils/analysisLogic';

interface ModulePromptsProps {
  report: PhotoAnalysisReport;
}

export function ModulePrompts({ report }: ModulePromptsProps) {
  const [copiedKey, setCopiedKey] = useState<'zh' | 'en' | 'all' | null>(null);

  const handleCopy = async (key: 'zh' | 'en' | 'all', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 1800);
    } catch {
      // Ignore clipboard failures in restricted contexts
    }
  };

  return (
    <section
      id="module-prompts"
      aria-labelledby="heading-module-g"
      className="rounded-xl border border-[#B8D0C2]/15 bg-[#121B17] p-4 sm:p-5"
    >
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-[#B8D0C2]/12 pb-2.5">
        <div className="flex items-baseline gap-2.5">
          <span className="font-mono-tabular text-xs font-medium text-[#8EB09C]">07</span>
          <h2 id="heading-module-g" className="font-editorial text-base font-semibold text-[#F1F4F1]">
            完整反推提示词（可直接用于图像生成）
          </h2>
        </div>

        <button
          type="button"
          onClick={() => handleCopy('all', formatPromptsForClipboard(report))}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#B8D0C2]/20 bg-[#18251F] px-2.5 py-1 text-xs font-medium text-[#D2E2D8] transition-colors hover:border-[#7CA38D] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8EB09C]"
        >
          {copiedKey === 'all' ? (
            <Check className="h-3.5 w-3.5 text-[#9FD0B4]" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{copiedKey === 'all' ? '已复制双语' : '复制双语 Prompt'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Chinese Prompt */}
        <div className="flex flex-col rounded-lg border border-[#B8D0C2]/12 bg-[#0D1511] p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-[#B9D3C4]">中文 Prompt</h3>
            <button
              type="button"
              onClick={() => handleCopy('zh', report.prompts.chinese)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#92AD9E] transition-colors hover:text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8EB09C] rounded"
            >
              {copiedKey === 'zh' ? (
                <Check className="h-3 w-3 text-[#9FD0B4]" aria-hidden="true" />
              ) : (
                <Copy className="h-3 w-3" aria-hidden="true" />
              )}
              <span>{copiedKey === 'zh' ? '已复制' : '复制中文'}</span>
            </button>
          </div>
          <p className="text-xs leading-relaxed text-[#CBD7D0] select-all">
            {report.prompts.chinese}
          </p>
        </div>

        {/* English Prompt */}
        <div className="flex flex-col rounded-lg border border-[#B8D0C2]/12 bg-[#0D1511] p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-[#B9D3C4]">English Prompt</h3>
            <button
              type="button"
              onClick={() => handleCopy('en', report.prompts.english)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#92AD9E] transition-colors hover:text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8EB09C] rounded"
            >
              {copiedKey === 'en' ? (
                <Check className="h-3 w-3 text-[#9FD0B4]" aria-hidden="true" />
              ) : (
                <Copy className="h-3 w-3" aria-hidden="true" />
              )}
              <span>{copiedKey === 'en' ? 'Copied' : '复制 English'}</span>
            </button>
          </div>
          <p className="text-xs leading-relaxed text-[#CBD7D0] select-all">
            {report.prompts.english}
          </p>
        </div>
      </div>
    </section>
  );
}
