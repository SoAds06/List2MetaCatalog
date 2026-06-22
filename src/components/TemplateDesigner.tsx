/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CardTemplate, CardLayer, ExcelRow } from '../types';
import CardPreviewer from './CardPreviewer';
import { PRESET_BACKGROUND_DESIGNS } from '../utils/presets';
import { 
  Type, 
  Image, 
  Square,
  Trash2, 
  Plus, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Upload, 
  Layers,
  ChevronRight,
  Maximize2,
  Minimize2,
  Smile,
  LayoutGrid,
  Save,
  FolderOpen,
  FileDown,
  Check
} from 'lucide-react';

interface TemplateDesignerProps {
  template: CardTemplate;
  onUpdateTemplate: (newTemplate: CardTemplate) => void;
  excelHeaders: string[];
  activeRow: ExcelRow | null;
  imageColumns: { colIndex: number; name: string }[];
}

export default function TemplateDesigner({
  template,
  onUpdateTemplate,
  excelHeaders,
  activeRow,
  imageColumns
}: TemplateDesignerProps) {
  const [activeLayerId, setActiveLayerId] = React.useState<string | null>(
    template.layers.length > 0 ? template.layers[0].id : null
  );

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Template drafts and backup states for saving and loading
  interface SavedDraft {
    id: string;
    name: string;
    timestamp: string;
    template: CardTemplate;
  }

  const [drafts, setDrafts] = React.useState<SavedDraft[]>([]);
  const [newDraftName, setNewDraftName] = React.useState('');
  const [draftSuccessMessage, setDraftSuccessMessage] = React.useState('');
  const jsonFileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const loaded = localStorage.getItem('designer_drafts');
    if (loaded) {
      try {
        setDrafts(JSON.parse(loaded));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleSaveDraft = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newDraftName.trim() || `Modelleme (${template.widthPx}x${template.heightPx}) - ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    const newDraft: SavedDraft = {
      id: Date.now().toString(),
      name,
      timestamp: new Date().toLocaleString('tr-TR', { hour12: false }),
      template: JSON.parse(JSON.stringify(template)) // clone deeply
    };
    const updated = [newDraft, ...drafts];
    setDrafts(updated);
    localStorage.setItem('designer_drafts', JSON.stringify(updated));
    setNewDraftName('');
    setDraftSuccessMessage('Tasarım şablonu başarıyla tarayıcıya kaydedildi!');
    setTimeout(() => setDraftSuccessMessage(''), 3000);
  };

  const handleDeleteDraft = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Bu taslağı silmek istediğinize emin misiniz?')) {
      const updated = drafts.filter(d => d.id !== id);
      setDrafts(updated);
      localStorage.setItem('designer_drafts', JSON.stringify(updated));
    }
  };

  const handleLoadDraft = (draft: SavedDraft) => {
    const loadedTemplate = JSON.parse(JSON.stringify(draft.template));
    onUpdateTemplate(loadedTemplate);
    if (loadedTemplate.layers.length > 0) {
      setActiveLayerId(loadedTemplate.layers[0].id);
    } else {
      setActiveLayerId(null);
    }
    setDraftSuccessMessage(`"${draft.name}" şablonu yüklendi!`);
    setTimeout(() => setDraftSuccessMessage(''), 2500);
  };

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(template, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanBGName = template.backgroundUrl && !template.backgroundUrl.startsWith('data:') 
      ? template.backgroundUrl.split('/').pop()?.split('?')[0] || 'sablon'
      : 'ozel';
    link.download = `kart_tasarimi_${cleanBGName}_${template.widthPx}x${template.heightPx}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setDraftSuccessMessage('Tasarım .json şablon dosyası indirildi!');
    setTimeout(() => setDraftSuccessMessage(''), 2500);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string);
          if (parsed && typeof parsed === 'object' && Array.isArray(parsed.layers)) {
            const importedTemplate: CardTemplate = {
              id: parsed.id || `template-${Date.now()}`,
              name: parsed.name || 'Yüklenen Şablon',
              widthPx: Number(parsed.widthPx) || 600,
              heightPx: Number(parsed.heightPx) || 800,
              backgroundUrl: parsed.backgroundUrl || '',
              layers: parsed.layers.map((l: any, idx: number) => ({
                id: l.id || `layer-${Date.now()}-${idx}`,
                name: l.name || `Metin / Resim Alanı`,
                type: l.type === 'image' ? 'image' : 'text',
                x: typeof l.x === 'number' ? l.x : 10,
                y: typeof l.y === 'number' ? l.y : 10,
                width: typeof l.width === 'number' ? l.width : 50,
                height: typeof l.height === 'number' ? l.height : 10,
                mappedColumn: l.mappedColumn || '',
                style: {
                  fontSize: l.style?.fontSize || 20,
                  color: l.style?.color || '#000000',
                  fontFamily: l.style?.fontFamily || 'sans',
                  fontWeight: l.style?.fontWeight || '600',
                  textAlign: l.style?.textAlign || 'left',
                  backgroundColor: l.style?.backgroundColor || 'transparent',
                  backgroundOpacity: typeof l.style?.backgroundOpacity === 'number' ? l.style.backgroundOpacity : 0.1,
                  borderRadius: typeof l.style?.borderRadius === 'number' ? l.style.borderRadius : 4,
                  padding: typeof l.style?.padding === 'number' ? l.style.padding : 0,
                  uppercase: !!l.style?.uppercase
                },
                objectFit: l.objectFit || 'cover'
              }))
            };
            onUpdateTemplate(importedTemplate);
            if (importedTemplate.layers.length > 0) {
              setActiveLayerId(importedTemplate.layers[0].id);
            } else {
              setActiveLayerId(null);
            }
            setDraftSuccessMessage('Şablon yedek dosyasından yüklendi!');
            setTimeout(() => setDraftSuccessMessage(''), 3000);
          } else {
            alert('Hata: Dosya formatı geçerli bir kart şablonu yapısı içermiyor.');
          }
        } catch (err) {
          console.error(err);
          alert('Hata: Dosya okunurken hata oluştu. Lütfen geçerli bir yedek JSON dosyası seçin.');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    }
  };

  const activeLayer = template.layers.find((l) => l.id === activeLayerId) || null;

  const [designerScale, setDesignerScale] = React.useState<number>(0.7);
  const [cardResizeState, setCardResizeState] = React.useState<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  const handleWheelZoom = (e: React.WheelEvent) => {
    // Zoom in/out via mouse wheel on hover
    const zoomIntensity = 0.05;
    const delta = e.deltaY < 0 ? 1 : -1;
    setDesignerScale((prevScale) => {
      const nextScale = prevScale + delta * zoomIntensity;
      return Math.max(0.15, Math.min(2.5, Math.round(nextScale * 100) / 100));
    });
  };

  const handleCardResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCardResizeState({
      startX: e.clientX,
      startY: e.clientY,
      startWidth: template.widthPx,
      startHeight: template.heightPx,
    });
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!cardResizeState) return;
      const deltaX = (e.clientX - cardResizeState.startX) / designerScale;
      const deltaY = (e.clientY - cardResizeState.startY) / designerScale;
      
      const newWidth = Math.max(200, Math.min(4000, Math.round(cardResizeState.startWidth + deltaX)));
      const newHeight = Math.max(200, Math.min(4000, Math.round(cardResizeState.startHeight + deltaY)));
      
      onUpdateTemplate({
        ...template,
        widthPx: newWidth,
        heightPx: newHeight
      });
    };

    const handleMouseUp = () => {
      setCardResizeState(null);
    };

    if (cardResizeState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [cardResizeState, designerScale, template, onUpdateTemplate]);

  // Local state for smooth dimension typing to avoid aggressive jump clamping
  const [widthInput, setWidthInput] = React.useState(template.widthPx.toString());
  const [heightInput, setHeightInput] = React.useState(template.heightPx.toString());

  React.useEffect(() => {
    if (document.activeElement?.id !== 'template-width-input') {
      setWidthInput(template.widthPx.toString());
    }
  }, [template.widthPx]);

  React.useEffect(() => {
    if (document.activeElement?.id !== 'template-height-input') {
      setHeightInput(template.heightPx.toString());
    }
  }, [template.heightPx]);

  const handleWidthChange = (valStr: string) => {
    const clean = valStr.replace(/[^0-9]/g, '');
    setWidthInput(clean);
    const parsed = parseInt(clean, 10);
    if (!isNaN(parsed) && parsed >= 100 && parsed <= 4000) {
      onUpdateTemplate({ ...template, widthPx: parsed });
    }
  };

  const handleWidthBlur = () => {
    const parsed = parseInt(widthInput, 10);
    const clamped = Math.max(100, Math.min(4000, isNaN(parsed) ? 600 : parsed));
    setWidthInput(clamped.toString());
    onUpdateTemplate({ ...template, widthPx: clamped });
  };

  const handleHeightChange = (valStr: string) => {
    const clean = valStr.replace(/[^0-9]/g, '');
    setHeightInput(clean);
    const parsed = parseInt(clean, 10);
    if (!isNaN(parsed) && parsed >= 100 && parsed <= 4000) {
      onUpdateTemplate({ ...template, heightPx: parsed });
    }
  };

  const handleHeightBlur = () => {
    const parsed = parseInt(heightInput, 10);
    const clamped = Math.max(100, Math.min(4000, isNaN(parsed) ? 800 : parsed));
    setHeightInput(clamped.toString());
    onUpdateTemplate({ ...template, heightPx: clamped });
  };

  const handleWidthKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const handleHeightKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  // Add custom layer
  const handleAddLayer = (type: 'text' | 'image' | 'shape') => {
    const defaultColumn = excelHeaders.length > 0 ? excelHeaders[0] : '';
    const newId = `layer-custom-${Date.now()}`;
    
    const newLayer: CardLayer = {
      id: newId,
      name: type === 'text' 
        ? `Yeni Alan ${template.layers.length + 1}` 
        : type === 'image' 
          ? `Yeni Görsel ${template.layers.length + 1}` 
          : `Yeni Şekil ${template.layers.length + 1}`,
      type,
      mappedColumn: type === 'image' ? '' : type === 'shape' ? '' : defaultColumn,
      x: 30,
      y: 40,
      width: type === 'shape' ? 20 : 60,
      height: type === 'image' ? 30 : type === 'shape' ? 15 : 8,
      style: {
        fontSize: type === 'image' ? 14 : 20,
        color: '#ffffff',
        fontFamily: 'sans',
        fontWeight: 'normal',
        align: 'center',
        verticalAlign: 'middle',
        hasBackgroundColor: type === 'image' || type === 'shape' ? true : false,
        backgroundColor: type === 'shape' ? '#ef4444' : type === 'image' ? 'rgba(255,255,255,0.1)' : '#000000',
        backgroundOpacity: 1.0,
        borderRadius: type === 'shape' ? 0 : type === 'image' ? 12 : 4,
        padding: type === 'image' ? 0 : 4,
        uppercase: false
      },
      objectFit: 'cover',
      shapeType: type === 'shape' ? 'rectangle' : undefined,
      borderColor: '#3b82f6',
      borderWidth: 0
    };

    onUpdateTemplate({
      ...template,
      layers: [...template.layers, newLayer]
    });
    setActiveLayerId(newId);
  };

  // Delete matching layer
  const handleDeleteLayer = (id: string) => {
    const filtered = template.layers.filter((l) => l.id !== id);
    onUpdateTemplate({
      ...template,
      layers: filtered
    });
    if (activeLayerId === id) {
      setActiveLayerId(filtered.length > 0 ? filtered[0].id : null);
    }
  };

  // Modify styled property of specified layer
  const updateActiveLayerStyle = (updates: Partial<CardLayer['style']>) => {
    if (!activeLayer) return;
    const updatedLayers = template.layers.map((l) => {
      if (l.id === activeLayer.id) {
        return {
          ...l,
          style: {
            ...l.style,
            ...updates
          }
        };
      }
      return l;
    });

    onUpdateTemplate({
      ...template,
      layers: updatedLayers
    });
  };

  // Modify primary parameters of specified layer
  const updateActiveLayerProp = (updates: Partial<CardLayer>) => {
    if (!activeLayer) return;
    const updatedLayers = template.layers.map((l) => {
      if (l.id === activeLayer.id) {
        return {
          ...l,
          ...updates
        };
      }
      return l;
    });

    onUpdateTemplate({
      ...template,
      layers: updatedLayers
    });
  };

  // Drag coordinates callback
  const handleUpdateLayerPos = (id: string, x: number, y: number, width: number, height: number) => {
    const updatedLayers = template.layers.map((l) => {
      if (l.id === id) {
        return {
          ...l,
          x: Math.round(x * 10) / 10,
          y: Math.round(y * 10) / 10,
          width: Math.round(width * 10) / 10,
          height: Math.round(height * 10) / 10
        };
      }
      return l;
    });

    onUpdateTemplate({
      ...template,
      layers: updatedLayers
    });
  };

  // Import custom template image from local file directory
  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result && typeof reader.result === 'string') {
          onUpdateTemplate({
            ...template,
            backgroundUrl: reader.result
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const fontsCollection = [
    { id: 'sans', name: 'Inter (Yalın Sans-serif)' },
    { id: 'display', name: 'Space Grotesk (Geniş Display)' },
    { id: 'mono', name: 'Fira Code (Kod/Barkod Mono)' },
    { id: 'serif', name: 'Georgia (Klasik Serif)' }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start" id="designer-root">
      
      {/* LEFT COLUMN: Contains Preview Screen (Top) & Configuration Panels (Bottom) */}
      <div className="lg:col-span-8 flex flex-col gap-6 lg:order-1" id="designer-left-main">
        
        {/* A. LIVE DESK DRAG BOARD (Enlarged and positioned on left on desktop) */}
        <div 
          className="w-full flex flex-col items-center justify-center p-3 sm:p-5 rounded-2xl bg-slate-100 border border-slate-200/80 min-h-[580px] overflow-hidden shadow-inner relative select-none" 
          id="live-canvas-panel"
          onWheel={handleWheelZoom}
        >
          


          {/* Interactive Scale Adjuster Toolbar */}
          <div className="absolute bottom-4 left-4 right-4 z-10 bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200 shadow-lg flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setDesignerScale(prev => Math.max(0.15, Math.round((prev - 0.05) * 100) / 100))}
                className="bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded font-bold text-slate-700 cursor-pointer"
                title="Küçült"
              >
                -
              </button>
              <input 
                type="range"
                min="0.15"
                max="2.0"
                step="0.05"
                value={designerScale}
                onChange={(e) => setDesignerScale(parseFloat(e.target.value))}
                className="w-16 sm:w-24 accent-indigo-600 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
              />
              <button 
                onClick={() => setDesignerScale(prev => Math.min(2.0, Math.round((prev + 0.05) * 100) / 100))}
                className="bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded font-bold text-slate-700 cursor-pointer"
                title="Büyüt"
              >
                +
              </button>
              <span className="font-mono text-[9px] text-slate-500 bg-slate-50 px-1 py-0.5 rounded border border-slate-100">
                %{Math.round(designerScale * 100)}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => {
                  const parentElement = document.getElementById('live-canvas-panel');
                  const parentWidth = parentElement ? parentElement.clientWidth : 400;
                  const fitScale = Math.max(0.15, Math.min(1.5, (parentWidth - 40) / template.widthPx));
                  setDesignerScale(Math.round(fitScale * 100) / 100);
                }}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 px-2 py-1 rounded font-semibold text-[10px] transition cursor-pointer"
                title="Ekrana Sığdır"
              >
                Sığdır
              </button>
              <button 
                onClick={() => setDesignerScale(0.7)}
                className="bg-slate-50 hover:bg-slate-100 text-slate-600 px-1.5 py-1 rounded text-[10px] border border-slate-150 transition cursor-pointer"
                title="Sıfırla"
              >
                Sıfırla
              </button>
            </div>
          </div>

          {/* Render card centered inside limits with CSS scale multiplier to avoid spilling outside columns */}
          <div 
            className="relative border border-slate-250 bg-slate-900 shadow-2xl p-0.5 overflow-visible"
            style={{
              width: `${template.widthPx * designerScale + 4}px`,
              height: `${template.heightPx * designerScale + 4}px`,
              transition: 'width 0.05s ease, height 0.05s ease'
            }}
          >
            <CardPreviewer
              template={template}
              activeRow={activeRow}
              activeLayerId={activeLayerId}
              onSelectLayer={setActiveLayerId}
              onUpdateLayerPos={handleUpdateLayerPos}
              scale={designerScale}
              renderMode="editor"
            />

            {/* Mouse Draggable Card Size Regulator Handle (Bottom Right) */}
            <div
              onMouseDown={handleCardResizeMouseDown}
              className="absolute right-[-8px] bottom-[-8px] w-6.5 h-6.5 bg-amber-500 hover:bg-amber-400 text-white rounded-full border border-white flex items-center justify-center cursor-se-resize shadow-md hover:scale-105 active:scale-95 transition-all z-35"
              title="Şablon Boyutlarını Sürükleyerek Değiştirin"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" className="fill-current text-white">
                <path d="M10,0 L0,10 L10,10 Z" />
              </svg>
            </div>
          </div>

          {/* Extra spacer to prevent toolbar overlap */}
          <div className="h-10"></div>

          {/* Fake scaling factor representation for aesthetic context */}
          <div className="text-[10px] text-slate-400 font-mono mt-2" id="canvas-scaling-stat">
            Ölçüler: {template.widthPx}x{template.heightPx} Px | Tutup Sürükleyerek veya Alt Bölümden Sığdırabilirsiniz
          </div>

        </div>

        {/* B. UNDER-CANVAS CONFIGURATORS: 2-Column Responsive Layout list stacked underneath */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="under-canvas-configurators">
          
          {/* Col 1: Şablonlar (Arka Plan ve Boyutlar) */}
          <div className="flex flex-col gap-6">
            
            <div className="border border-slate-200 bg-white p-4 rounded-2xl flex flex-col gap-4 shadow-sm text-xs text-slate-600">
              <div className="flex items-center justify-between border-b border-slate-150 pb-2">
                <div className="font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                  <LayoutGrid size={13} className="text-indigo-500" />
                  Şablonlar
                </div>
              </div>

              {/* Arka Plan Görsel Kaynağı */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">1. Şablon Görseli (Arka Plan)</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-indigo-50 border border-dashed border-indigo-200 text-indigo-700 hover:bg-indigo-100/50 rounded-xl px-3 py-2 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  id="bg-upload-btn"
                >
                  <Upload size={14} />
                  Şablon Görseli Yükle
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBackgroundUpload}
                  className="hidden"
                  id="bg-file-input"
                />


              </div>

              <div className="border-t border-slate-100 my-1"></div>

              {/* Şablon Boyutları */}
              <div className="flex flex-col gap-2.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">2. Şablon Ölçüleri (Piksel)</span>
                <div className="grid grid-cols-2 gap-3">
                  {/* Width Inputs */}
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 block mb-1">Genişlik</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={widthInput}
                      onChange={(e) => handleWidthChange(e.target.value)}
                      onBlur={handleWidthBlur}
                      onKeyDown={handleWidthKeyDown}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-800 font-mono text-center font-bold focus:outline-none focus:border-indigo-400 focus:bg-white text-xs transition-colors"
                      id="template-width-input"
                      placeholder="Genişlik"
                    />
                  </div>

                  {/* Height Inputs */}
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 block mb-1">Yükseklik</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={heightInput}
                      onChange={(e) => handleHeightChange(e.target.value)}
                      onBlur={handleHeightBlur}
                      onKeyDown={handleHeightKeyDown}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-800 font-mono text-center font-bold focus:outline-none focus:border-indigo-400 focus:bg-white text-xs transition-colors"
                      id="template-height-input"
                      placeholder="Yükseklik"
                    />
                  </div>
                </div>

                {/* Quick presets for common standards */}
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-150 mt-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Hızlı Ebat Şablonları</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateTemplate({ ...template, widthPx: 1080, heightPx: 1080 });
                      }}
                      className={`px-1 py-1 rounded-md text-[9px] font-bold border transition cursor-pointer text-center ${
                        template.widthPx === 1080 && template.heightPx === 1080
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      1080 x 1080
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateTemplate({ ...template, widthPx: 1080, heightPx: 1350 });
                      }}
                      className={`px-1 py-1 rounded-md text-[9px] font-bold border transition cursor-pointer text-center ${
                        template.widthPx === 1080 && template.heightPx === 1350
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      1080 x 1350
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateTemplate({ ...template, widthPx: 1080, heightPx: 1920 });
                      }}
                      className={`px-1 py-1 rounded-md text-[9px] font-bold border transition cursor-pointer text-center ${
                        template.widthPx === 1080 && template.heightPx === 1920
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      1080 x 1920
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Col 2: Draft/Import/Export Saving */}
          <div className="flex flex-col gap-6">

            {/* 4. ŞABLON KAYDET & YÜKLE */}
            <div className="border border-slate-200 bg-white p-4 rounded-2xl flex flex-col gap-3 shadow-sm text-xs text-slate-600 relative">
              
              {draftSuccessMessage && (
                <div className="absolute top-2 left-2 right-2 bg-emerald-500 text-white text-[10px] font-semibold px-2 py-1.5 rounded-lg text-center animate-fade-in shadow-sm z-20 flex items-center justify-center gap-1">
                  <Check size={11} />
                  {draftSuccessMessage}
                </div>
              )}

              <div className="font-semibold text-slate-800 flex items-center gap-1.5 justify-between">
                <span className="flex items-center gap-1.5">
                  <Save size={13} className="text-emerald-500" />
                  4. Şablon Kayıt & Taslak Havuzu
                </span>
              </div>

              <div className="border-t border-slate-100 my-0.5"></div>

              {/* Quick save draft form */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveDraft();
                }} 
                className="flex flex-col gap-1.5"
              >
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Yeni Taslak Kaydet</span>
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="Taslak İsmi (örn: Barkodlu Dikey)"
                    value={newDraftName}
                    onChange={(e) => setNewDraftName(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-400 focus:bg-white"
                  />
                  <button
                    type="submit"
                    className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                    title="Şablonu Tarayıcıya Kaydet"
                  >
                    <Save size={13} />
                    <span>Kaydet</span>
                  </button>
                </div>
              </form>

              {/* List of drafts */}
              {drafts.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <div className="border-t border-slate-100 my-1"></div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                    <FolderOpen size={11} className="text-indigo-500" />
                    Tarayıcı Taslaklarım ({drafts.length})
                  </span>
                  <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto pr-0.5 scrollbar-thin">
                    {drafts.map((draft) => (
                      <div
                        key={draft.id}
                        onClick={() => handleLoadDraft(draft)}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-150 hover:bg-slate-100/70 hover:border-indigo-200 transition-all cursor-pointer text-[11px] group"
                        title="Geri yüklemek için tıklayın"
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="font-semibold text-slate-700 truncate">{draft.name}</span>
                          <span className="text-[9px] text-slate-400">{draft.timestamp} | {draft.template.widthPx}x{draft.template.heightPx} px</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteDraft(draft.id, e)}
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md opacity-35 group-hover:opacity-100 transition"
                          title="Taslağı Sil"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-slate-100 my-0.5"></div>

              {/* File Backup (Export / Import JSON) */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Yedekleme İşlemleri</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={handleExportJSON}
                    className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    title="Şablonu Dosya Olarak İndir"
                  >
                    <FileDown size={13} className="text-slate-500" />
                    <span>Dosya İndir</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => jsonFileInputRef.current?.click()}
                    className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    title="Yedek Dosyadan Şablon Yükle"
                  >
                    <Upload size={13} className="text-indigo-500" />
                    <span>Dosya Yükle</span>
                  </button>
                  <input
                    ref={jsonFileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImportJSON}
                    className="hidden"
                    id="json-import-file-input"
                  />
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* RIGHT COLUMN / SIDEBAR: Contains Layer Custom Properties (Style Properties Panel) */}
      <div className="lg:col-span-4 flex flex-col gap-6 lg:order-2" id="style-properties-panel">
        
        {/* Dynamic Overlay Layers management merged right into sidebar */}
        <div className="border border-slate-200 bg-white p-4 rounded-2xl flex flex-col gap-3 shadow-sm">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <Layers size={13} className="text-indigo-500" />
              Katmanlar ({template.layers.length})
            </label>
            <div className="flex gap-1.5">
              <button
                onClick={() => handleAddLayer('text')}
                className="bg-slate-50 hover:bg-slate-100 p-1.5 rounded-lg border border-slate-200 text-slate-700 transition cursor-pointer"
                title="Yeni Metin Ekle"
                id="add-text-layer-btn"
              >
                <Type size={13} />
              </button>
              <button
                onClick={() => handleAddLayer('image')}
                className="bg-slate-50 hover:bg-slate-100 p-1.5 rounded-lg border border-slate-200 text-slate-700 transition cursor-pointer"
                title="Yeni Görsel Ekle"
                id="add-image-layer-btn"
              >
                <Image size={13} />
              </button>
              <button
                onClick={() => handleAddLayer('shape')}
                className="bg-slate-50 hover:bg-slate-100 p-1.5 rounded-lg border border-slate-200 text-slate-700 transition cursor-pointer"
                title="Yeni Şekil (Kare, Daire vb.) Ekle"
                id="add-shape-layer-btn"
              >
                <Square size={13} />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto scrollbar-thin">
            {template.layers.map((layer) => {
              const isActive = activeLayerId === layer.id;
              return (
                <div
                  key={layer.id}
                  onClick={() => setActiveLayerId(layer.id)}
                  className={`group p-2.5 rounded-xl border text-xs font-sans items-center flex justify-between cursor-pointer transition-all ${
                    isActive
                      ? 'bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-600/15'
                      : 'bg-white border-slate-200 hover:border-slate-350 text-slate-700'
                  }`}
                  id={`layer-item-${layer.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0">
                      {layer.type === 'text' ? (
                        <Type size={13} />
                      ) : layer.type === 'shape' ? (
                        <Square size={13} />
                      ) : (
                        <Image size={13} />
                      )}
                    </span>
                    <span className="font-semibold truncate pr-1">{layer.name}</span>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteLayer(layer.id);
                    }}
                    className={`p-1 rounded-md transition duration-150 shrink-0 ${
                      isActive 
                        ? 'text-white hover:bg-orange-700' 
                        : 'text-slate-400 opacity-60 hover:opacity-100 hover:bg-slate-100'
                    }`}
                    title="Katmanı Sil"
                    id={`delete-layer-btn-${layer.id}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}

            {template.layers.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50">
                Hiç katman yok. Yukardaki butonlardan bir alan ekleyin.
              </div>
            )}
          </div>
        </div>

        {activeLayer ? (
          <div className="border border-slate-200 bg-white p-5 rounded-2xl flex flex-col gap-4 shadow-sm">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-indigo-500 font-bold uppercase">Katman Özellikleri</span>
                <h3 className="font-display font-medium text-slate-800 text-sm mt-0.5">"{activeLayer.name}" Ayarları</h3>
              </div>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] uppercase font-semibold">
                {activeLayer.type === 'text' ? 'Metin' : activeLayer.type === 'shape' ? 'Şekil' : 'Görsel'}
              </span>
            </div>

            {/* A. Name / Label */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase">Katman İsmi</label>
              <input
                type="text"
                value={activeLayer.name}
                onChange={(e) => updateActiveLayerProp({ name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-slate-800 text-xs mt-1.5 focus:outline-none focus:border-indigo-400"
                id="layer-name-editor"
              />
            </div>

            {/* B. Mapped Column Match selector */}
            {activeLayer.type !== 'shape' && (
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase">Excel Sütun Eşleşmesi</label>
                <select
                  value={activeLayer.mappedColumn}
                  onChange={(e) => updateActiveLayerProp({ mappedColumn: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-slate-850 text-xs mt-1.5 focus:outline-none focus:border-indigo-400"
                  id="column-matcher-select"
                >
                  {/* Image matching dropdown properties */}
                  {activeLayer.type === 'image' ? (
                    <>
                      <option value="">-- Sütun Seçin (Resim Linki/URL) --</option>
                      {excelHeaders.map((header, i) => (
                        <option key={i} value={header}>
                          Resim URL / Klasör Sütunu: {header}
                        </option>
                      ))}
                    </>
                  ) : (
                    <>
                      <option value="">-- El ile Metin Girişi --</option>
                      {excelHeaders.map((header, i) => (
                        <option key={i} value={header}>
                          Hücre Verisi: {header}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
            )}

            <div className="border-t border-slate-100 my-1"></div>

            {/* C. Typography controls (For text fields) */}
            {activeLayer.type === 'text' && (
              <div className="flex flex-col gap-4">
                
                {/* Font and Weights */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Yazı Tipi</label>
                    <select
                      value={activeLayer.style.fontFamily}
                      onChange={(e: any) => updateActiveLayerStyle({ fontFamily: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-slate-800 text-xs mt-1 focus:outline-none focus:border-indigo-400"
                      id="font-family-select"
                    >
                      {fontsCollection.map(f => (
                        <option value={f.id} key={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Kalınlık</label>
                    <select
                      value={activeLayer.style.fontWeight}
                      onChange={(e: any) => updateActiveLayerStyle({ fontWeight: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-slate-800 text-xs mt-1 focus:outline-none focus:border-indigo-400"
                      id="font-weight-select"
                    >
                      <option value="light">İnce</option>
                      <option value="normal">Normal</option>
                      <option value="medium">Orta</option>
                      <option value="semibold">Yarı Kalın</option>
                      <option value="bold">Kalın (Bold)</option>
                    </select>
                  </div>
                </div>

                {/* Sizing & Core Color */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Yazı Boyutu (px)</label>
                    <input
                      type="number"
                      value={activeLayer.style.fontSize}
                      onChange={(e) => updateActiveLayerStyle({ fontSize: Math.max(6, parseInt(e.target.value) || 12) })}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-800 text-xs mt-1 focus:outline-none focus:border-indigo-400"
                      id="font-size-input"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Yazı Rengi</label>
                    <div className="flex gap-1.5 mt-1">
                      <input
                        type="color"
                        value={activeLayer.style.color}
                        onChange={(e) => updateActiveLayerStyle({ color: e.target.value })}
                        className="h-7 w-8 bg-slate-100 rounded cursor-pointer border border-slate-200 mt-0.5"
                        id="text-color-picker"
                      />
                      <input
                        type="text"
                        value={activeLayer.style.color}
                        onChange={(e) => updateActiveLayerStyle({ color: e.target.value })}
                        className="flex-1 bg-slate-50 border border-slate-200 px-1 py-1.5 rounded-lg text-slate-800 text-[10px] uppercase font-mono mt-0.5 focus:outline-none focus:border-indigo-400"
                        id="text-color-hex-input"
                      />
                    </div>
                  </div>
                </div>

                {/* Text Alignments & Case Toggles */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Yatay Hizalama</label>
                    <div className="flex gap-1 mt-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                      {(['left', 'center', 'right'] as const).map((ali) => {
                        const isMatch = activeLayer.style.align === ali;
                        return (
                          <button
                            key={ali}
                            onClick={() => updateActiveLayerStyle({ align: ali })}
                            className={`flex-1 py-1 rounded-md text-slate-700 flex justify-center cursor-pointer ${
                              isMatch ? 'bg-white shadow-sm border border-slate-150' : 'hover:bg-slate-100'
                            }`}
                            id={`align-btn-${ali}`}
                          >
                            {ali === 'left' && <AlignLeft size={13} />}
                            {ali === 'center' && <AlignCenter size={13} />}
                            {ali === 'right' && <AlignRight size={13} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Dikey Hizalama</label>
                    <div className="flex gap-1 mt-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50 text-[10px] font-medium text-slate-700">
                      {(['top', 'middle', 'bottom'] as const).map((vli) => {
                        const isMatch = (activeLayer.style.verticalAlign || 'middle') === vli;
                        return (
                          <button
                            key={vli}
                            onClick={() => updateActiveLayerStyle({ verticalAlign: vli })}
                            className={`flex-1 py-1 rounded-md flex justify-center items-center cursor-pointer ${
                              isMatch ? 'bg-white shadow-sm border border-slate-150 font-bold text-indigo-600' : 'hover:bg-slate-100'
                            }`}
                            id={`valign-btn-${vli}`}
                          >
                            {vli === 'top' && 'Üst'}
                            {vli === 'middle' && 'Orta'}
                            {vli === 'bottom' && 'Alt'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Büyük Harf</label>
                  <button
                    onClick={() => updateActiveLayerStyle({ uppercase: !activeLayer.style.uppercase })}
                    className={`w-full text-xs font-semibold py-1.5 rounded-lg border text-center transition mt-1 cursor-pointer ${
                      activeLayer.style.uppercase
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                    id="uppercase-toggle-btn"
                  >
                    {activeLayer.style.uppercase ? 'AKTİF (ABC)' : 'İptal (Abc)'}
                  </button>
                </div>

                {/* HTML Text decoration options */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Altı Çizili</label>
                    <button
                      onClick={() => updateActiveLayerStyle({ underline: !activeLayer.style.underline })}
                      className={`w-full text-xs font-semibold py-1.5 rounded-lg border text-center transition mt-1 cursor-pointer ${
                        activeLayer.style.underline
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                      style={{ textDecoration: 'underline' }}
                      id="underline-toggle-btn"
                    >
                      Altı
                    </button>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Üstü Çizili</label>
                    <button
                      onClick={() => updateActiveLayerStyle({ lineThrough: !activeLayer.style.lineThrough })}
                      className={`w-full text-xs font-semibold py-1.5 rounded-lg border text-center transition mt-1 cursor-pointer ${
                        activeLayer.style.lineThrough
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                      style={{ textDecoration: 'line-through' }}
                      id="linethrough-toggle-btn"
                    >
                      Üstü
                    </button>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Eğik (Italic)</label>
                    <button
                      onClick={() => updateActiveLayerStyle({ italic: !activeLayer.style.italic })}
                      className={`w-full text-xs font-semibold py-1.5 rounded-lg border text-center transition mt-1 cursor-pointer ${
                        activeLayer.style.italic
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                      style={{ fontStyle: 'italic' }}
                      id="italic-toggle-btn"
                    >
                      Eğik
                    </button>
                  </div>
                </div>

                <div className="mt-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Satır Aralığı (Satır Yüksekliği)</label>
                  <div className="flex gap-2 items-center mt-1">
                    <input
                      type="range"
                      min="0.5"
                      max="2.5"
                      step="0.05"
                      value={activeLayer.style.lineHeight !== undefined ? activeLayer.style.lineHeight : 1.2}
                      onChange={(e) => updateActiveLayerStyle({ lineHeight: parseFloat(e.target.value) || 1.2 })}
                      className="flex-grow h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      id="line-height-slider"
                    />
                    <input
                      type="number"
                      step="0.05"
                      min="0.5"
                      max="2.5"
                      value={activeLayer.style.lineHeight !== undefined ? activeLayer.style.lineHeight : 1.2}
                      onChange={(e) => updateActiveLayerStyle({ lineHeight: parseFloat(e.target.value) || 1.2 })}
                      className="w-16 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-slate-800 text-xs text-center focus:outline-none"
                      id="line-height-number"
                    />
                  </div>
                  <span className="text-[9px] text-slate-400 block mt-1 leading-tight">İpucu: Kutuda dikey hizalamanın (örneğin rakamların) tam üst kenara sıfırlanması için bu değeri "0.9" veya "1.0" seviyelerine çekebilirsiniz.</span>
                </div>

                <div className="border-t border-slate-100 my-1"></div>

                {/* Background badge style box */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Arka Plan Kutucuğu</span>
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeLayer.style.hasBackgroundColor}
                        onChange={(e) => updateActiveLayerStyle({ hasBackgroundColor: e.target.checked })}
                        className="sr-only peer"
                        id="has-bg-color-checkbox"
                      />
                      <div className="relative w-7 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {activeLayer.style.hasBackgroundColor && (
                    <div className="grid grid-cols-2 gap-3 mt-1 animate-fade-in">
                      <div>
                        <span className="text-[10px] text-slate-400">Arka Plan Rengi</span>
                        <div className="flex gap-1.5 mt-0.5">
                          <input
                            type="color"
                            value={activeLayer.style.backgroundColor}
                            onChange={(e) => updateActiveLayerStyle({ backgroundColor: e.target.value })}
                            className="h-7 w-8 bg-slate-100 rounded cursor-pointer border border-slate-200 mt-0.5"
                            id="badge-bg-color-picker"
                          />
                          <input
                            type="text"
                            value={activeLayer.style.backgroundColor}
                            onChange={(e) => updateActiveLayerStyle({ backgroundColor: e.target.value })}
                            className="flex-1 bg-slate-50 border border-slate-200 px-1 py-1.5 rounded-lg text-slate-800 text-[10px] uppercase font-mono mt-0.5 focus:outline-none focus:border-indigo-400"
                            id="badge-bg-color-hex-input"
                          />
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Köşe Yuvarlaklığı</span>
                        <input
                          type="number"
                          value={activeLayer.style.borderRadius}
                          onChange={(e) => updateActiveLayerStyle({ borderRadius: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-800 text-xs mt-1 focus:outline-none focus:border-indigo-400"
                          id="badge-bg-radius-input"
                        />
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] text-slate-400">Dolgu Boşluğu (Padding)</span>
                        <input
                          type="number"
                          value={activeLayer.style.padding}
                          onChange={(e) => updateActiveLayerStyle({ padding: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-800 text-xs mt-1 focus:outline-none focus:border-indigo-400"
                          id="badge-bg-padding-input"
                        />
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* D. Fit & Padding configs (For images) */}
            {activeLayer.type === 'image' && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Ölçek Sığdırma</label>
                    <select
                      value={activeLayer.objectFit || 'cover'}
                      onChange={(e: any) => updateActiveLayerProp({ objectFit: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-slate-800 text-xs mt-1 focus:outline-none focus:border-indigo-400"
                      id="image-object-fit-select"
                    >
                      <option value="cover">Kırparak Sığdır (Cover)</option>
                      <option value="contain">Orantılı Sığdır (Contain)</option>
                      <option value="fill">Uzatıp Gerdir (Fill)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Köşe Ovalliği (px)</label>
                    <input
                      type="number"
                      value={activeLayer.style.borderRadius}
                      onChange={(e) => updateActiveLayerStyle({ borderRadius: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-800 text-xs mt-1 focus:outline-none focus:border-indigo-400"
                      id="image-radius-input"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Fotoğraf Çevresi Dolgusu</span>
                  <input
                    type="number"
                    value={activeLayer.style.padding}
                    onChange={(e) => updateActiveLayerStyle({ padding: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-20 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg text-slate-800 text-xs text-center focus:outline-none"
                    id="image-padding-input"
                  />
                </div>
              </div>
            )}

            {/* Shape Specific Controls */}
            {activeLayer.type === 'shape' && (
              <div className="flex flex-col gap-4">
                {/* Shape Type Selector */}
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Şekil Türü</label>
                  <select
                    value={activeLayer.shapeType || 'rectangle'}
                    onChange={(e: any) => updateActiveLayerProp({ shapeType: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-slate-800 text-xs mt-1 focus:outline-none focus:border-indigo-400"
                    id="shape-type-select"
                  >
                    <option value="rectangle">Kare / Dikdörtgen</option>
                    <option value="circle">Daire / Elips</option>
                    <option value="triangle">Üçgen</option>
                  </select>
                </div>

                {/* Fill / Background Color */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Dolgu Rengi</label>
                    <div className="flex gap-1.5 mt-1">
                      <input
                        type="color"
                        value={activeLayer.style.backgroundColor || '#ef4444'}
                        onChange={(e) => updateActiveLayerStyle({ backgroundColor: e.target.value })}
                        className="h-7 w-8 bg-slate-100 rounded cursor-pointer border border-slate-200 mt-0.5"
                        id="shape-bg-color-picker"
                      />
                      <input
                        type="text"
                        value={activeLayer.style.backgroundColor || '#ef4444'}
                        onChange={(e) => updateActiveLayerStyle({ backgroundColor: e.target.value })}
                        className="flex-1 bg-slate-50 border border-slate-200 px-1 py-1.5 rounded-lg text-slate-800 text-[10px] uppercase font-mono mt-0.5 focus:outline-none focus:border-indigo-400"
                        id="shape-bg-color-hex-input"
                      />
                    </div>
                  </div>

                  {/* Corner Rounding - only if rectangle */}
                  {(activeLayer.shapeType || 'rectangle') === 'rectangle' && (
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 uppercase">Köşe Yuvarlaklığı</label>
                      <input
                        type="number"
                        value={activeLayer.style.borderRadius !== undefined ? activeLayer.style.borderRadius : 0}
                        onChange={(e) => updateActiveLayerStyle({ borderRadius: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-800 text-xs mt-1 focus:outline-none focus:border-indigo-400"
                        id="shape-border-radius-input"
                      />
                    </div>
                  )}
                </div>

                {/* Border Settings */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Kenarlık Kalınlığı (px)</label>
                    <input
                      type="number"
                      value={activeLayer.borderWidth !== undefined ? activeLayer.borderWidth : 0}
                      onChange={(e) => updateActiveLayerProp({ borderWidth: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-800 text-xs mt-1 focus:outline-none focus:border-indigo-400"
                      id="shape-border-width-input"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Kenarlık Rengi</label>
                    <div className="flex gap-1.5 mt-1">
                      <input
                        type="color"
                        value={activeLayer.borderColor || '#3b82f6'}
                        onChange={(e) => updateActiveLayerProp({ borderColor: e.target.value })}
                        className="h-7 w-8 bg-slate-100 rounded cursor-pointer border border-slate-200 mt-0.5"
                        id="shape-border-color-picker"
                      />
                      <input
                        type="text"
                        value={activeLayer.borderColor || '#3b82f6'}
                        onChange={(e) => updateActiveLayerProp({ borderColor: e.target.value })}
                        className="flex-1 bg-slate-50 border border-slate-200 px-1 py-1.5 rounded-lg text-slate-800 text-[10px] uppercase font-mono mt-0.5 focus:outline-none focus:border-indigo-400"
                        id="shape-border-color-hex-input"
                      />
                    </div>
                  </div>
                </div>

                {/* Opacity slider */}
                <div>
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Opaklık (Şeffaflık)</label>
                    <span className="text-[10px] font-mono text-slate-600">
                      {Math.round((activeLayer.style.backgroundOpacity !== undefined ? activeLayer.style.backgroundOpacity : 1) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={activeLayer.style.backgroundOpacity !== undefined ? activeLayer.style.backgroundOpacity : 1}
                    onChange={(e) => updateActiveLayerStyle({ backgroundOpacity: parseFloat(e.target.value) })}
                    className="w-full mt-1 accent-indigo-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                    id="shape-opacity-slider"
                  />
                </div>
              </div>
            )}

            <div className="border-t border-slate-100 my-1"></div>

            {/* E. Unified Absolute Position & Dimension Configurator in Pixels */}
            <div className="flex flex-col gap-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Boyut ve Konum Ayarları (Piksel)</span>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Width (px) */}
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">Genişlik (px)</span>
                  <input
                    type="number"
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-400 font-mono"
                    value={Math.round((activeLayer.width / 100) * template.widthPx)}
                    onChange={(e) => {
                      const pxVal = Math.max(1, parseFloat(e.target.value) || 0);
                      const pct = (pxVal / template.widthPx) * 100;
                      updateActiveLayerProp({ width: pct });
                    }}
                    id="layer-width-px-direct-input"
                    placeholder="Örn: 400"
                  />
                </div>

                {/* Height (px) */}
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">Yükseklik (px)</span>
                  <input
                    type="number"
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-400 font-mono"
                    value={Math.round((activeLayer.height / 100) * template.heightPx)}
                    onChange={(e) => {
                      const pxVal = Math.max(1, parseFloat(e.target.value) || 0);
                      const pct = (pxVal / template.heightPx) * 100;
                      updateActiveLayerProp({ height: pct });
                    }}
                    id="layer-height-px-direct-input"
                    placeholder="Örn: 100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* X Coordinate (px) */}
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">X Pozisyonu (Soldan px)</span>
                  <input
                    type="number"
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-400 font-mono"
                    value={Math.round((activeLayer.x / 100) * template.widthPx)}
                    onChange={(e) => {
                      const pxVal = parseFloat(e.target.value) || 0;
                      const pct = (pxVal / template.widthPx) * 100;
                      updateActiveLayerProp({ x: pct });
                    }}
                    id="layer-x-px-direct-input"
                    placeholder="Örn: 50"
                  />
                </div>

                {/* Y Coordinate (px) */}
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">Y Pozisyonu (Üstten px)</span>
                  <input
                    type="number"
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-400 font-mono"
                    value={Math.round((activeLayer.y / 100) * template.heightPx)}
                    onChange={(e) => {
                      const pxVal = parseFloat(e.target.value) || 0;
                      const pct = (pxVal / template.heightPx) * 100;
                      updateActiveLayerProp({ y: pct });
                    }}
                    id="layer-y-px-direct-input"
                    placeholder="Örn: 150"
                  />
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="border border-slate-200/80 bg-slate-50/10 p-6 rounded-2xl text-center select-none text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <Layers className="h-8 w-8 text-slate-300 animate-pulse" />
            <span>Katmanı seçip ayarlamak için tasarım alanından veya yandaki listeden bir ögeye tıklayabilirsiniz.</span>
          </div>
        )}
      </div>

    </div>
  );
}
