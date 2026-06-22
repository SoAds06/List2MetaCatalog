/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CardTemplate, CardLayer } from '../types';

// Let's define some preconfigured layout designs that work spectacularly.
// Since we don't have local static files, we'll generate SVG background previews as base64 Data URLs so they render instantly!

const createGradientSvg = (startColor: string, endColor: string, width: number, height: number, patternType: string): string => {
  let pattern = '';
  if (patternType === 'dots') {
    pattern = `
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#ffffff" fill-opacity="0.12"/>
        </pattern>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${startColor}" />
          <stop offset="100%" stop-color="${endColor}" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)" />
      <rect width="100%" height="100%" fill="url(#grid)" />
    `;
  } else if (patternType === 'elegant-lines') {
    pattern = `
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${startColor}" />
          <stop offset="100%" stop-color="${endColor}" />
        </linearGradient>
        <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.15" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)" />
      <path d="M 0,0 L ${width},${height * 0.4} L ${width},0 Z" fill="url(#accent)" />
      <circle cx="${width * 0.95}" cy="${height * 0.05}" r="150" fill="#ffffff" fill-opacity="0.03" />
      <circle cx="${width * 0.95}" cy="${height * 0.05}" r="80" fill="#ffffff" fill-opacity="0.05" />
    `;
  } else {
    pattern = `
      <defs>
        <linearGradient id="grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${startColor}" />
          <stop offset="100%" stop-color="${endColor}" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)" />
      <!-- Minimal aesthetic borders -->
      <rect x="20" y="20" width="${width - 40}" height="${height - 40}" rx="12" fill="none" stroke="#ffffff" stroke-width="2" stroke-opacity="0.15" />
    `;
  }

  const svgStr = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      ${pattern}
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgStr)}`;
};

export const PRESET_BACKGROUND_DESIGNS = [
  {
    id: 'modern-dark',
    name: 'Asil Gece (Koyu Modern)',
    startColor: '#090d16',
    endColor: '#1e1b4b',
    width: 1080,
    height: 1080,
    pattern: 'elegant-lines',
    bgUrl: '' // dynamically filled below
  },
  {
    id: 'nordic-light',
    name: 'Sade İskandinav (Açık Minimalist)',
    startColor: '#f8fafc',
    endColor: '#e2e8f0',
    width: 1080,
    height: 1080,
    pattern: 'minimal',
    bgUrl: '' // dynamically filled below
  },
  {
    id: 'creative-orange',
    name: 'Sıcak Enerji (Modern Turuncu)',
    startColor: '#2e0854',
    endColor: '#ea580c',
    width: 1080,
    height: 1080,
    pattern: 'dots',
    bgUrl: '' // dynamically filled below
  },
  {
    id: 'emerald-luxury',
    name: 'Zümrüt Prestij',
    startColor: '#022c22',
    endColor: '#064e3b',
    width: 1080,
    height: 1080,
    pattern: 'elegant-lines',
    bgUrl: '' // dynamically filled below
  }
];

// Instantly fill svg backgrounds
PRESET_BACKGROUND_DESIGNS.forEach(item => {
  item.bgUrl = createGradientSvg(item.startColor, item.endColor, item.width, item.height, item.pattern);
});

export const DEFAULT_LAYERS: CardLayer[] = [
  {
    id: 'layer-title',
    name: 'Ürün Adı',
    type: 'text',
    mappedColumn: '', // initially empty, will map dynamically in UI
    x: 10,
    y: 54,
    width: 80,
    height: 10,
    style: {
      fontSize: 24,
      color: '#ffffff',
      fontFamily: 'display',
      fontWeight: 'bold',
      align: 'center',
      verticalAlign: 'middle',
      hasBackgroundColor: false,
      backgroundColor: '#000000',
      backgroundOpacity: 0.5,
      borderRadius: 4,
      padding: 4,
      uppercase: true
    }
  },
  {
    id: 'layer-price',
    name: 'Fiyat',
    type: 'text',
    mappedColumn: '',
    x: 20,
    y: 68,
    width: 60,
    height: 8,
    style: {
      fontSize: 32,
      color: '#fbbf24', // golden yellow
      fontFamily: 'display',
      fontWeight: 'bold',
      align: 'center',
      verticalAlign: 'middle',
      hasBackgroundColor: true,
      backgroundColor: '#000000',
      backgroundOpacity: 0.3,
      borderRadius: 8,
      padding: 6,
      uppercase: false
    }
  },
  {
    id: 'layer-photo',
    name: 'Ürün Fotoğrafı',
    type: 'image',
    mappedColumn: '', // Empty by default, filled dynamically by automatic scanner
    x: 15,
    y: 10,
    width: 70,
    height: 40,
    style: {
      fontSize: 14,
      color: '#ffffff',
      fontFamily: 'sans',
      fontWeight: 'normal',
      align: 'center',
      hasBackgroundColor: true,
      backgroundColor: '#ffffff',
      backgroundOpacity: 0.1,
      borderRadius: 16,
      padding: 0,
      uppercase: false
    },
    objectFit: 'cover'
  },
  {
    id: 'layer-code',
    name: 'Barkod / Kod',
    type: 'text',
    mappedColumn: '',
    x: 10,
    y: 84,
    width: 80,
    height: 6,
    style: {
      fontSize: 14,
      color: '#94a3b8',
      fontFamily: 'mono',
      fontWeight: 'medium',
      align: 'center',
      verticalAlign: 'middle',
      hasBackgroundColor: false,
      backgroundColor: '#000000',
      backgroundOpacity: 0.5,
      borderRadius: 4,
      padding: 2,
      uppercase: true
    }
  }
];

export const INITIAL_TEMPLATE: CardTemplate = {
  id: 'tmpl-default',
  name: 'Varsayılan Şablon',
  backgroundUrl: PRESET_BACKGROUND_DESIGNS[0].bgUrl,
  widthPx: 1080,
  heightPx: 1080,
  layers: DEFAULT_LAYERS
};
