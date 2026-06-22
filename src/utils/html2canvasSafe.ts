/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import html2canvas from 'html2canvas';

/**
 * A safe and modern wrapper around html2canvas that temporarily scrubs any oklch(...)
 * structures in the document's stylesheets (both inline <style> elements and local <link> sheets)
 * to prevent html2canvas's built-in CSS parser from crashing on modern CSS properties.
 */
export async function html2canvasSafe(
  element: HTMLElement,
  options: any = {}
): Promise<HTMLCanvasElement> {
  const cleanUps: (() => void)[] = [];

  // 1. Sanitize all <style> blocks
  const styleTags = Array.from(document.querySelectorAll('style'));
  styleTags.forEach((style) => {
    const originalText = style.textContent;
    if (originalText && originalText.includes('oklch')) {
      // Replace oklch(...) with standard fallback colors
      const cleanedText = originalText.replace(/oklch\([^)]+\)/g, 'rgb(120, 120, 120)');
      style.textContent = cleanedText;
      cleanUps.push(() => {
        style.textContent = originalText;
      });
    }
  });

  // 2. Sanitize all local same-origin link stylesheets
  const linkTags = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
  for (const link of linkTags) {
    try {
      const href = link.href;
      if (href && href.startsWith(window.location.origin)) {
        const response = await fetch(href);
        if (response.ok) {
          const originalText = await response.text();
          if (originalText.includes('oklch')) {
            const cleanedText = originalText.replace(/oklch\([^)]+\)/g, 'rgb(120, 120, 120)');
            
            // Create a matching temporary inline style element
            const tempStyle = document.createElement('style');
            tempStyle.textContent = cleanedText;
            tempStyle.className = 'temp-cleaned-html2canvas-css';
            document.head.appendChild(tempStyle);
            
            // Temporarily disable the original linked stylesheet
            const originalDisabled = link.disabled;
            link.disabled = true;
            
            cleanUps.push(() => {
              tempStyle.remove();
              link.disabled = originalDisabled;
            });
          }
        }
      }
    } catch (err) {
      // Silently catch cross-origin or transient fetching errors to prevent blocking
      console.warn('Failed to clean link stylesheet for oklch compatibility:', err);
    }
  }

  // Give the browser a microtask tick to process style changes
  await new Promise((resolve) => setTimeout(resolve, 30));

  // Tag original elements so we can map them precisely to their clones in the onclone iframe
  const originalDescendants = [element, ...Array.from(element.querySelectorAll('*'))] as HTMLElement[];
  originalDescendants.forEach((el, index) => {
    el.setAttribute('data-h2c-index', index.toString());
  });

  const userOnClone = options.onclone;
  const enhancedOptions = {
    foreignObjectRendering: false, // Turn off SVG-based foreignObject rendering to prevent browser security sandboxes from blacking out cross-origin images or web fonts
    inlineStyle: true,
    ...options,
    onclone: (clonedDoc: Document, clonedElElement: HTMLElement) => {
      try {
        const clonedDescendants = Array.from(clonedDoc.querySelectorAll('[data-h2c-index]')) as HTMLElement[];
        
        clonedDescendants.forEach((clonedEl) => {
          const indexStr = clonedEl.getAttribute('data-h2c-index');
          if (indexStr !== null) {
            const index = parseInt(indexStr, 10);
            const originalEl = originalDescendants[index];
            if (originalEl) {
              try {
                const style = window.getComputedStyle(originalEl);
                
                // Copy ALL CSS custom variables (starting with '--') to preserve Tailwind CSS v4 variables
                for (let i = 0; i < style.length; i++) {
                  const propName = style[i];
                  if (propName.startsWith('--')) {
                    const val = style.getPropertyValue(propName);
                    if (val) {
                      clonedEl.style.setProperty(propName, val);
                    }
                  }
                }

                // Copy fully computed styles directly to eliminate Tailwind v4 CSS variables!
                // 1. Text Colors & Backgrounds
                clonedEl.style.color = style.color;
                clonedEl.style.backgroundColor = style.backgroundColor;
                clonedEl.style.borderColor = style.borderColor;
                clonedEl.style.borderTopColor = style.borderTopColor;
                clonedEl.style.borderBottomColor = style.borderBottomColor;
                clonedEl.style.borderLeftColor = style.borderLeftColor;
                clonedEl.style.borderRightColor = style.borderRightColor;
                
                // 2. Typography
                clonedEl.style.fontFamily = originalEl.style.fontFamily || style.fontFamily;
                clonedEl.style.fontSize = originalEl.style.fontSize || style.fontSize;
                clonedEl.style.fontWeight = originalEl.style.fontWeight || style.fontWeight;
                clonedEl.style.fontStyle = originalEl.style.fontStyle || style.fontStyle;
                clonedEl.style.lineHeight = originalEl.style.lineHeight || style.lineHeight;
                clonedEl.style.textTransform = originalEl.style.textTransform || style.textTransform;
                clonedEl.style.textAlign = originalEl.style.textAlign || style.textAlign;
                clonedEl.style.letterSpacing = originalEl.style.letterSpacing || style.letterSpacing;
                
                // 3. Text decorations (critical for "üstü çizili" / line-through and underline options)
                clonedEl.style.textDecoration = originalEl.style.textDecoration || style.textDecoration;
                clonedEl.style.textDecorationLine = originalEl.style.textDecorationLine || style.textDecorationLine;
                clonedEl.style.textDecorationColor = originalEl.style.textDecorationColor || style.textDecorationColor;
                clonedEl.style.textDecorationStyle = originalEl.style.textDecorationStyle || style.textDecorationStyle;
                
                // 4. Exact Sizing & Spacing to match original layout boundaries
                clonedEl.style.width = originalEl.style.width || style.width;
                clonedEl.style.height = originalEl.style.height || style.height;
                clonedEl.style.padding = originalEl.style.padding || style.padding;
                clonedEl.style.paddingTop = originalEl.style.paddingTop || style.paddingTop;
                clonedEl.style.paddingBottom = originalEl.style.paddingBottom || style.paddingBottom;
                clonedEl.style.paddingLeft = originalEl.style.paddingLeft || style.paddingLeft;
                clonedEl.style.paddingRight = originalEl.style.paddingRight || style.paddingRight;
                
                clonedEl.style.margin = originalEl.style.margin || style.margin;
                clonedEl.style.marginTop = originalEl.style.marginTop || style.marginTop;
                clonedEl.style.marginBottom = originalEl.style.marginBottom || style.marginBottom;
                clonedEl.style.marginLeft = originalEl.style.marginLeft || style.marginLeft;
                clonedEl.style.marginRight = originalEl.style.marginRight || style.marginRight;
                
                // 5. Borders & Styling
                clonedEl.style.borderRadius = originalEl.style.borderRadius || style.borderRadius;
                clonedEl.style.borderWidth = originalEl.style.borderWidth || style.borderWidth;
                clonedEl.style.borderStyle = originalEl.style.borderStyle || style.borderStyle;
                clonedEl.style.boxShadow = originalEl.style.boxShadow || style.boxShadow;
                clonedEl.style.opacity = originalEl.style.opacity || style.opacity;
                clonedEl.style.transform = originalEl.style.transform || style.transform;
                
                // 6. Positioning and Layout (prevents text alignment & vertical flex positioning collapses)
                clonedEl.style.position = originalEl.style.position || style.position;
                clonedEl.style.top = originalEl.style.top || style.top;
                clonedEl.style.left = originalEl.style.left || style.left;
                clonedEl.style.right = originalEl.style.right || style.right;
                clonedEl.style.bottom = originalEl.style.bottom || style.bottom;
                clonedEl.style.display = originalEl.style.display || style.display;
                clonedEl.style.flexDirection = originalEl.style.flexDirection || style.flexDirection;
                clonedEl.style.justifyContent = originalEl.style.justifyContent || style.justifyContent;
                clonedEl.style.alignItems = originalEl.style.alignItems || style.alignItems;
                clonedEl.style.verticalAlign = originalEl.style.verticalAlign || style.verticalAlign;
                clonedEl.style.boxSizing = originalEl.style.boxSizing || style.boxSizing;
                
                // Keep image source and dimensions solid
                if (originalEl instanceof HTMLImageElement && clonedEl instanceof HTMLImageElement) {
                  clonedEl.src = originalEl.src;
                  clonedEl.crossOrigin = 'anonymous';
                }
              } catch (styleErr) {
                // Graceful fallback if getComputedStyle cannot parse element
              }
            }
          }
        });
        
        // Clean up tracking attributes from cloned DOM copy
        const clonedAll = Array.from(clonedDoc.querySelectorAll('[data-h2c-index]'));
        clonedAll.forEach(node => node.removeAttribute('data-h2c-index'));
      } catch (err) {
        console.error('Error during computed style injection inside clone:', err);
      }
      
      // Execute any custom user predefined clone hook
      if (userOnClone) {
        try {
          userOnClone(clonedDoc, clonedElElement);
        } catch (hookErr) {
          console.error('Error in user onclone hook:', hookErr);
        }
      }
    }
  };

  try {
    const canvas = await html2canvas(element, enhancedOptions);
    return canvas;
  } finally {
    // Clean up tracking index attributes on the live original document
    originalDescendants.forEach((el) => {
      try {
        el.removeAttribute('data-h2c-index');
      } catch (err) {
        // Silently ignore
      }
    });

    // Restore original stylesheet representations immediately
    cleanUps.forEach((cleanup) => {
      try {
        cleanup();
      } catch (err) {
        console.error('Error during html2canvas css cleanup restore:', err);
      }
    });
  }
}
