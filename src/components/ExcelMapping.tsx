/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ExcelRow, CardLayer } from '../types';
import { parseExcelProductFile, parseCsvProductFile } from '../utils/excelParser';
import { FileSpreadsheet, AlertCircle, Upload, Check, ChevronDown, RefreshCw, Sliders } from 'lucide-react';

interface ExcelMappingProps {
  onDataParsed: (data: {
    headers: string[];
    rows: ExcelRow[];
    imageColumns: { colIndex: number; name: string }[];
    sheetNames: string[];
  }) => void;
  headers: string[];
  rows: ExcelRow[];
  imageColumns: { colIndex: number; name: string }[];
  templateLayers: CardLayer[];
  onUpdateLayers: (layers: CardLayer[]) => void;
  onIdMapped?: () => void;
}

export default function ExcelMapping({
  onDataParsed,
  headers,
  rows,
  imageColumns,
  templateLayers,
  onUpdateLayers,
  onIdMapped
}: ExcelMappingProps) {
  const [loading, setLoading] = React.useState(false);
  const [errorStr, setErrorStr] = React.useState<string | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [loadedFileName, setLoadedFileName] = React.useState<string | null>(() => {
    return localStorage.getItem('excel_filename') || null;
  });

  const processFile = async (file: File) => {
    if (!file) return;
    setLoading(true);
    setErrorStr(null);
    try {
      const isCsv = file.name.toLowerCase().endsWith('.csv');
      const parsed = isCsv 
        ? await parseCsvProductFile(file)
        : await parseExcelProductFile(file);

      onDataParsed({
        headers: parsed.headers,
        rows: parsed.rows,
        imageColumns: parsed.imageColumns,
        sheetNames: parsed.sheetNames
      });
      setLoadedFileName(file.name);
      localStorage.setItem('excel_filename', file.name);
    } catch (err: any) {
      console.error(err);
      setErrorStr(err.message || 'Dosya okunurken hata oluştu. Lütfen dosya formatını kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col gap-6" id="excel-mapping-container">
      {/* File Dropzone area */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-4 ${
          dragActive
            ? 'border-indigo-600 bg-indigo-50/10'
            : loadedFileName
            ? 'border-emerald-500/50 bg-emerald-500/[0.02] hover:bg-slate-500/[0.01]'
            : 'border-slate-300 hover:border-indigo-500 hover:bg-slate-500/[0.01]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv"
          onChange={handleFileChange}
          className="hidden"
          id="excel-file-hidden-input"
        />

        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="h-10 w-10 text-indigo-500 animate-spin" />
            <p className="text-sm font-semibold text-slate-800">Dosya Okunuyor...</p>
            <p className="text-xs text-slate-500">Ürün verileri ayrıştırılıyor...</p>
          </div>
        ) : loadedFileName ? (
          <div className="flex flex-col items-center gap-1">
            <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 ring-4 ring-emerald-50">
              <Check className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-slate-850 mt-2">Dosya Başarıyla Ayrıştırıldı!</p>
            <p className="text-xs font-mono text-emerald-600 font-medium mb-1">{loadedFileName}</p>
            <p className="text-xs text-slate-500">Yeni bir dosya yüklemek için tıklayın veya sürükleyin</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center border border-indigo-100">
              <Upload className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800 mt-2">Excel (.xlsx) veya CSV (.csv) listenizi yükleyin</p>
            <p className="text-xs text-slate-500 max-w-md">
              Bilgisayarınızdan bir dosya sürükleyip bırakın veya seçin. Excel'deki gömülü ürün görselleri veya CSV'deki tüm ürün bilgileri otomatik olarak ayrıştırılacaktır.
            </p>
          </div>
        )}
      </div>

      {/* Error display */}
      {errorStr && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-2.5 text-xs">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Hata Oluştu:</span> {errorStr}
          </div>
        </div>
      )}

      {/* Column mapping controls */}
      {rows.length > 0 && templateLayers && onUpdateLayers && (
        <div className="bg-gradient-to-br from-indigo-50/70 to-indigo-100/30 border border-indigo-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="font-display font-bold text-slate-800 text-sm flex items-center gap-2">
              <Sliders className="h-4.5 w-4.5 text-indigo-600 animate-pulse" />
              Sütun Eşleştirme Sihirbazı
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Yüklediğiniz Excel veya CSV dosyasındaki benzersiz <strong>Ürün Kod / ID</strong> sütununu seçin.
              Doğru sütunu eşleştirerek görsel linklerinizin ve barkodlarınızın hatalı olmasını tamamen önleyebilirsiniz.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4 mt-2">
            {/* 1. PRODUCT ID / CODE COLUMN */}
            <div className="flex-1 flex flex-col gap-1.5 p-4 bg-white border border-slate-200/85 rounded-xl hover:border-indigo-200 transition-all max-w-xl">
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                Ürün Kod / ID Sütunu Seçin
              </label>
              <div className="relative mt-1">
                <select
                  value={templateLayers.find(l => l.id === 'layer-code')?.mappedColumn || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const updated = templateLayers.map(l => 
                      l.id === 'layer-code' ? { ...l, mappedColumn: val } : l
                    );
                    onUpdateLayers(updated);
                    // Automatic transition when changed/selected
                    if (val && onIdMapped) {
                      setTimeout(() => {
                        onIdMapped();
                      }, 200);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-250 hover:border-indigo-400 focus:border-indigo-500 text-xs rounded-lg py-2.5 px-3 pr-8 appearance-none focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-slate-800"
                >
                  <option value="">-- Sütun Seçin --</option>
                  {headers.map((h, i) => (
                    <option key={i} value={h}>{h}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-3.5 text-slate-400 pointer-events-none" />
              </div>
              <span className="text-[10px] text-indigo-600 font-medium mt-1">Barkod içeriği ve çıktı raporu ID alanı olarak kullanılır.</span>
            </div>

            {/* Proactive confirmation and step transition */}
            <div className="flex items-stretch">
              <button
                type="button"
                onClick={() => {
                  if (onIdMapped) onIdMapped();
                }}
                className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Check size={16} />
                Eşleşmeyi Onayla ve Tasarıma Geç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data preview dashboard */}
      {rows.length > 0 && (
        <div className="flex flex-col gap-4 border border-slate-200/80 rounded-2xl p-5 bg-white shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-display font-bold text-slate-800 text-sm flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-indigo-500" />
                Tablo Önizlemesi ({rows.length} Ürün Satırı)
              </h3>
              <p className="text-xs text-slate-500">Ürün verilerinden ilk birkaçı aşağıda gösterilmektedir.</p>
            </div>

            {/* Excel drawing count badge */}
            {imageColumns.length > 0 && (
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2.5 py-1 text-[11px] font-medium flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                {imageColumns.length} farklı sütunda resim algılandı
              </span>
            )}
          </div>

          {/* Core Table View */}
          <div className="overflow-x-auto max-h-[240px] rounded-xl border border-slate-150 scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 font-semibold sticky top-0 z-10">
                  <th className="py-2.5 px-4 w-12 text-center">No</th>
                  {headers.map((header, i) => {
                    // Highlight if it has images
                    const isImgCol = imageColumns.some(col => col.name === header);
                    return (
                      <th
                        key={i}
                        className={`py-2.5 px-4 font-semibold ${
                          isImgCol ? 'text-indigo-600 bg-indigo-50/20' : ''
                        }`}
                      >
                        {header}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {rows.slice(0, 5).map((row, rIdx) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-4 text-center font-mono text-slate-400 font-medium">
                      {row.rowNumber}
                    </td>
                    {headers.map((header, cIdx) => {
                      const textVal = row.values[header] || '';
                      const dataUrl = row.images[cIdx];
                      
                      return (
                        <td key={cIdx} className="py-2.5 px-4 font-sans max-w-[200px] truncate">
                          {dataUrl ? (
                            <div className="flex items-center gap-2">
                              <img
                                src={dataUrl}
                                alt="Excel Inline"
                                className="h-6 w-6 rounded border border-slate-200 object-cover shrink-0"
                              />
                              <span className="text-[10px] text-slate-400 font-mono">Görsel</span>
                            </div>
                          ) : (
                            <span title={textVal}>{textVal || <span className="text-slate-300 italic">Boş</span>}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {rows.length > 5 && (
            <div className="text-center text-[11px] text-slate-400 font-medium py-1 border-t border-slate-100">
              ...ve geriye kalan {rows.length - 5} ürün satırı yüklendi.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
