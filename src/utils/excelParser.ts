/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import ExcelJS from 'exceljs';
import { ExcelRow } from '../types';

/**
 * Parses an Excel file (.xlsx) from a File object,
 * extracting all textual row columns and embedded cell drawings/images.
 */
export async function parseExcelProductFile(
  file: File,
  sheetName?: string
): Promise<{
  sheetNames: string[];
  selectedSheet: string;
  headers: string[];
  rows: ExcelRow[];
  imageColumns: { colIndex: number; name: string }[];
}> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const sheetNames = workbook.worksheets.map(ws => ws.name);
  if (sheetNames.length === 0) {
    throw new Error('Yüklenen Excel dosyasında hiç çalışma sayfası bulunamadı.');
  }

  // Use specified sheet or first workspace
  const activeSheetName = sheetName || sheetNames[0];
  const worksheet = workbook.getWorksheet(activeSheetName);
  if (!worksheet) {
    throw new Error(`"${activeSheetName}" isimli sayfa bulunamadı.`);
  }

  // 1. Identify the headers row (We look for the first non-empty row as header)
  let headerRowNo = 1;
  let headers: string[] = [];
  
  // Dynamic header search: find first row that has multiple values
  for (let r = 1; r <= Math.min(worksheet.rowCount, 10); r++) {
    const row = worksheet.getRow(r);
    const rowVals: string[] = [];
    row.eachCell((cell) => {
      const val = cell.value?.toString().trim();
      if (val) rowVals.push(val);
    });
    if (rowVals.length >= 2) {
      headerRowNo = r;
      // Get all cells including empty ones up to last cell, or map it manually
      const colsCount = row.cellCount;
      for (let c = 1; c <= colsCount; c++) {
        const val = row.getCell(c).value;
        const colHeader = val ? val.toString().trim() : `Süreç_${c}`;
        // Ensure unic headers
        if (headers.includes(colHeader)) {
          headers.push(`${colHeader}_${c}`);
        } else {
          headers.push(colHeader);
        }
      }
      break;
    }
  }

  // Fallback headers if not found
  if (headers.length === 0) {
    headers = ['Sütun A', 'Sütun B', 'Sütun C', 'Sütun D'];
    headerRowNo = 1;
  }

  // Helper to convert excel column number to letter (A, B, C...)
  const colLetter = (colIndex: number): string => {
    let letter = '';
    let temp = colIndex;
    while (temp > 0) {
      const mod = (temp - 1) % 26;
      letter = String.fromCharCode(65 + mod) + letter;
      temp = Math.floor((temp - mod) / 26);
    }
    return letter || 'A';
  };

  // 2. Locate and extract all images mapping them to cell row/col index
  // exceljs image formats can be fetched using worksheet.getImages()
  // which returns range (top-left, bottom-right) and matching imageId
  const excelImages: { colIndex: number; rowIndex: number; dataUrl: string }[] = [];
  const wsImages = worksheet.getImages();
  
  wsImages.forEach((imgMeta) => {
    const imgId = parseInt(imgMeta.imageId);
    const image = workbook.getImage(imgId);
    
    if (image && image.buffer) {
      try {
        const u8 = new Uint8Array(image.buffer);
        const mimeType = image.extension === 'png' ? 'image/png' : 'image/jpeg';
        const blob = new Blob([u8], { type: mimeType });
        const dataUrl = URL.createObjectURL(blob);
        
        // tl: Top Left Cell (row and col are 0-indexed in some versions of exceljs, let's normalize)
        // Worksheet getImages returns fractional or integer coords
        const tlRow = Math.floor(imgMeta.range.tl.row);
        const tlCol = Math.floor(imgMeta.range.tl.col);

        excelImages.push({
          rowIndex: tlRow,
          colIndex: tlCol,
          dataUrl: dataUrl
        });
      } catch (err) {
        console.error('Resim ayrıştırma hatası:', err);
      }
    }
  });

  // 3. Extract text rows, starting immediately after the header row
  const rows: ExcelRow[] = [];
  let rowIdxCounter = 0;

  for (let r = headerRowNo + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    
    // Check if row is completely empty
    let hasValue = false;
    const rowValues: Record<string, string> = {};
    const rowImages: Record<number, string> = {};

    headers.forEach((header, index) => {
      const colNum = index + 1;
      const cell = row.getCell(colNum);
      let valueStr = '';
      
      if (cell && cell.value !== undefined && cell.value !== null) {
        if (typeof cell.value === 'object') {
          // Could be a rich text element, date, or formulas
          const valObj = cell.value as any;
          if (valObj.text) {
            valueStr = valObj.text.toString();
          } else if (valObj.result !== undefined && valObj.result !== null) {
            valueStr = valObj.result.toString();
          } else if (cell.value instanceof Date) {
            valueStr = cell.value.toLocaleDateString('tr-TR');
          } else {
            valueStr = JSON.stringify(valObj);
          }
        } else {
          valueStr = cell.value.toString();
        }
      }
      
      if (valueStr.trim()) {
        hasValue = true;
      }
      rowValues[header] = valueStr;
    });

    // Match extracted images for this row
    // Note: ExcelJS images use 0-indexed rows or fractional rows. We map if image row matches r - 1
    const matchingImages = excelImages.filter(img => img.rowIndex === r - 1);
    matchingImages.forEach(img => {
      rowImages[img.colIndex] = img.dataUrl;
      hasValue = true; // Mark as non-empty row if it contains an image!
    });

    if (hasValue) {
      rows.push({
        id: `row-${r}-${rowIdxCounter}`,
        rowIndex: rowIdxCounter,
        rowNumber: r,
        values: rowValues,
        images: rowImages
      });
      rowIdxCounter++;
    }
  }

  // Collect image columns that actually have some pictures to recommend them to the user
  const foundImageColsMap: Record<number, boolean> = {};
  excelImages.forEach(img => {
    foundImageColsMap[img.colIndex] = true;
  });

  const imageColumns = Object.keys(foundImageColsMap).map(col => {
    const idx = parseInt(col);
    const colName = headers[idx] ? headers[idx] : `${colLetter(idx + 1)} Sütunu (Resim)`;
    return {
      colIndex: idx,
      name: colName
    };
  });

  return {
    sheetNames,
    selectedSheet: activeSheetName,
    headers,
    rows,
    imageColumns
  };
}

/**
 * Parses a CSV file, detecting commas, semicolons, or tabs as delimiters,
 * handling double-quoted strings and escaped characters correctly.
 */
export async function parseCsvProductFile(
  file: File
): Promise<{
  sheetNames: string[];
  selectedSheet: string;
  headers: string[];
  rows: ExcelRow[];
  imageColumns: { colIndex: number; name: string }[];
}> {
  const text = await file.text();
  
  // 1. Detect delimiter by looking at the first non-empty lines
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  const firstLine = lines[0] || '';
  let delimiter = ',';
  if ((firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length) {
    delimiter = ';';
  } else if ((firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length) {
    delimiter = '\t';
  }

  // 2. Parse lines with quoting support
  const rowsRaw: string[][] = [];
  let currentField = '';
  let inQuotes = false;
  let currentRow: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped double quote
        currentField += '"';
        i++; // skip next char
      } else {
        // Toggle quotes state
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip next char \n
      }
      currentRow.push(currentField.trim());
      currentField = '';
      
      // Filter out completely empty rows
      if (currentRow.some(cell => cell !== '')) {
        rowsRaw.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }
  
  // Push remaining field and row if there's any pending
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(cell => cell !== '')) {
      rowsRaw.push(currentRow);
    }
  }

  if (rowsRaw.length === 0) {
    throw new Error('Yüklenen CSV dosyasında veri bulunamadı.');
  }

  // First row is headers
  const headers = rowsRaw[0].map((h, idx) => h || `Sütun_${idx + 1}`);
  
  const rows: ExcelRow[] = [];
  let rowIdxCounter = 0;

  for (let r = 1; r < rowsRaw.length; r++) {
    const cells = rowsRaw[r];
    const rowValues: Record<string, string> = {};
    let hasValue = false;

    headers.forEach((header, index) => {
      const cellVal = cells[index] || '';
      rowValues[header] = cellVal;
      if (cellVal) {
        hasValue = true;
      }
    });

    if (hasValue) {
      rows.push({
        id: `row-csv-${r}-${rowIdxCounter}`,
        rowIndex: rowIdxCounter,
        rowNumber: r + 1,
        values: rowValues,
        images: {} // CSV can't hold binary images directly
      });
      rowIdxCounter++;
    }
  }

  return {
    sheetNames: ['CSV Verisi'],
    selectedSheet: 'CSV Verisi',
    headers,
    rows,
    imageColumns: []
  };
}
