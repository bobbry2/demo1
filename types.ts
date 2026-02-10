
export interface PDFFile {
  name: string;
  data: Uint8Array;
  size: number;
}

export enum EditorTool {
  POINTER = 'pointer',
  TEXT = 'text',
  HIGHLIGHT = 'highlight',
  DRAW = 'draw',
  LINE = 'line',
  SQUARE = 'square',
  CIRCLE = 'circle',
}

export interface Point {
  x: number;
  y: number;
}

export type TextAlignment = 'left' | 'center' | 'right';

export interface Annotation {
  id: string;
  type: EditorTool;
  x: number;
  y: number;
  width?: number; // For shapes
  height?: number; // For shapes
  content?: string;
  pageIndex: number;
  color: string;
  thickness: number;
  fontSize?: number;
  fontFamily?: string;
  alignment?: TextAlignment;
  points?: Point[]; // For freehand drawing
}
