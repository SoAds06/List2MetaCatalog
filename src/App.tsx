/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { domToJpeg } from 'modern-screenshot';
import { CardTemplate, ExcelRow, CardLayer } from './types';
import { INITIAL_TEMPLATE } from './utils/presets';
import ExcelMapping from './components/ExcelMapping';
import TemplateDesigner from './components/TemplateDesigner';
import CardPreviewer from './components/CardPreviewer';
import { 
  FileSpreadsheet, 
  Layers, 
  Download, 
  ArrowRight, 
  ArrowLeft, 
  Play, 
  Check, 
  ChevronRight, 
  HelpCircle, 
  RefreshCw, 
  Loader2, 
  Image, 
  Info,
  ChevronLeft,
  FileDown,
  Cloud,
  CloudUpload,
  Copy,
  ExternalLink
} from 'lucide-react';

async function uploadToTemporaryHost(blob: Blob, filename: string): Promise<string> {
  const isImage = filename.toLowerCase().endsWith('.png') || 
                  filename.toLowerCase().endsWith('.jpg') || 
                  filename.toLowerCase().endsWith('.jpeg') || 
                  filename.toLowerCase().endsWith('.gif') ||
                  filename.toLowerCase().endsWith('.webp');

  // Option 1: ImgBB Secure Proxy via Express Server (Only for image assets)
  if (isImage) {
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const base64Data = await base64Promise;

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: base64Data,
          filename: filename
        })
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.url) {
          console.log(`Uploaded permanently to ImgBB: ${json.url}`);
          return json.url;
        }
      } else {
        const errJson = await response.json().catch(() => ({}));
        console.warn("ImgBB upload not configured or failed, falling back to temporary files storage.", errJson);
      }
    } catch (error) {
      console.error('Failed to upload via ImgBB proxy, falling back to temporary host...', error);
    }
  }

  // Option 2: tmpfiles.org
  try {
    const formData = new FormData();
    formData.append('file', blob, filename);
    const response = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      const json = await response.json();
      if (json.status === 'success' && json.data?.url) {
        // Replace viewer URL with direct link
        return json.data.url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
      }
    }
  } catch (error) {
    console.error('Failed to upload to tmpfiles.org, trying pixeldrain...', error);
  }

  // Option 3: pixeldrain.com (Allows cross-origin POST from browser and returns static direct links)
  try {
    const pixeldrainFormData = new FormData();
    pixeldrainFormData.append('file', blob, filename);
    const response = await fetch('https://pixeldrain.com/api/file', {
      method: 'POST',
      body: pixeldrainFormData
    });
    if (response.ok) {
      const json = await response.json();
      if (json.id) {
        return `https://pixeldrain.com/api/file/${json.id}`;
      }
    }
  } catch (err) {
    console.error('Pixeldrain upload failed, trying file.io...', err);
  }
  
  // Option 4: file.io (Backup)
  try {
    const fileIoFormData = new FormData();
    fileIoFormData.append('file', blob, filename);
    const response = await fetch('https://file.io', {
      method: 'POST',
      body: fileIoFormData
    });
    if (response.ok) {
      const json = await response.json();
      if (json.success && json.link) {
        return json.link;
      }
    }
  } catch (err) {
    console.error('Backup upload to file.io failed:', err);
  }

  return filename;
}

export default function App() {
  const [activeStep, setActiveStep] = useState<'upload' | 'design' | 'export'>('upload');
  
  // Real internet link mappings for dynamic embeddable image URLs
  const [uploadedImageUrls, setUploadedImageUrls] = useState<Record<number, string>>({});
  
  // Excel loaded state
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [imageColumns, setImageColumns] = useState<{ colIndex: number; name: string }[]>([]);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedIdColumn, setSelectedIdColumn] = useState<string>('');
  
  // Template State
  const [template, setTemplate] = useState<CardTemplate>(INITIAL_TEMPLATE);
  
  // User Preview States
  const [activeRowIndex, setActiveRowIndex] = useState<number>(0);
  
  // Bulk exporting states
  const [exportProgress, setExportProgress] = useState<{
    current: number;
    total: number;
    isExporting: boolean;
    currentRowName: string;
  }>({
    current: 0,
    total: 0,
    isExporting: false,
    currentRowName: ''
  });

  const [bulkExportActiveRow, setBulkExportActiveRow] = useState<ExcelRow | null>(null);
  const [exportImageScale, setExportImageScale] = useState<number>(1);

  // Quick Cloud Upload States (No Authentication Required)
  const [uploadedQuickUrl, setUploadedQuickUrl] = useState<string>('');
  const [isUploadingQuick, setIsUploadingQuick] = useState<boolean>(false);
  const [isImgBbConfigured, setIsImgBbConfigured] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.imgbbConfigured) {
          setIsImgBbConfigured(true);
        }
      })
      .catch(err => {
        console.error("Failed to query upload server configuration status:", err);
      });
  }, []);

  const handleQuickCloudUpload = async () => {
    if (rows.length === 0) {
      alert("Lütfen önce bir Excel veya CSV listesi yükleyin.");
      return;
    }

    setIsUploadingQuick(true);
    try {
      // 1. Determine key columns
      let codeCol = selectedIdColumn;
      if (!codeCol) {
        const codeLayer = template.layers.find(l => l.id === 'layer-code');
        codeCol = codeLayer?.mappedColumn || '';
      }
      if (!codeCol) {
        const firstCol = headers[2] || headers[0];
        codeCol = firstCol;
      }

      const titleLayer = template.layers.find(l => l.id === 'layer-title');
      const csvRows: string[] = [["id", "image_link"].join(';')];

      // Verify and upload any missing render-images first to have genuine HTTP URLs
      const updatedUrls = { ...uploadedImageUrls };
      const missingRows = rows.filter(r => !updatedUrls[r.rowNumber] || !updatedUrls[r.rowNumber].startsWith('http'));

      if (missingRows.length > 0) {
        setExportProgress({
          current: 0,
          total: rows.length,
          isExporting: true,
          currentRowName: 'Resimler çiziliyor ve bulut sunucularına aktarılıyor...'
        });

        for (let i = 0; i < rows.length; i++) {
          const rowItem = rows[i];
          if (updatedUrls[rowItem.rowNumber] && updatedUrls[rowItem.rowNumber].startsWith('http')) {
            continue;
          }

          setBulkExportActiveRow(rowItem);
          let labelName = `Kart_${rowItem.rowNumber}`;
          if (titleLayer && titleLayer.mappedColumn) {
            const textVal = rowItem.values[titleLayer.mappedColumn];
            if (textVal) {
              labelName = textVal.replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ\s-_]/g, '');
            }
          }

          setExportProgress(prev => ({
            ...prev,
            current: i + 1,
            currentRowName: `${labelName} çiziliyor ve buluta yükleniyor...`
          }));

          // Allow structural mount
          await new Promise(resolve => setTimeout(resolve, 350));

          const container = document.getElementById('high-fidelity-rendering-pane');
          if (container) {
            try {
              // Wait for layer resource loads
              const imgElements = Array.from(container.querySelectorAll('img'));
              await Promise.all(imgElements.map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise<void>(resolveImg => {
                  img.onload = () => resolveImg();
                  img.onerror = () => resolveImg();
                });
              }));

              const dataUrl = await domToJpeg(container, {
                width: template.widthPx,
                height: template.heightPx,
                scale: exportImageScale,
                backgroundColor: '#ffffff',
                quality: 0.95
              });

              const blobRes = await fetch(dataUrl);
              const blob = await blobRes.blob();

              const directUrl = await uploadToTemporaryHost(blob, `${labelName}.jpeg`);
              updatedUrls[rowItem.rowNumber] = directUrl;
            } catch (renderErr) {
              console.error(`Render fail on row ${rowItem.rowNumber}:`, renderErr);
              updatedUrls[rowItem.rowNumber] = `${labelName}.jpeg`;
            }
          } else {
            updatedUrls[rowItem.rowNumber] = `${labelName}.jpeg`;
          }
        }

        setUploadedImageUrls(updatedUrls);
        setExportProgress({ current: 0, total: 0, isExporting: false, currentRowName: '' });
        setBulkExportActiveRow(null);
      }

      // Format CSV content
      for (const rowItem of rows) {
        const idVal = rowItem.values[codeCol] || `SATIR_${rowItem.rowNumber}`;
        let labelName = `Kart_${rowItem.rowNumber}`;
        if (titleLayer && titleLayer.mappedColumn) {
          const textVal = rowItem.values[titleLayer.mappedColumn];
          if (textVal) {
            labelName = textVal.replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ\s-_]/g, '');
          }
        }
        const imageUrl = updatedUrls[rowItem.rowNumber] || `${labelName}.jpeg`;
        const escapedId = idVal.replace(/"/g, '""');
        const escapedImageUrl = imageUrl.replace(/"/g, '""');
        csvRows.push(`"${escapedId}";"${escapedImageUrl}"`);
      }

      // Turkish localized characters with proper BOM mark inside the temporary cloud host
      const csvStr = "\uFEFF" + csvRows.join("\r\n");
      const csvBlob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });

      const csvCloudUrl = await uploadToTemporaryHost(csvBlob, `urun_gorsel_eslestirme_${Date.now()}.csv`);
      setUploadedQuickUrl(csvCloudUrl);
      alert("Eşleştirme CSV dosyanız başarıyla buluta yüklendi ve paylaşılabilir link oluşturuldu!");
    } catch (uploadErr: any) {
      console.error(uploadErr);
      alert(`Bulut Yükleme İşlemi Başarısız:\n${uploadErr.message || uploadErr}`);
    } finally {
      setIsUploadingQuick(false);
    }
  };

  // Auto-configure layer mapping when a new Excel sheet is uploaded
  const handleDataParsed = (data: {
    headers: string[];
    rows: ExcelRow[];
    imageColumns: { colIndex: number; name: string }[];
    sheetNames: string[];
  }) => {
    setHeaders(data.headers);
    setRows(data.rows);
    setImageColumns(data.imageColumns);
    setSheetNames(data.sheetNames);
    setActiveRowIndex(0);

    // Dynamic smart matching: map layer mapping coordinates directly to matching headers
    const normalizedHeaders = data.headers.map(h => h.toLowerCase().trim());
    
    const updatedLayers = template.layers.map(layer => {
      if (layer.type === 'shape') {
        return layer;
      }
      let mappedCol = layer.mappedColumn;
      
      if (layer.type === 'image') {
        const matchIdx = normalizedHeaders.findIndex(h => 
          h.includes('resim') || h.includes('görsel') || h.includes('gorsel') || h.includes('image') || h.includes('url') || h.includes('link') || h.includes('foto') || h.includes('img') || h.includes('photo') || h.includes('picture')
        );
        if (matchIdx !== -1) {
          mappedCol = data.headers[matchIdx];
        } else {
          // If no matching headers, check cell contents of each column to see if they look like URLs
          let foundColInCells = '';
          for (const h of data.headers) {
            const hasUrl = data.rows.some(row => {
              const val = (row.values[h] || '').trim().toLowerCase();
              return val.startsWith('http://') || val.startsWith('https://') || val.match(/\.(jpeg|jpg|png|gif|webp)/i);
            });
            if (hasUrl) {
              foundColInCells = h;
              break;
            }
          }
          if (foundColInCells) {
            mappedCol = foundColInCells;
          } else {
            mappedCol = ''; // Default empty if no image URL found, allowing manual choice
          }
        }
      } else {
        // Try exact text matches
        if (layer.id === 'layer-title') {
          const matchIdx = normalizedHeaders.findIndex(h => 
            h.includes('ad') || h.includes('isim') || h.includes('başlık') || h.includes('title') || h.includes('ürün')
          );
          if (matchIdx !== -1) mappedCol = data.headers[matchIdx];
        } else if (layer.id === 'layer-price') {
          const matchIdx = normalizedHeaders.findIndex(h => 
            h.includes('fiyat') || h.includes('price') || h.includes('tutar') || h.includes('ücret')
          );
          if (matchIdx !== -1) mappedCol = data.headers[matchIdx];
        } else if (layer.id === 'layer-code') {
          const matchIdx = normalizedHeaders.findIndex(h => 
            h.includes('kod') || h.includes('barkod') || h.includes('barcode') || h.includes('sku') || h.includes('no')
          );
          if (matchIdx !== -1) mappedCol = data.headers[matchIdx];
        }
      }

      // Fallback
      if (!mappedCol && data.headers.length > 0) {
        mappedCol = data.headers[0];
      }

      return {
        ...layer,
        mappedColumn: mappedCol
      };
    });

    setTemplate(prev => ({
      ...prev,
      layers: updatedLayers
    }));

    // Detect and initialize selectedIdColumn state on file load
    const initialCodeLayer = updatedLayers.find(l => l.id === 'layer-code');
    if (initialCodeLayer && initialCodeLayer.mappedColumn) {
      setSelectedIdColumn(initialCodeLayer.mappedColumn);
    } else if (data.headers.length > 0) {
      setSelectedIdColumn(data.headers[0]);
    }
  };

  const activeRow = rows.length > 0 ? rows[activeRowIndex] : null;

  // Single card download engine using high precision html2canvas rendering
  const downloadSingleCard = async (row: ExcelRow, customFilename?: string) => {
    // We target the high fidelity scale-1 static render element
    const container = document.getElementById('high-fidelity-rendering-pane');
    if (!container) {
      alert("Hata: Çıktı motoru hazırlanamadı.");
      return;
    }

    try {
      // Small pause to let image layers load properly in the DOM
      await new Promise(resolve => setTimeout(resolve, 100));

      // Wait for all dynamic images (including proxied background/foreground layers) to fully load in the pane
      const imgElements = Array.from(container.querySelectorAll('img'));
      await Promise.all(imgElements.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>(resolveImg => {
          img.onload = () => resolveImg();
          img.onerror = () => resolveImg();
        });
      }));

      const dataUrl = await domToJpeg(container, {
        width: template.widthPx,
        height: template.heightPx,
        scale: exportImageScale,
        backgroundColor: '#ffffff',
        quality: 0.95
      });
      const downloadLink = document.createElement('a');

      let cleanedName = customFilename;
      if (!cleanedName) {
        cleanedName = `Kart_Satır_${row.rowNumber}`;
        const titleLayer = template.layers.find(l => l.id === 'layer-title');
        if (titleLayer && titleLayer.mappedColumn) {
          const rawVal = row.values[titleLayer.mappedColumn];
          if (rawVal) {
            cleanedName = rawVal.replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ\s-_]/g, '');
          }
        }
      }

      downloadLink.download = `${cleanedName}.jpeg`;
      downloadLink.href = dataUrl;
      downloadLink.click();
    } catch (err) {
      console.error(err);
      alert("JPEG dışa aktarma hatası oluştu.");
    }
  };

  // Bulk downloader sequential loop with interactive progress bar
  const triggerBulkExport = async () => {
    if (rows.length === 0) return;
    
    setExportProgress({
      current: 0,
      total: rows.length,
      isExporting: true,
      currentRowName: ''
    });

    for (let i = 0; i < rows.length; i++) {
      const rowItem = rows[i];
      setBulkExportActiveRow(rowItem);
      
      // Determine printable name
      let labelName = `Kart_${rowItem.rowNumber}`;
      const titleLayer = template.layers.find(l => l.id === 'layer-title');
      if (titleLayer && titleLayer.mappedColumn) {
        const textVal = rowItem.values[titleLayer.mappedColumn];
        if (textVal) {
          labelName = textVal.replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ\s-_]/g, '');
        }
      }

      setExportProgress(prev => ({
        ...prev,
        current: i + 1,
        currentRowName: labelName
      }));

      // Let DOM reparent & images render
      await new Promise(resolve => setTimeout(resolve, 350));

      // Trigger standard save
      await downloadSingleCard(rowItem, labelName);

      // Throttling delay to avoid blocking modern browser download queues
      await new Promise(resolve => setTimeout(resolve, 600));
    }

    setExportProgress(prev => ({
      ...prev,
      isExporting: false,
      currentRowName: 'Tamamlandı!'
    }));
    setBulkExportActiveRow(null);
  };

  // ZIP Bulk Downloader to download everything inside a single compressed ZIP file 🚀
  const triggerBulkZipExport = async () => {
    if (rows.length === 0) return;
    
    setExportProgress({
      current: 0,
      total: rows.length,
      isExporting: true,
      currentRowName: 'ZIP Hazırlanıyor...'
    });

    const zip = new JSZip();
    const updatedUrls = { ...uploadedImageUrls };

    for (let i = 0; i < rows.length; i++) {
      const rowItem = rows[i];
      setBulkExportActiveRow(rowItem);
      
      // Determine file name
      let labelName = `Kart_${rowItem.rowNumber}`;
      const titleLayer = template.layers.find(l => l.id === 'layer-title');
      if (titleLayer && titleLayer.mappedColumn) {
        const textVal = rowItem.values[titleLayer.mappedColumn];
        if (textVal) {
          labelName = textVal.replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ\s-_]/g, '');
        }
      }

      setExportProgress(prev => ({
        ...prev,
        current: i + 1,
        currentRowName: `${labelName} çiziliyor...`
      }));

      // Let DOM reparent & images render
      await new Promise(resolve => setTimeout(resolve, 350));

      const container = document.getElementById('high-fidelity-rendering-pane');
      if (container) {
        try {
          // Wait for all dynamic images (including proxied background/foreground layers) to fully load in the pane
          const imgElements = Array.from(container.querySelectorAll('img'));
          await Promise.all(imgElements.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise<void>(resolveImg => {
              img.onload = () => resolveImg();
              img.onerror = () => resolveImg();
            });
          }));

          const dataUrl = await domToJpeg(container, {
            width: template.widthPx,
            height: template.heightPx,
            scale: exportImageScale,
            backgroundColor: '#ffffff',
            quality: 0.95
          });
          
          const blobRes = await fetch(dataUrl);
          const blob = await blobRes.blob();
          
          zip.file(`${labelName}.jpeg`, blob);

          setExportProgress(prev => ({
            ...prev,
            currentRowName: `${labelName} internete yükleniyor (gömülebilir link oluşturuluyor)`
          }));

          // Upload image to host to get custom embeddable link
          let onlineUrl = `${labelName}.jpeg`;
          try {
            const uploadedUrl = await uploadToTemporaryHost(blob, `${labelName}.jpeg`);
            if (uploadedUrl && uploadedUrl !== `${labelName}.jpeg`) {
              onlineUrl = uploadedUrl;
            }
          } catch (uploadErr) {
            console.error('Görsel internete yüklenemedi:', uploadErr);
          }

          updatedUrls[rowItem.rowNumber] = onlineUrl;

        } catch (cardErr) {
          console.error(`Kart çizim hatası (Satır ${rowItem.rowNumber}):`, cardErr);
          updatedUrls[rowItem.rowNumber] = `${labelName}.jpeg`;
        }
      }
    }

    setUploadedImageUrls(updatedUrls);

    // Generate product id to image filename mapping inside `.csv` file! 📊
    try {
      let codeCol = selectedIdColumn;
      if (!codeCol) {
        const codeLayer = template.layers.find(l => l.id === 'layer-code');
        codeCol = codeLayer?.mappedColumn || '';
      }
      if (!codeCol) {
        const lowerHeaders = headers.map(h => h.toLowerCase().trim());
        const matchIdx = lowerHeaders.findIndex(h => 
          h.includes('kod') || h.includes('id') || h.includes('sku') || h.includes('barkod') || h.includes('barcode') || h.includes('no')
        );
        if (matchIdx !== -1) {
          codeCol = headers[matchIdx];
        } else {
          codeCol = headers[0];
        }
      }

      const csvRows = [["id", "image_link"].join(';')];
      for (const rowItem of rows) {
        const rawVal = codeCol ? rowItem.values[codeCol] : '';
        const idVal = rawVal ? rawVal.toString().trim() : `Kart_${rowItem.rowNumber}`;

        let labelName = `Kart_${rowItem.rowNumber}`;
        const titleLayer = template.layers.find(l => l.id === 'layer-title');
        if (titleLayer && titleLayer.mappedColumn) {
          const textVal = rowItem.values[titleLayer.mappedColumn];
          if (textVal) {
            labelName = textVal.replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ\s-_]/g, '');
          }
        }
        const filename = updatedUrls[rowItem.rowNumber] || `${labelName}.jpeg`;
        
        const escapedId = idVal.replace(/"/g, '""');
        const escapedFilename = filename.replace(/"/g, '""');
        csvRows.push(`"${escapedId}";"${escapedFilename}"`);
      }

      const csvContent = "\uFEFF" + csvRows.join("\r\n");
      zip.file("urun_gorsel_eslestirme.csv", csvContent);
    } catch (csvGenErr) {
      console.error('Bütünleşik CSV ekleme hatası:', csvGenErr);
    }

    setExportProgress(prev => ({
      ...prev,
      currentRowName: 'ZIP dosyası sıkıştırılıyor...'
    }));

    try {
      const zipContent = await zip.generateAsync({ type: 'blob' });
      const downloadLink = document.createElement('a');
      downloadLink.download = `Tum_Urun_Kartlari_${Date.now()}.zip`;
      downloadLink.href = URL.createObjectURL(zipContent);
      downloadLink.click();
      
      setTimeout(() => {
        URL.revokeObjectURL(downloadLink.href);
      }, 5000);
    } catch (zipErr) {
      console.error('ZIP sıkıştırma hatası:', zipErr);
      alert('ZIP dosyası oluşturulurken bir sıkıştırma hatası meydana geldi.');
    } finally {
      setExportProgress({
        current: 0,
        total: 0,
        isExporting: false,
        currentRowName: ''
      });
      setBulkExportActiveRow(null);
    }
  };

  // Internal helper to create and trigger download for custom real-link CSV
  const generateAndDownloadCsv = (urlsMap: Record<number, string>) => {
    let codeCol = selectedIdColumn;
    if (!codeCol) {
      const codeLayer = template.layers.find(l => l.id === 'layer-code');
      codeCol = codeLayer?.mappedColumn || '';
    }
    if (!codeCol) {
      const lowerHeaders = headers.map(h => h.toLowerCase().trim());
      const matchIdx = lowerHeaders.findIndex(h => 
        h.includes('kod') || h.includes('id') || h.includes('sku') || h.includes('barkod') || h.includes('barcode') || h.includes('no')
      );
      if (matchIdx !== -1) {
        codeCol = headers[matchIdx];
      } else {
        codeCol = headers[0];
      }
    }

    const csvRows = [["id", "image_link"].join(';')];
    for (const rowItem of rows) {
      const rawVal = codeCol ? rowItem.values[codeCol] : '';
      const idVal = rawVal ? rawVal.toString().trim() : `Kart_${rowItem.rowNumber}`;

      let labelName = `Kart_${rowItem.rowNumber}`;
      const titleLayer = template.layers.find(l => l.id === 'layer-title');
      if (titleLayer && titleLayer.mappedColumn) {
        const textVal = rowItem.values[titleLayer.mappedColumn];
        if (textVal) {
          labelName = textVal.replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ\s-_]/g, '');
        }
      }

      const imageUrl = urlsMap[rowItem.rowNumber] || `${labelName}.jpeg`;
      
      const escapedId = idVal.replace(/"/g, '""');
      const escapedImageUrl = imageUrl.replace(/"/g, '""');
      csvRows.push(`"${escapedId}";"${escapedImageUrl}"`);
    }

    const csvContent = "\uFEFF" + csvRows.join("\r\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const downloadLink = document.createElement('a');
    downloadLink.download = `urun_gorsel_eslestirme_${Date.now()}.csv`;
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.click();
    setTimeout(() => {
      URL.revokeObjectURL(downloadLink.href);
    }, 5000);
  };

  // Standalone function to download CSV map of excel-code/sku -> system-generated image filename
  const downloadCsvDirectly = async () => {
    if (rows.length === 0) return;

    // Check if we need to render and upload any newly uploaded sheet data or if keys are fallback filenames (do not start with http)
    const missingRows = rows.filter(r => !uploadedImageUrls[r.rowNumber] || !uploadedImageUrls[r.rowNumber].startsWith('http'));

    if (missingRows.length > 0) {
      // Show progress/loader state and automatically start uploading to provide seamless user experience
      setExportProgress({
        current: 0,
        total: rows.length,
        isExporting: true,
        currentRowName: 'Gömülebilir doğrudan resim linkleri üretiliyor...'
      });

      const updatedUrls = { ...uploadedImageUrls };

      for (let i = 0; i < rows.length; i++) {
        const rowItem = rows[i];
        
        // If it already has a valid HTTP link, do not re-upload to save resources and speed up the process
        if (updatedUrls[rowItem.rowNumber] && updatedUrls[rowItem.rowNumber].startsWith('http')) {
          continue;
        }

        setBulkExportActiveRow(rowItem);
        let labelName = `Kart_${rowItem.rowNumber}`;
        const titleLayer = template.layers.find(l => l.id === 'layer-title');
        if (titleLayer && titleLayer.mappedColumn) {
          const textVal = rowItem.values[titleLayer.mappedColumn];
          if (textVal) {
            labelName = textVal.replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ\s-_]/g, '');
          }
        }

        setExportProgress(prev => ({
          ...prev,
          current: i + 1,
          currentRowName: `${labelName} çiziliyor ve internete yükleniyor...`
        }));

        // Let DOM reparent & images render
        await new Promise(resolve => setTimeout(resolve, 350));

        const container = document.getElementById('high-fidelity-rendering-pane');
        if (container) {
          try {
            // Wait for all dynamic images (including proxied background/foreground layers) to fully load in the pane
            const imgElements = Array.from(container.querySelectorAll('img'));
            await Promise.all(imgElements.map(img => {
              if (img.complete) return Promise.resolve();
              return new Promise<void>(resolveImg => {
                img.onload = () => resolveImg();
                img.onerror = () => resolveImg();
              });
            }));

            const dataUrl = await domToJpeg(container, {
              width: template.widthPx,
              height: template.heightPx,
              scale: exportImageScale,
              backgroundColor: '#ffffff',
              quality: 0.95
            });
            
            const blobRes = await fetch(dataUrl);
            const blob = await blobRes.blob();

            const directUrl = await uploadToTemporaryHost(blob, `${labelName}.jpeg`);
            updatedUrls[rowItem.rowNumber] = directUrl;

          } catch (cardErr) {
            console.error(`Kart çizim/yükleme hatası (Satır ${rowItem.rowNumber}):`, cardErr);
            updatedUrls[rowItem.rowNumber] = `${labelName}.jpeg`; // fallback
          }
        } else {
          updatedUrls[rowItem.rowNumber] = `${labelName}.jpeg`; // fallback
        }
      }

      setUploadedImageUrls(updatedUrls);
      
      setExportProgress({
        current: 0,
        total: 0,
        isExporting: false,
        currentRowName: ''
      });
      setBulkExportActiveRow(null);

      // now build the CSV with these updated URLs!
      generateAndDownloadCsv(updatedUrls);
    } else {
      generateAndDownloadCsv(uploadedImageUrls);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col selection:bg-orange-600 selection:text-white antialiased">
      
      {/* Premium Gradient bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 via-amber-500 to-rose-500 shrink-0"></div>

      {/* Main Core View Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 flex flex-col gap-6">

        {/* Dynamic Nav Header */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl overflow-hidden shadow-lg shadow-orange-600/10 flex items-center justify-center bg-white border border-slate-100 shrink-0">
              <img src="https://sihirlioltagate.blob.core.windows.net/products/ChatGPT%20Image%2022%20Haz%202026%2015_31_56.png" alt="ListoCat Logo" className="h-full w-full object-cover" />
            </div>
            <div>
              <h1 id="app-title-header" className="text-xl font-display font-bold text-slate-850 flex items-center gap-2">
                ListoCat
                <span className="text-[10px] px-2 py-0.5 bg-orange-50 text-orange-600 font-semibold rounded-full border border-orange-200">v1.0</span>
              </h1>
              <p className="text-xs text-slate-500">Excel verilerini ve ürün resimlerini akıllıca görsellerle birleştirerek toplu yeni kartlar üretin.</p>
            </div>
          </div>

          {/* Stepper Wizard Indicator */}
          <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm text-xs font-semibold">
            <button
              onClick={() => setActiveStep('upload')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                activeStep === 'upload'
                  ? 'bg-orange-600 text-white shadow-sm shadow-orange-600/10'
                  : 'text-slate-600 hover:text-orange-600 hover:bg-slate-50 bg-transparent'
              }`}
            >
              <FileSpreadsheet size={13} />
              <span>1. Excel Yükleme</span>
            </button>
            <ChevronRight size={12} className="text-slate-300" />
            <button
              onClick={() => {
                if (rows.length > 0) setActiveStep('design');
              }}
              disabled={rows.length === 0}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                activeStep === 'design'
                  ? 'bg-orange-600 text-white shadow-sm shadow-orange-600/10'
                  : 'text-slate-600 hover:text-orange-600 hover:bg-slate-50 bg-transparent'
              }`}
            >
              <Layers size={13} />
              <span>2. Şablon & Alan Hizalama</span>
            </button>
            <ChevronRight size={12} className="text-slate-300" />
            <button
              onClick={() => {
                if (rows.length > 0) setActiveStep('export');
              }}
              disabled={rows.length === 0}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                activeStep === 'export'
                  ? 'bg-orange-600 text-white shadow-sm shadow-orange-600/10'
                  : 'text-slate-600 hover:text-orange-600 hover:bg-slate-50 bg-transparent'
              }`}
            >
              <Download size={13} />
              <span>3. Önizleme & Toplu İndirme</span>
            </button>
          </div>
        </header>

        {/* Dynamic Context Step Router */}
        <div className="flex-1">
          {activeStep === 'upload' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start animate-fade-in">
              <div className="md:col-span-8 flex flex-col gap-6">
                <ExcelMapping
                  onDataParsed={handleDataParsed}
                  headers={headers}
                  rows={rows}
                  imageColumns={imageColumns}
                  templateLayers={template.layers}
                  onUpdateLayers={(updatedLayers) => {
                    setTemplate(prev => ({
                      ...prev,
                      layers: updatedLayers
                    }));
                    const codeLayer = updatedLayers.find(l => l.id === 'layer-code');
                    if (codeLayer && codeLayer.mappedColumn) {
                      setSelectedIdColumn(codeLayer.mappedColumn);
                    }
                  }}
                  onIdMapped={() => setActiveStep('design')}
                />
              </div>

              {/* Informative Help Guide Card */}
              <div className="md:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4 text-xs text-slate-600 leading-relaxed">
                {/* App Brand Presentation */}
                <div className="flex flex-col items-center text-center pb-4 border-b border-slate-100 gap-2">
                  <div className="h-20 w-20 rounded-2xl overflow-hidden shadow-md border border-slate-100 bg-white">
                    <img 
                      src="https://sihirlioltagate.blob.core.windows.net/products/ChatGPT%20Image%2022%20Haz%202026%2015_31_56.png" 
                      alt="ListoCat Logo" 
                      className="h-full w-full object-cover" 
                    />
                  </div>
                  <div>
                    <h2 className="text-lg font-display font-bold text-slate-800">ListoCat</h2>
                    <p className="text-slate-400 text-[10px] tracking-wider uppercase font-medium">Etiket & Reklam Görseli Oluşturucu</p>
                  </div>
                </div>

                <h3 className="font-display font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <Info size={15} className="text-orange-500" />
                  Nasıl Çalışır?
                </h3>
                <ol className="list-decimal pl-4 space-y-2 text-slate-600">
                  <li>Önce ürün bilgilerinizin (Görseller dahil) bulunduğu Excel (.xlsx) listenizi sol panele yükleyin.</li>
                  <li>Sistem, sütunlardaki resim ve görsel URL'lerini otomatik olarak analiz edecek ve etiketlerle eşleştirecektir.</li>
                  <li>Ardından tasarım sekmesinde, sürükle-bırak yöntemiyle görsel şablonunuzun üzerine ürün adını, fiyatını ve resmini konumlandırın.</li>
                  <li>Her ürünü tek tek gözden geçirip dilediğiniz gibi düzenleyerek şık JPEG formatında toplu indirin.</li>
                </ol>
                <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-3 text-amber-800 mt-2">
                  <span className="font-semibold">İpucu:</span> Excel sütununuzda resimlerin internet adresleri (HTTP/HTTPS linkleri) bulunuyorsa sistem bu görselleri otomatik olarak etiket şablonunuza yükleyecektir!
                </div>
              </div>
            </div>
          )}

          {activeStep === 'design' && (
            <div className="animate-fade-in flex flex-col gap-5">
              
              {/* Back & Forward Action row */}
              <div className="flex justify-between items-center rounded-xl bg-slate-100 p-3 border border-slate-200">
                <button
                  onClick={() => setActiveStep('upload')}
                  className="px-3.5 py-1.5 bg-white text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold border border-slate-200 flex items-center gap-1 cursor-pointer transition"
                >
                  <ArrowLeft size={13} />
                  Excel Yükleme Adımına Dön
                </button>
                <button
                  onClick={() => setActiveStep('export')}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-550 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition shadow-lg shadow-orange-600/10"
                >
                  Konumlandırmayı Kaydet ve İleri Git
                  <ArrowRight size={13} />
                </button>
              </div>

              <TemplateDesigner
                template={template}
                onUpdateTemplate={setTemplate}
                excelHeaders={headers}
                activeRow={activeRow}
                imageColumns={imageColumns}
              />
            </div>
          )}

          {activeStep === 'export' && (
            <div className="flex flex-col gap-8 animate-fade-in">
              {/* TOP WORKSTATION: Custom Display/Review Panel focused entirely on 1080x1080 precision */}
              <div className="w-full flex flex-col items-center gap-5 bg-slate-100 border border-slate-200 rounded-3xl p-6 shadow-sm" id="view-visualizer-panel">
                <div className="flex flex-col items-center text-center gap-1">
                  <span className="text-xs font-bold text-orange-600 uppercase tracking-widest">Süper Hassas Kart Önizleme Paneli</span>
                  <div className="text-[11px] bg-slate-200 text-slate-800 px-3 py-1 rounded-full font-bold">
                    Orijinal Çözünürlük: {template.widthPx} x {template.heightPx} Px
                  </div>
                </div>
                
                {/* Dynamically scaled view maintaining aspect-ratio precision of 1080x1080 */}
                <div 
                  className="border-8 border-white bg-slate-950 p-1.5 rounded-[24px] shadow-2xl overflow-hidden relative"
                  style={{
                    width: `${template.widthPx * 0.40 + 4}px`,
                    height: `${template.heightPx * 0.40 + 4}px`
                  }}
                >
                  <CardPreviewer
                    template={template}
                    activeRow={activeRow}
                    activeLayerId={null}
                    scale={0.40} // Fit beautifully while keeping 1:1 pixel grid mapping
                    renderMode="display"
                  />
                </div>

                <div className="flex flex-col gap-1.5 w-full mt-1 text-center text-xs text-slate-500 items-center">
                  <p className="font-semibold text-slate-700 text-sm">
                    {activeRow ? `${activeRowIndex + 1} / ${rows.length} Numaralı Kart Gösteriliyor` : "Lütfen incelemek istediğiniz satırı seçin."}
                  </p>
                  <p className="text-[10px] text-slate-400 leading-relaxed max-w-xl">
                    Sistem <strong>1080x1080 pixel</strong> yüksek kaliteli çıktı motoruna sahiptir. "Tek İndir" butonuna bastığınızda, bu kartın orijinal çözünürlüğündeki halini JPEG olarak elde edersiniz.
                  </p>
                </div>
              </div>

              {/* BOTTOM COLUMNS: Centralized Bulk generator and interactive datasheet list */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* LEFT 5 COLUMNS: Bulk download console */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center gap-4">
                        <h3 className="font-display font-bold text-slate-800 text-sm">Toplu JPEG Üretim Merkezi</h3>
                        <button
                          onClick={() => setActiveStep('design')}
                          className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-700 transition cursor-pointer"
                        >
                          Tasarımı Düzenle
                        </button>
                      </div>
                      <p className="text-xs text-slate-500">Tasarımınızı tüm ürünler ile eş zamanlı teste dökün ve indirin.</p>
                    </div>

                    <div className="flex flex-col gap-5 border-t border-slate-100 pt-4">
                      <div className="flex flex-col gap-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">Görsel Çözünürlük Çarpanı</span>
                        <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-150 text-xs font-semibold w-fit">
                          <button
                            onClick={() => setExportImageScale(1)}
                            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                              exportImageScale === 1
                                ? 'bg-white text-orange-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            1x (1080x1080 Px)
                          </button>
                          <button
                            onClick={() => setExportImageScale(2)}
                            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                              exportImageScale === 2
                                ? 'bg-white text-orange-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            2x (2160x2160 Px - Ultra Net 🚀)
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 italic">
                          * {exportImageScale === 1 ? '1x modunda görsel tam olarak 1080x1080 kaydedilir.' : '2x modunda ultra kaliteli netlik için 2160x2160 px olarak kaydedilir.'}
                        </p>
                      </div>

                      <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-4">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">Toplu İndirme Yöntemleri</span>
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={triggerBulkZipExport}
                            className="w-full justify-center px-4 py-2.5 bg-orange-600 hover:bg-orange-550 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-orange-600/15 cursor-pointer"
                          >
                            <Download size={14} />
                            Tümünü .ZIP Olarak İndir (Önerilen 🚀)
                          </button>
                          <button
                            onClick={triggerBulkExport}
                            className="w-full justify-center px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <FileDown size={14} />
                            Tek Tek JPEG İndir
                          </button>
                          <button
                            onClick={downloadCsvDirectly}
                            className="w-full justify-center px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                            id="download-matching-csv-btn"
                          >
                            <FileSpreadsheet size={14} className="text-emerald-600" />
                            Eşleştirme CSV'sini İndir (.csv)
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed mt-2.5">
                          * <strong>.ZIP Paketi içerisine</strong> tüm JPEG görselleri ile birlikte <strong>id;image_link</strong> sütunlarını içeren aradığınız <strong>urun_gorsel_eslestirme.csv</strong> dosyası otomatik olarak eklenir. Sol panelden veya yukarıdaki butondan bağımsız olarak da ayrıca indirebilirsiniz.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Hızlı Bulut Eşleştirme Paylaşımı (Token'sız & Tek Tık) */}
                  <div className="bg-gradient-to-br from-orange-50/60 to-white border border-orange-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center gap-2 flex-wrap">
                        <h3 className="font-display font-bold text-orange-950 text-sm flex items-center gap-2">
                          <CloudUpload size={18} className="text-orange-600 animate-pulse" />
                          Hızlı Bulut Paylaşımı (Önerilen)
                        </h3>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isImgBbConfigured ? (
                            <span className="text-[9px] px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full uppercase tracking-wider border border-emerald-300 flex items-center gap-1">
                              <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                              ImgBB (Kalıcı) Aktif
                            </span>
                          ) : (
                            <span className="text-[9px] px-2 py-0.5 bg-amber-50 text-amber-800 font-bold rounded-full uppercase tracking-wider border border-amber-200" title="Ortam değişkenlerine IMGBB_API_KEY ekleyerek kalıcı depolamaya geçebilirsiniz">
                              ImgBB Kurulabilir (Geçici Mod)
                            </span>
                          )}
                          <span className="text-[9px] px-2 py-0.5 bg-orange-600 text-white font-bold rounded-full uppercase tracking-wider">
                            SIFIR KURULUM
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-orange-850 leading-relaxed">
                        {isImgBbConfigured ? (
                          <span>Görselleriniz kesintisiz şekilde kendi <strong>ImgBB</strong> hesabınızda kalıcı olarak saklanır ve paylaşılabilir link üretilir.</span>
                        ) : (
                          <span>Token veya kayıt gerektirmeden resimli eşleştirme tablonuzu buluta yükleyin ve paylaşılabilir link üretin. (Görsellerin silinmemesi için secrets paneline <strong>IMGBB_API_KEY</strong> ekleyin.)</span>
                        )}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3">
                      {/* Action Button */}
                      <button
                        onClick={handleQuickCloudUpload}
                        disabled={isUploadingQuick}
                        className={`w-full justify-center px-4 py-2.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer select-none ${
                          isUploadingQuick
                            ? 'bg-orange-200 text-orange-600 border border-orange-300 cursor-not-allowed'
                            : 'bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-600/15'
                        }`}
                        id="upload-quick-cloud-btn"
                      >
                        {isUploadingQuick ? (
                          <>
                            <div className="h-3 w-3 border-2 border-orange-400 border-t-orange-850 rounded-full animate-spin"></div>
                            <span>Buluta Yükleniyor...</span>
                          </>
                        ) : (
                          <>
                            <CloudUpload size={14} />
                            <span>Tek Tıkla Buluta Yükle ve Paylaş</span>
                          </>
                        )}
                      </button>

                      {/* Public Copyable URL Output Box */}
                      {uploadedQuickUrl && (
                        <div className="p-3 bg-white border border-orange-150 rounded-xl flex flex-col gap-2 animate-fade-in" id="quick-cloud-success-card">
                          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                            🎉 Herkese Açık Paylaşılabilir Dosya Linki
                          </span>
                          <div className="flex gap-1.5 items-center">
                            <input
                              type="text"
                              readOnly
                              value={uploadedQuickUrl}
                              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs w-full font-mono text-orange-700 select-all focus:outline-none font-semibold"
                              id="quick-cloud-output-copyable-link"
                            />
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(uploadedQuickUrl);
                                alert("Bulut linki kopyalandı!");
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shrink-0 cursor-pointer border-none"
                              title="Linki Kopyala"
                            >
                              <Copy size={13} />
                              Kopyala
                            </button>
                            <a
                              href={uploadedQuickUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center transition shrink-0"
                              title="Dosyayı Gör / İndir"
                            >
                              <ExternalLink size={13} />
                            </a>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-relaxed">
                            CSV dosyanız güvenli geçici internet sunucusuna başarıyla aktarıldı. Bu bağlantıyı doğrudan diğer programlarda veya paylaşımda kullanabilirsiniz!
                          </p>
                        </div>
                      )}
                    </div>
                  </div>


                </div>

                {/* RIGHT 7 COLUMNS: Database Table Navigator Row list */}
                <div className="lg:col-span-7 flex flex-col gap-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Tekil Kart Gözden Geçirme & İndirme
                    </span>
                    
                    <div className="overflow-y-auto max-h-[460px] border border-slate-150 rounded-xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 font-semibold sticky top-0 z-10">
                            <th className="py-2 px-3 w-10 text-center"></th>
                            <th className="py-2 px-3">Görsel</th>
                            <th className="py-2 px-3">Ürün İsim / Detay</th>
                            <th className="py-2 px-3">Fiyat</th>
                            <th className="py-2 px-3 text-right">Eylemler</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {rows.map((row, idx) => {
                            const isSelected = activeRowIndex === idx;
                            
                            // Look for columns mapping title and price to display nicely in the row item
                            const titleCol = template.layers.find(l => l.id === 'layer-title')?.mappedColumn || headers[0];
                            const priceCol = template.layers.find(l => l.id === 'layer-price')?.mappedColumn || headers[1];
                            const codeCol = selectedIdColumn || template.layers.find(l => l.id === 'layer-code')?.mappedColumn || headers[2];
                            
                            // Look for any image matching this row to show miniature (including embedded or template-mapped text URLs or scanned URLs)
                            let firstAvailableImg = Object.values(row.images)[0] || '';
                            
                            if (!firstAvailableImg) {
                              // Scan template image layers for mapped columns containing images
                              const imageLayers = template.layers.filter(l => l.type === 'image');
                              for (const layer of imageLayers) {
                                if (layer.mappedColumn) {
                                  if (layer.mappedColumn.startsWith('__excel_image_col_')) {
                                    const colIdx = parseInt(layer.mappedColumn.replace('__excel_image_col_', ''));
                                    const img = row.images[colIdx];
                                    if (img) {
                                      firstAvailableImg = img;
                                      break;
                                    }
                                  } else if (layer.mappedColumn === '__excel_image_auto') {
                                    const firstKey = Object.keys(row.images)[0];
                                    const img = firstKey !== undefined ? row.images[parseInt(firstKey)] : '';
                                    if (img) {
                                      firstAvailableImg = img;
                                      break;
                                    }
                                  } else {
                                    const val = row.values[layer.mappedColumn]?.trim();
                                    if (val && (val.startsWith('http') || val.startsWith('data:'))) {
                                      firstAvailableImg = val;
                                      break;
                                    }
                                  }
                                }
                              }
                            }

                            // If still no image, scan all spreadsheet value cells for URLs
                            if (!firstAvailableImg) {
                              for (const headerKey of Object.keys(row.values)) {
                                const val = row.values[headerKey]?.trim();
                                if (val && (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:image/'))) {
                                  firstAvailableImg = val;
                                  break;
                                }
                              }
                            }

                            return (
                              <tr
                                key={row.id}
                                className={`cursor-pointer transition-colors ${
                                  isSelected ? 'bg-orange-50/40 hover:bg-orange-50/60' : 'hover:bg-slate-50/50'
                                }`}
                                onClick={() => setActiveRowIndex(idx)}
                              >
                                {/* 1. Radio point */}
                                <td className="py-3 px-3 text-center">
                                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                                    isSelected ? 'border-orange-600 bg-orange-100 text-orange-600' : 'border-slate-300'
                                  }`}>
                                    {isSelected && <span className="h-2 w-2 rounded-full bg-orange-600" />}
                                  </div>
                                </td>

                                {/* 2. Image preview */}
                                <td className="py-3 px-3">
                                  {firstAvailableImg ? (
                                    <img
                                      src={firstAvailableImg}
                                      alt="Urun"
                                      referrerPolicy="no-referrer"
                                      className="h-8 w-8 rounded border border-slate-200 object-cover bg-slate-50"
                                    />
                                  ) : (
                                    <div className="h-8 w-8 rounded border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-350 text-[9px] font-mono select-none">
                                      Resim Yok
                                    </div>
                                  )}
                                </td>

                                {/* 3. Text specifications */}
                                <td className="py-3 px-3">
                                  <div className="font-semibold text-slate-900 truncate max-w-[250px]">
                                    {row.values[titleCol] || <span className="text-slate-400 italic">Değer Girilmemiş</span>}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                    {codeCol ? `${codeCol}: ${row.values[codeCol] || '-'}` : `Satır No: ${row.rowNumber}`}
                                  </div>
                                </td>

                                {/* 4. Price label */}
                                <td className="py-3 px-3 font-semibold text-slate-700">
                                  {priceCol ? (row.values[priceCol] || '-') : '-'}
                                </td>

                                {/* 5. Custom download button per card */}
                                <td className="py-3 px-3 text-right">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadSingleCard(row);
                                    }}
                                    className="p-1 px-2.5 bg-white hover:bg-slate-100 border border-slate-200/80 rounded-lg text-slate-600 hover:text-indigo-600 font-medium text-[11px] inline-flex items-center gap-1 select-none transition cursor-pointer"
                                    id={`download-single-btn-${row.id}`}
                                  >
                                    <Download size={11} />
                                    İndir
                                  </button>
                                </td>

                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* HIDDEN INLINE RENDER ELEMENT FOR PERFECT DPI SAVE */}
        {/* We place it offscreen/hidden in the DOM and render scale=1 inside it so html2canvas renders exact pixels without device-scale pixelization! */}
        <div className="absolute overflow-hidden pointer-events-none z-[-9999]" style={{ width: `${template.widthPx}px`, height: `${template.heightPx}px`, left: '-99999px', top: '-99999px', opacity: 1, visibility: 'visible' }}>
          <div id="high-fidelity-rendering-pane" style={{ width: `${template.widthPx}px`, height: `${template.heightPx}px`, display: 'inline-block' }}>
            <CardPreviewer
              template={template}
              activeRow={bulkExportActiveRow || activeRow}
              activeLayerId={null}
              scale={1}
              renderMode="display"
            />
          </div>
        </div>

        {/* BULK EXPORT PROGRESS OVERLAY BACKDROP */}
        {exportProgress.isExporting && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl flex flex-col items-center gap-4 animate-scale-up">
              <Loader2 size={36} className="text-indigo-600 animate-spin" />
              <div>
                <h3 className="font-display font-medium text-slate-900 text-sm">Ürün Kartları Hazırlanıyor</h3>
                <p className="text-xs text-slate-500 mt-1">Lütfen tarayıcınızın toplu dosya kaydetme işlemine izin verin.</p>
              </div>

              {/* Progress bar container */}
              <div className="w-full bg-slate-100 rounded-full h-2.5 mt-2">
                <div 
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" 
                  style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
                />
              </div>

              <div className="flex flex-col gap-0.5 text-xs">
                <span className="font-mono text-indigo-600 font-bold">
                  {exportProgress.current} / {exportProgress.total} Ürün
                </span>
                <span className="text-slate-400 italic truncate max-w-[280px]">
                  İndiriliyor: {exportProgress.currentRowName}
                </span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
