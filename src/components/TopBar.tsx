import { Upload } from 'lucide-react';

interface TopBarProps {
  onTriggerUpload: () => void;
  isAnalyzing: boolean;
}

export function TopBar({ onTriggerUpload, isAnalyzing }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#B8D0C2]/15 bg-[#0B110E]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line brand wordmark */}
        <a
          href="#top"
          className="font-editorial text-lg font-semibold tracking-tight text-[#F1F4F1] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8EB09C] rounded-sm"
        >
          图谱摄影分析
        </a>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label="分析板模块导航"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-[#A2B2A9]"
        >
          <a
            href="#module-photo"
            className="transition-colors hover:text-[#F1F4F1] hover:underline underline-offset-8 decoration-[#5D806C] whitespace-nowrap shrink-0"
          >
            主体标注
          </a>
          <a
            href="#module-composition"
            className="transition-colors hover:text-[#F1F4F1] hover:underline underline-offset-8 decoration-[#5D806C] whitespace-nowrap shrink-0"
          >
            构图机位
          </a>
          <a
            href="#module-details"
            className="transition-colors hover:text-[#F1F4F1] hover:underline underline-offset-8 decoration-[#5D806C] whitespace-nowrap shrink-0"
          >
            细节与色卡
          </a>
          <a
            href="#module-prompts"
            className="transition-colors hover:text-[#F1F4F1] hover:underline underline-offset-8 decoration-[#5D806C] whitespace-nowrap shrink-0"
          >
            反推提示词
          </a>
        </nav>

        {/* Zone 3: Single primary CTA */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onTriggerUpload}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-2 rounded-lg bg-[#DCE8E0] px-4 py-2 text-sm font-semibold text-[#0C1410] transition-colors hover:bg-white disabled:opacity-60 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8EB09C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B110E]"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span>{isAnalyzing ? '解析中…' : '上传照片分析'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
