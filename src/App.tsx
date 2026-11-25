import { useCallback, useRef, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw, Upload } from 'lucide-react';
import { SAMPLE_PRESETS } from './data/samples';
import type { DetailCrop, PhotoAnalysisReport } from './types/analysis';
import { normalizeAnalysisReport } from './utils/analysisLogic';
import { prepareUploadedImage } from './utils/imageCanvas';
import { renderAnalysisBoardToPng } from './utils/boardExporter';
import { TopBar } from './components/TopBar';
import { WorkspaceToolbar } from './components/WorkspaceToolbar';
import { ModuleAnnotatedPhoto } from './components/ModuleAnnotatedPhoto';
import { ModuleKeywords } from './components/ModuleKeywords';
import { ModuleComposition } from './components/ModuleComposition';
import { ModuleDetails } from './components/ModuleDetails';
import { ModuleLighting } from './components/ModuleLighting';
import { ModulePalette } from './components/ModulePalette';
import { ModulePrompts } from './components/ModulePrompts';
import { ExportPreviewModal } from './components/ExportPreviewModal';

interface CustomAnalysisState {
  fileName: string;
  imageUrl: string;
  uploadDataUrl: string;
  sampledPalette: string[];
  report: PhotoAnalysisReport | null;
}

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeSourceId, setActiveSourceId] = useState<string>(SAMPLE_PRESETS[0].id);
  const [customState, setCustomState] = useState<CustomAnalysisState | null>(null);

  const [showAnnotations, setShowAnnotations] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<DetailCrop | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [previewBoardUrl, setPreviewBoardUrl] = useState<string | null>(null);

  const activeSample =
    SAMPLE_PRESETS.find((s) => s.id === activeSourceId) ?? SAMPLE_PRESETS[0];

  const isCustomActive = activeSourceId === 'custom' && customState?.report != null;
  const currentImageUrl = isCustomActive ? customState.imageUrl : activeSample.imageUrl;
  const currentReport: PhotoAnalysisReport = isCustomActive
    ? customState.report!
    : activeSample.report;

  const runServerAnalysis = useCallback(
    async (payload: {
      fileName: string;
      displayDataUrl: string;
      uploadDataUrl: string;
      sampledPalette: string[];
    }) => {
      setIsAnalyzing(true);
      setErrorMessage(null);
      setActiveAnnotationId(null);
      setActiveDetail(null);
      setAnalysisPhase('正在解析画面主体、构图透视、光影逻辑与局部细节…');

      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageDataUrl: payload.uploadDataUrl,
            sampledHexColors: payload.sampledPalette,
          }),
        });

        const data = (await res.json().catch(() => ({}))) as {
          report?: unknown;
          error?: string;
        };

        if (!res.ok || !data.report) {
          throw new Error(data.error || `分析服务返回异常（HTTP ${res.status}）`);
        }

        const normalized = normalizeAnalysisReport(data.report);
        setCustomState({
          fileName: payload.fileName,
          imageUrl: payload.displayDataUrl,
          uploadDataUrl: payload.uploadDataUrl,
          sampledPalette: payload.sampledPalette,
          report: normalized,
        });
        setActiveSourceId('custom');
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : '照片视觉分析未能完成，请重试。';
        setErrorMessage(message);
      } finally {
        setIsAnalyzing(false);
        setAnalysisPhase('');
      }
    },
    []
  );

  const handleFileSelected = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      setErrorMessage(null);
      setIsAnalyzing(true);
      setAnalysisPhase('正在读取原图并提取真实像素色彩与构图轮廓…');

      try {
        const prepared = await prepareUploadedImage(file);
        setCustomState({
          fileName: file.name,
          imageUrl: prepared.displayDataUrl,
          uploadDataUrl: prepared.uploadDataUrl,
          sampledPalette: prepared.sampledPalette,
          report: null,
        });
        await runServerAnalysis({
          fileName: file.name,
          displayDataUrl: prepared.displayDataUrl,
          uploadDataUrl: prepared.uploadDataUrl,
          sampledPalette: prepared.sampledPalette,
        });
      } catch (err: unknown) {
        setIsAnalyzing(false);
        setAnalysisPhase('');
        setErrorMessage(
          err instanceof Error ? err.message : '无法处理所选图片，请更换文件。'
        );
      }
    },
    [runServerAnalysis]
  );

  const handleRetryCustom = () => {
    if (!customState) return;
    runServerAnalysis({
      fileName: customState.fileName,
      displayDataUrl: customState.imageUrl,
      uploadDataUrl: customState.uploadDataUrl,
      sampledPalette: customState.sampledPalette,
    });
  };

  const triggerUploadDialog = () => {
    fileInputRef.current?.click();
  };

  const handleSelectSample = (sampleId: string) => {
    setActiveSourceId(sampleId);
    setActiveAnnotationId(null);
    setActiveDetail(null);
    setErrorMessage(null);
  };

  const handleGenerateBoardPng = async (autoDownload: boolean) => {
    setIsExporting(true);
    setErrorMessage(null);
    try {
      const pngUrl = await renderAnalysisBoardToPng(currentImageUrl, currentReport);
      if (autoDownload) {
        const link = document.createElement('a');
        const safeName = currentReport.title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, '').slice(0, 28) || 'visual-analysis-board';
        link.href = pngUrl;
        link.download = `${safeName}-16x9.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setPreviewBoardUrl(pngUrl);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : '合成 16:9 分析板失败，请稍后重试。'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadFromPreview = () => {
    if (!previewBoardUrl) return;
    const link = document.createElement('a');
    const safeName = currentReport.title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, '').slice(0, 28) || 'visual-analysis-board';
    link.href = previewBoardUrl;
    link.download = `${safeName}-16x9.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      id="top"
      className="min-h-screen bg-[#0B110E] text-[#F1F4F1]"
      onDragOver={(e) => {
        e.preventDefault();
        if (!isDragging) setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) {
          handleFileSelected(droppedFile);
        }
      }}
    >
      {/* Hidden native file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        aria-label="选择本地照片进行视觉分析"
        className="sr-only"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          handleFileSelected(selected);
          e.target.value = '';
        }}
      />

      <TopBar onTriggerUpload={triggerUploadDialog} isAnalyzing={isAnalyzing} />

      <main className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8">
        {/* Workspace Toolbar: Sample Archive Switcher + Overlay Toggles + 16:9 Export */}
        <WorkspaceToolbar
          samples={SAMPLE_PRESETS}
          activeSourceId={activeSourceId}
          hasCustomUpload={Boolean(customState?.report)}
          customFileName={customState?.fileName}
          showAnnotations={showAnnotations}
          showGuides={showGuides}
          isExporting={isExporting}
          isAnalyzing={isAnalyzing}
          onSelectSample={handleSelectSample}
          onSelectCustomUpload={() => {
            if (customState?.report) {
              setActiveSourceId('custom');
              setActiveAnnotationId(null);
              setActiveDetail(null);
            }
          }}
          onToggleAnnotations={() => setShowAnnotations((v) => !v)}
          onToggleGuides={() => setShowGuides((v) => !v)}
          onPreviewBoard={() => handleGenerateBoardPng(false)}
          onDownloadBoard={() => handleGenerateBoardPng(true)}
        />

        {/* Error Notification Banner */}
        {errorMessage && (
          <div
            role="alert"
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#C86464]/40 bg-[#231414] px-4 py-3 text-sm text-[#F4DADA]"
          >
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-[#E58686]" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
            <div className="flex items-center gap-2">
              {customState && (
                <button
                  type="button"
                  onClick={handleRetryCustom}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#E58686]/40 bg-[#321C1C] px-3 py-1 text-xs font-medium text-white hover:bg-[#3E2222]"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>重试解析</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="rounded-md px-2.5 py-1 text-xs text-[#DFB8B8] hover:text-white"
              >
                关闭
              </button>
            </div>
          </div>
        )}

        {/* Active Live Analysis Loading State */}
        {isAnalyzing && (
          <section
            aria-live="polite"
            className="mt-5 flex flex-col items-center gap-5 rounded-2xl border border-[#B8D0C2]/20 bg-[#111A16] p-8 text-center sm:p-10"
          >
            {customState?.imageUrl && (
              <img
                src={customState.imageUrl}
                alt="待解析的上传参考照片"
                className="max-h-56 w-auto rounded-lg border border-white/15 object-contain shadow-xl"
              />
            )}
            <div className="flex items-center gap-2.5 text-sm font-medium text-[#DDECE3]">
              <Loader2 className="h-4 w-4 animate-spin text-[#8EB09C]" aria-hidden="true" />
              <span>{analysisPhase || '正在进行全维度视觉基因解析…'}</span>
            </div>
            <p className="max-w-xl text-xs leading-relaxed text-[#8CA095]">
              系统正在基于照片真实视觉证据自主识别主体结构、构图透视、局部裁切框、光影逻辑、六色色卡及中英文反推提示词，通常需要 8–18 秒。
            </p>
          </section>
        )}

        {/* 16:9 Publication-Grade Visual Analysis Board */}
        <article
          aria-label="摄影视觉基因分析板"
          className={`mt-5 rounded-2xl border border-[#B8D0C2]/18 bg-[#0F1713] p-4 sm:p-6 transition-opacity duration-200 ${
            isAnalyzing ? 'pointer-events-none opacity-45' : 'opacity-100'
          }`}
        >
          {/* Archival Masthead Header */}
          <div className="mb-5 flex flex-col gap-2 border-b border-[#B8D0C2]/15 pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h1 className="font-editorial text-xl font-semibold tracking-tight text-[#F4F7F5] sm:text-2xl [text-wrap:balance]">
                {currentReport.title}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#9BB3A5]">
                <span>{currentReport.genre}</span>
                <span aria-hidden="true" className="text-[#597063]">·</span>
                <span className="text-[#B8C7BE]">{currentReport.visualSignature}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-[#7E9287] shrink-0">
              <span>拖拽任意照片至页面即可自动解析</span>
              <button
                type="button"
                onClick={triggerUploadDialog}
                className="inline-flex items-center gap-1 font-medium text-[#C8DFD1] underline decoration-[#5D806C] underline-offset-4 hover:text-white whitespace-nowrap shrink-0"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>选择文件</span>
              </button>
            </div>
          </div>

          {/* Asymmetric 16:9 Modular Grid Layout */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.46fr)_minmax(0,1fr)] xl:items-start">
            {/* LEFT MAJOR COLUMN: Module A (Photo + Annotations) -> Module D (5 Crops) -> Module F (6 Swatches) */}
            <div className="flex flex-col gap-5 min-w-0">
              <ModuleAnnotatedPhoto
                imageUrl={currentImageUrl}
                imageAlt={currentReport.title}
                annotations={currentReport.annotations}
                showAnnotations={showAnnotations}
                activeAnnotationId={activeAnnotationId}
                activeDetailCrop={activeDetail}
                onSelectAnnotation={setActiveAnnotationId}
                onTriggerUpload={triggerUploadDialog}
              />

              <ModuleDetails
                imageUrl={currentImageUrl}
                details={currentReport.details}
                activeDetailId={activeDetail?.id ?? null}
                onSelectDetail={setActiveDetail}
              />

              <ModulePalette palette={currentReport.palette} />
            </div>

            {/* RIGHT ANALYTICAL COLUMN: Module B (Keywords) -> Module C (Composition) -> Module E (Lighting) -> Module G (Prompts) */}
            <div className="flex flex-col gap-5 min-w-0">
              <ModuleKeywords keywords={currentReport.keywords} />

              <ModuleComposition
                imageUrl={currentImageUrl}
                composition={currentReport.composition}
                showGuides={showGuides}
              />

              <ModuleLighting lighting={currentReport.lighting} />

              <ModulePrompts report={currentReport} />
            </div>
          </div>
        </article>
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="mx-auto mt-6 max-w-[1480px] border-t border-[#B8D0C2]/10 px-4 py-5 text-xs text-[#75877D] sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>图谱 · 全类型照片视觉基因解析与 16:9 摄影分析板工作台</span>
          <span>原图本地保真裁切 · 构图轮廓线稿提取 · 2560 × 1440 PNG 出版导出</span>
        </div>
      </footer>

      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#09100D]/88 p-6 backdrop-blur-sm">
          <div className="flex max-w-md flex-col items-center rounded-2xl border-2 border-dashed border-[#8EB09C] bg-[#121D18] px-10 py-12 text-center shadow-2xl">
            <Upload className="h-10 w-10 text-[#BFD8C9]" aria-hidden="true" />
            <p className="mt-4 font-editorial text-lg font-semibold text-white">
              松开即可解析这张参考照片
            </p>
            <p className="mt-1.5 text-xs text-[#9BB0A4]">
              支持 JPG、PNG、WebP 格式，自动生成 7 大模块与 16:9 高清分析板
            </p>
          </div>
        </div>
      )}

      {/* 16:9 HD Export Preview Lightbox */}
      <ExportPreviewModal
        boardPngUrl={previewBoardUrl}
        title={currentReport.title}
        onClose={() => setPreviewBoardUrl(null)}
        onDownload={handleDownloadFromPreview}
      />
    </div>
  );
}
