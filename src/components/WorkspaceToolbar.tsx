import { Download, Eye, EyeOff, Grid, Image as ImageIcon } from 'lucide-react';
import type { SamplePhotoPreset } from '../types/analysis';

interface WorkspaceToolbarProps {
  samples: SamplePhotoPreset[];
  activeSourceId: string;
  hasCustomUpload: boolean;
  customFileName?: string;
  showAnnotations: boolean;
  showGuides: boolean;
  isExporting: boolean;
  isAnalyzing: boolean;
  onSelectSample: (sampleId: string) => void;
  onSelectCustomUpload: () => void;
  onToggleAnnotations: () => void;
  onToggleGuides: () => void;
  onPreviewBoard: () => void;
  onDownloadBoard: () => void;
}

export function WorkspaceToolbar({
  samples,
  activeSourceId,
  hasCustomUpload,
  customFileName,
  showAnnotations,
  showGuides,
  isExporting,
  isAnalyzing,
  onSelectSample,
  onSelectCustomUpload,
  onToggleAnnotations,
  onToggleGuides,
  onPreviewBoard,
  onDownloadBoard,
}: WorkspaceToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#B8D0C2]/15 pb-4 lg:flex-row lg:items-center lg:justify-between">
      {/* Sample Archive Switcher */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="照片样本切换">
        <span className="mr-2 text-xs font-medium text-[#7F9187] whitespace-nowrap shrink-0">
          样本档案
        </span>
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[#121B17] p-1 border border-[#B8D0C2]/12">
          {samples.map((sample) => {
            const active = activeSourceId === sample.id;
            return (
              <button
                key={sample.id}
                type="button"
                disabled={isAnalyzing}
                onClick={() => onSelectSample(sample.id)}
                aria-pressed={active}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8EB09C] ${
                  active
                    ? 'bg-[#263930] text-[#EFF5F1]'
                    : 'text-[#97A89E] hover:text-[#E6EEE9]'
                }`}
              >
                {sample.label}
              </button>
            );
          })}
          {hasCustomUpload && (
            <button
              type="button"
              disabled={isAnalyzing}
              onClick={onSelectCustomUpload}
              aria-pressed={activeSourceId === 'custom'}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8EB09C] ${
                activeSourceId === 'custom'
                  ? 'bg-[#263930] text-[#EFF5F1]'
                  : 'text-[#97A89E] hover:text-[#E6EEE9]'
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="max-w-[140px] truncate">{customFileName || '自定义照片'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Board Layer & 16:9 Export Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggleAnnotations}
          aria-pressed={showAnnotations}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8EB09C] ${
            showAnnotations
              ? 'border-[#557764] bg-[#1E2E26] text-[#DCE9E1]'
              : 'border-[#B8D0C2]/15 bg-[#121B17] text-[#8E9F95] hover:text-[#E6EEE9]'
          }`}
        >
          {showAnnotations ? (
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{showAnnotations ? '隐藏标注线' : '显示标注线'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleGuides}
          aria-pressed={showGuides}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8EB09C] ${
            showGuides
              ? 'border-[#557764] bg-[#1E2E26] text-[#DCE9E1]'
              : 'border-[#B8D0C2]/15 bg-[#121B17] text-[#8E9F95] hover:text-[#E6EEE9]'
          }`}
        >
          <Grid className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{showGuides ? '隐藏构图线' : '显示构图线'}</span>
        </button>

        <button
          type="button"
          onClick={onPreviewBoard}
          disabled={isExporting || isAnalyzing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#B8D0C2]/20 bg-[#15201B] px-3 py-1.5 text-xs font-medium text-[#D6E4DC] transition-colors hover:border-[#789D88] hover:bg-[#1B2A23] disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8EB09C]"
        >
          <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{isExporting ? '合成中…' : '预览 16:9 分析板'}</span>
        </button>

        <button
          type="button"
          onClick={onDownloadBoard}
          disabled={isExporting || isAnalyzing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#6E947E]/60 bg-[#23372D] px-3.5 py-1.5 text-xs font-semibold text-[#EAF3ED] transition-colors hover:bg-[#2C4538] disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8EB09C]"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          <span>导出 16:9 PNG</span>
        </button>
      </div>
    </div>
  );
}
