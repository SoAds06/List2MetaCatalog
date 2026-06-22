/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ExcelImage {
  colIndex: number;
  rowIndex: number;
  dataUrl: string;
}

export interface ExcelRow {
  id: string;
  rowIndex: number; // 0-indexed in parsed list
  rowNumber: number; // Excel original row number (e.g. 2, 3...)
  values: Record<string, string>; // Column Name -> Cell Text Value
  images: Record<number, string>; // Column Index -> Image base64/objectURL
}

export interface CardLayerStyle {
  fontSize: number;
  color: string;
  fontFamily: 'sans' | 'display' | 'mono' | 'serif';
  fontWeight: 'light' | 'normal' | 'medium' | 'semibold' | 'bold';
  align: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  hasBackgroundColor: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  borderRadius: number;
  padding: number;
  uppercase: boolean;
  lineThrough?: boolean;
  underline?: boolean;
  italic?: boolean;
  lineHeight?: number;
}

export interface CardLayer {
  id: string;
  name: string; // Label (e.g. "Ürün Adı", "Fiyat", "Ürün Fotoğrafı")
  type: 'text' | 'image' | 'shape';
  mappedColumn: string; // The text column header, or "__excel_image_col_X" for excel images
  x: number; // percentage from left (0 to 100)
  y: number; // percentage from top (0 to 100)
  width: number; // percentage width
  height: number; // percentage height
  style: CardLayerStyle;
  objectFit?: 'cover' | 'contain' | 'fill';
  shapeType?: 'rectangle' | 'circle' | 'triangle';
  borderColor?: string;
  borderWidth?: number;
}

export interface CardTemplate {
  id: string;
  name: string;
  backgroundUrl: string; // custom upload (dataUrl) or built-in template
  widthPx: number; // target output dimensions (e.g. 800)
  heightPx: number; // target output dimensions (e.g. 1000)
  layers: CardLayer[];
}
