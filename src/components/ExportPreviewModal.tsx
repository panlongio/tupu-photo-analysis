import { useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface ExportPreviewModalProps {
  boardPngUrl: string | null;
  title: string;
  onClose: () => void;
  onDownload: () => void;
}

export function ExportPreviewModal({
  boardPngUrl,
  title,
  onClose,
  onDownload,
}: ExportPreviewModalProps) {
  useEffect(() => {
    if (!boardPngUrl) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [boardPngUrl, onClose]);

  if (!boardPngUrl) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-4 sm:p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-[1320px] flex-col overflow-hidden rounded-xl border border-[#B8D0C2]/22 bg-[#0F1713] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#B8D0C2]/15 px-5 py-3.5">
          <div>
            <h2 id="export-modal-title" className="font-editorial text-base font-semibold text-[#F1F4F1]">
              16:9 视觉分析板成品预览
            </h2>
            <p className="mt-0.5 text-xs text-[#8CA095]">
              {title} · 2560 × 1440 高清出版级信息图
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#DCE8E0] px-4 py-2 text-xs font-semibold text-[#0C1410] transition-colors hover:bg-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8EB09C]"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>下载 16:9 高清 PNG</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭预览窗口"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#B8D0C2]/20 bg-[#15201B] text-[#C4D4CB] transition-colors hover:bg-[#1E2E26] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8EB09C]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-[#090E0C] p-4 sm:p-6">
          <img
            src={boardPngUrl}
            alt="16:9 高清摄影视觉分析板预览"
            className="mx-auto w-full max-w-[1260px] rounded border border-[#B8D0C2]/20 shadow-2xl"
          />
        </div>
      </div>
    </div>
  );
}
