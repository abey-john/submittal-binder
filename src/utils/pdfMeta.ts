import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Initialize pdf.js worker URL locally for offline/browser-only usage
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
}

export type PdfMetadata = {
  pageCount: number;
  thumbnailDataUrl?: string;
  error?: string;
};

/**
 * Reads page count and renders first-page thumbnail using pdf.js.
 * Uses URL.createObjectURL to stream from File without keeping full duplicate in JS heap.
 * Surfaces unreadable or encrypted PDFs.
 */
export async function extractPdfMetadata(file: File): Promise<PdfMetadata> {
  const url = URL.createObjectURL(file);
  try {
    const loadingTask = pdfjsLib.getDocument({
      url,
    });

    const pdfDoc = await loadingTask.promise;
    const pageCount = pdfDoc.numPages;

    let thumbnailDataUrl: string | undefined;
    try {
      const page = await pdfDoc.getPage(1);
      const unscaledViewport = page.getViewport({ scale: 1 });
      // Scale to fit approx 120 x 155 box
      const targetWidth = 120;
      const targetHeight = 155;
      const scale = Math.min(
        targetWidth / unscaledViewport.width,
        targetHeight / unscaledViewport.height
      );
      const viewport = page.getViewport({ scale: Math.max(0.15, scale) });

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));

      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({
          canvasContext: ctx,
          viewport,
          canvas,
        }).promise;
        thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      }
    } catch (renderError) {
      console.warn('Could not render thumbnail for file:', file.name, renderError);
    }

    return {
      pageCount,
      thumbnailDataUrl,
    };
  } catch (err: any) {
    const isEncrypted =
      err?.name === 'PasswordException' ||
      String(err?.message || '').toLowerCase().includes('password') ||
      String(err?.message || '').toLowerCase().includes('encrypt');

    const errorMessage = isEncrypted
      ? 'File is encrypted or password protected'
      : (err?.message || 'Unreadable PDF file');

    return {
      pageCount: 1,
      error: errorMessage,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
