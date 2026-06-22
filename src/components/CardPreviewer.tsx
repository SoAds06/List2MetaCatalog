/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CardTemplate, ExcelRow, CardLayer } from '../types';

function getSafeCORSImageUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('http://localhost') ||
    trimmed.startsWith('https://localhost')
  ) {
    return trimmed;
  }
  // Use reliable Cloudflare-backed weserv.nl image proxy to solve CORS and prevent canvas tainting
  return `https://images.weserv.nl/?url=${encodeURIComponent(trimmed)}&default=${encodeURIComponent(trimmed)}`;
}

interface CardPreviewerProps {
  template: CardTemplate;
  activeRow: ExcelRow | null; // fallbacks to placeholders if null
  activeLayerId: string | null;
  onSelectLayer?: (id: string) => void;
  onUpdateLayerPos?: (id: string, x: number, y: number, width: number, height: number) => void;
  scale?: number; // scale multiplier for editor (e.g. 0.8)
  renderMode?: 'editor' | 'display';
}

export default function CardPreviewer({
  template,
  activeRow,
  activeLayerId,
  onSelectLayer,
  onUpdateLayerPos,
  scale = 1,
  renderMode = 'display'
}: CardPreviewerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = React.useState<{
    layerId: string;
    type: 'move' | 'resize';
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  // Helper to resolve cell content or fallback to placeholder
  const getLayerValue = (layer: CardLayer): { text: string; imageUrl: string } => {
    if (layer.type === 'shape') {
      return { text: '', imageUrl: '' };
    }
    if (!activeRow) {
      if (layer.type === 'image') {
        return { text: '', imageUrl: 'placeholder-img' };
      }
      return { text: `[${layer.name}]`, imageUrl: '' };
    }

    if (layer.type === 'image') {
      // If mapped to specific column containing image index
      if (layer.mappedColumn && layer.mappedColumn.startsWith('__excel_image_col_')) {
        const colIdx = parseInt(layer.mappedColumn.replace('__excel_image_col_', ''));
        const imgUrl = activeRow.images[colIdx] || '';
        return { text: '', imageUrl: imgUrl };
      }
      // Auto-extract first image in row if mappedColumn is auto
      if (layer.mappedColumn === '__excel_image_auto') {
        const firstAvailableImageKey = Object.keys(activeRow.images)[0];
        const imgUrl = firstAvailableImageKey !== undefined ? activeRow.images[parseInt(firstAvailableImageKey)] : '';
        return { text: '', imageUrl: imgUrl };
      }
      
      // Fallback: If mapped column has URL or string representation in values
      if (layer.mappedColumn) {
        const customUrl = activeRow.values[layer.mappedColumn];
        if (customUrl && customUrl.trim() !== '') {
          return { text: '', imageUrl: customUrl.trim() };
        }
      }
      
      return { text: '', imageUrl: '' };
    }

    // Text layers
    const val = layer.mappedColumn ? activeRow.values[layer.mappedColumn] : '';
    return {
      text: val !== undefined && val !== null ? val : `[${layer.name} Eşleşmedi]`,
      imageUrl: ''
    };
  };

  const fontsMap = {
    sans: 'font-sans',
    display: 'font-display',
    mono: 'font-mono',
    serif: 'font-serif'
  };

  // Drag handles for the designer
  const handleMouseDown = (
    e: React.MouseEvent,
    layerId: string,
    actionType: 'move' | 'resize'
  ) => {
    if (renderMode !== 'editor') return;
    e.stopPropagation();
    e.preventDefault();

    const layer = template.layers.find((l) => l.id === layerId);
    if (!layer) return;

    if (onSelectLayer) {
      onSelectLayer(layerId);
    }

    setDragState({
      layerId,
      type: actionType,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: layer.x,
      startTop: layer.y,
      startWidth: layer.width,
      startHeight: layer.height
    });
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = ((e.clientX - dragState.startX) / rect.width) * 100;
      const deltaY = ((e.clientY - dragState.startY) / rect.height) * 100;

      let newX = dragState.startLeft;
      let newY = dragState.startTop;
      let newW = dragState.startWidth;
      let newH = dragState.startHeight;

      if (dragState.type === 'move') {
        newX = Math.max(0, Math.min(100 - dragState.startWidth, dragState.startLeft + deltaX));
        newY = Math.max(0, Math.min(100 - dragState.startHeight, dragState.startTop + deltaY));
      } else if (dragState.type === 'resize') {
        newW = Math.max(5, Math.min(100 - dragState.startLeft, dragState.startWidth + deltaX));
        newH = Math.max(2, Math.min(100 - dragState.startTop, dragState.startHeight + deltaY));
      }

      if (onUpdateLayerPos) {
        onUpdateLayerPos(dragState.layerId, newX, newY, newW, newH);
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, onUpdateLayerPos]);

  return (
    <div
      ref={containerRef}
      id="card-capture-target"
      className="relative shadow-2xl overflow-hidden select-none transition-shadow"
      style={{
        width: `${template.widthPx}px`,
        height: `${template.heightPx}px`,
        ...(scale !== 1 ? {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        } : {}),
        backgroundColor: '#090d16'
      }}
    >

      {/* Background Image rendered with crossOrigin anonymous via proxy to allow clean export */}
      {template.backgroundUrl && (
        <img
          src={getSafeCORSImageUrl(template.backgroundUrl)}
          alt="Kart Arka Planı"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none z-0"
          style={{ width: '100%', height: '100%', objectFit: 'fill' }}
        />
      )}

      {/* Absolute overlay layers list */}
      {template.layers.map((layer) => {
        const isActive = activeLayerId === layer.id;
        const info = getLayerValue(layer);
        
        // CSS Style Construction
        const customStyle: React.CSSProperties = {
          left: `${layer.x}%`,
          top: `${layer.y}%`,
          width: `${layer.width}%`,
          height: `${layer.height}%`,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: layer.type === 'text'
            ? ((layer.style.verticalAlign || 'middle') === 'top'
              ? 'flex-start'
              : (layer.style.verticalAlign || 'middle') === 'bottom'
                ? 'flex-end'
                : 'center')
            : 'center',
          alignItems: 'stretch',
          ...(layer.style.hasBackgroundColor ? {
            backgroundColor: layer.style.backgroundColor,
            borderRadius: `${layer.style.borderRadius}px`,
          } : {})
        };

        let htmlDecoratedText: React.ReactNode = info.text || <span className="opacity-40 italic">Metin Girilmemiş</span>;

        if (info.text && layer.type === 'text') {
          let textStr = info.text.toString();
          if (layer.style.uppercase) {
            textStr = textStr.toUpperCase();
          }
          
          let formattedNode: React.ReactNode = textStr;
          if (layer.style.lineThrough) {
            formattedNode = <s style={{ textDecoration: 'line-through' }}>{formattedNode}</s>;
          }
          if (layer.style.underline) {
            formattedNode = <u style={{ textDecoration: 'underline' }}>{formattedNode}</u>;
          }
          if (layer.style.italic) {
            formattedNode = <em style={{ fontStyle: 'italic' }}>{formattedNode}</em>;
          }
          htmlDecoratedText = formattedNode;
        }

        return (
          <div
            key={layer.id}
            id={`layer-dom-${layer.id}`}
            onClick={(e) => {
              if (renderMode === 'editor' && onSelectLayer) {
                e.stopPropagation();
                onSelectLayer(layer.id);
              }
            }}
            style={customStyle}
            className={`absolute transition-shadow duration-150 ${
              renderMode === 'editor'
                ? `cursor-grab active:cursor-grabbing border ${
                    isActive
                      ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-xl bg-indigo-500/5'
                      : 'border-dashed border-slate-400/40 hover:border-slate-300'
                  }`
                : 'border border-transparent'
            }`}
            onMouseDown={(e) => handleMouseDown(e, layer.id, 'move')}
          >
            {layer.type === 'text' ? (
              <div 
                className={`whitespace-pre-wrap font-sans break-words ${fontsMap[layer.style.fontFamily]}`}
                style={{
                  textAlign: layer.style.align,
                  padding: `${layer.style.padding !== undefined ? layer.style.padding : 4}px`,
                  fontSize: `${layer.style.fontSize}px`,
                  color: layer.style.color,
                  lineHeight: layer.style.lineHeight !== undefined ? layer.style.lineHeight : 1.2,
                  fontWeight: layer.style.fontWeight === 'bold' ? 700 : layer.style.fontWeight === 'semibold' ? 600 : layer.style.fontWeight === 'medium' ? 500 : 400,
                }}
              >
                {htmlDecoratedText}
              </div>
            ) : layer.type === 'shape' ? (
              <div
                className="w-full h-full relative transition-all"
                style={{
                  backgroundColor: layer.style.backgroundColor || '#ef4444',
                  opacity: layer.style.backgroundOpacity !== undefined ? layer.style.backgroundOpacity : 1,
                  borderWidth: layer.borderWidth !== undefined ? `${layer.borderWidth}px` : '0px',
                  borderStyle: 'solid',
                  borderColor: layer.borderColor || '#3b82f6',
                  borderRadius: layer.shapeType === 'circle' 
                    ? '9999px' 
                    : `${layer.style.borderRadius !== undefined ? layer.style.borderRadius : 0}px`,
                  clipPath: layer.shapeType === 'triangle'
                    ? 'polygon(50% 0%, 0% 100%, 100% 100%)'
                    : undefined,
                }}
              />
            ) : (
              <div 
                className="w-full h-full flex items-center justify-center relative"
                style={{
                  backgroundColor: layer.style.hasBackgroundColor ? layer.style.backgroundColor : 'transparent',
                  borderRadius: `${layer.style.borderRadius}px`,
                  padding: `${layer.style.padding}px`
                }}
              >
                {info.imageUrl === 'placeholder-img' ? (
                  <div className="text-[10px] text-slate-400 flex flex-col items-center justify-center p-3 text-center border-2 border-dashed border-slate-700 w-full h-full rounded-xl bg-slate-900/60 font-mono">
                    <span>[Görsel Alanı: {layer.name}]</span>
                  </div>
                ) : info.imageUrl ? (
                  <img
                    src={getSafeCORSImageUrl(info.imageUrl)}
                    alt={layer.name}
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                    className="w-full h-full"
                    style={{
                      objectFit: layer.objectFit || 'cover',
                      borderRadius: `${layer.style.borderRadius}px`
                    }}
                  />
                ) : (
                  <div className="text-[10px] text-red-400 flex flex-col items-center justify-center p-2 text-center border-2 border-dashed border-red-900/40 w-full h-full rounded-xl bg-red-950/10 font-mono">
                    <span>Fotoğraf Yok</span>
                  </div>
                )}
              </div>
            )}

            {/* Resize Handle only in editor and on active items */}
            {renderMode === 'editor' && isActive && (
              <div
                onMouseDown={(e) => handleMouseDown(e, layer.id, 'resize')}
                className="absolute right-0 bottom-0 w-3.5 h-3.5 bg-indigo-500 hover:bg-indigo-400 border border-white rounded-tl-md cursor-se-resize flex items-center justify-center z-20"
                title="Boyutlandır"
              >
                <svg width="6" height="6" viewBox="0 0 6 6" className="text-white fill-current">
                  <path d="M6,0 L0,6 L6,6 Z" />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
