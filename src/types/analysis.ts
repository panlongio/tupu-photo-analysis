export interface VisualAnnotation {
  id: string;
  title: string;
  observation: string;
  /** Normalized 0..1000 horizontal coordinate on the photo */
  anchorX: number;
  /** Normalized 0..1000 vertical coordinate on the photo */
  anchorY: number;
  /** Preferred side for callout card placement */
  preferredSide?: 'left' | 'right';
}

export interface KeywordAnchor {
  label: string;
  description: string;
}

export type CompositionGuideKind =
  | 'rule_of_thirds'
  | 'center_axis'
  | 'leading_line'
  | 'diagonal'
  | 'vanishing_point'
  | 'frame_box'
  | 'focal_point'
  | 'curve';

export interface CompositionGuide {
  kind: CompositionGuideKind;
  label?: string;
  /** Coordinates in 0..1000 normalized space.
   * - leading_line / diagonal: [x1, y1, x2, y2]
   * - vanishing_point / focal_point: [x, y]
   * - frame_box: [xmin, ymin, xmax, ymax]
   * - curve: [x1, y1, cx, cy, x2, y2]
   * - rule_of_thirds / center_axis: [] (automatic full-frame guide)
   */
  coords: number[];
}

export interface CompositionAnalysis {
  primaryMethod: string;
  compositionPoints: string;
  cameraAndLens: string;
  guides: CompositionGuide[];
}

export interface DetailCrop {
  id: string;
  title: string;
  explanation: string;
  /** Normalized [ymin, xmin, ymax, xmax] in 0..1000 */
  box: [number, number, number, number];
}

export interface LightingFeature {
  tag: string;
  description: string;
}

export interface ColorSwatch {
  hex: string;
  name: string;
  usage: string;
  approximate?: boolean;
}

export interface ReversePrompts {
  chinese: string;
  english: string;
}

export interface PhotoAnalysisReport {
  title: string;
  genre: string;
  visualSignature: string;
  annotations: VisualAnnotation[];
  keywords: KeywordAnchor[];
  composition: CompositionAnalysis;
  details: DetailCrop[];
  lighting: LightingFeature[];
  palette: ColorSwatch[];
  prompts: ReversePrompts;
}

export interface SamplePhotoPreset {
  id: string;
  label: string;
  genre: string;
  imageUrl: string;
  report: PhotoAnalysisReport;
}

export interface PlacedAnnotation {
  annotation: VisualAnnotation;
  side: 'left' | 'right';
  /** Normalized 0..1 vertical center of the callout card within the container */
  cardY: number;
}

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
