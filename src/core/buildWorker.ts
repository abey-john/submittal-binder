import { PDFDocument } from 'pdf-lib';
import type { LayoutResult, PageNumberStampConfig, Project } from './types';
import {
  addOutline,
  buildProjectOutlines,
  defaultStampConfig,
  drawComponentCover,
  drawTocPages,
  stampPageNumbers,
} from './pdfEngine';

export type WorkerInMessage =
  | {
      type: 'START_BUILD';
      project: Project;
      layout: LayoutResult;
      stampConfig?: PageNumberStampConfig;
      submittalCoverPdf?: Uint8Array;
    }
  | {
      type: 'FILE_DATA';
      fixtureId: string;
      buffer: ArrayBuffer;
    }
  | {
      type: 'FILE_ERROR';
      fixtureId: string;
      error: string;
    };

export type WorkerOutMessage =
  | {
      type: 'REQUEST_FILE';
      fixtureId: string;
      path: string;
    }
  | {
      type: 'PROGRESS';
      current: number;
      total: number;
      message: string;
    }
  | {
      type: 'SUCCESS';
      pdfBytes: Uint8Array;
    }
  | {
      type: 'ERROR';
      error: string;
      filename?: string;
    };

// Resolves incoming file requests from the main thread
let pendingFileResolve: ((buffer: ArrayBuffer) => void) | null = null;
let pendingFileReject: ((err: Error) => void) | null = null;

self.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
  const data = e.data;

  if (data.type === 'FILE_DATA') {
    if (pendingFileResolve) {
      const resolve = pendingFileResolve;
      pendingFileResolve = null;
      pendingFileReject = null;
      resolve(data.buffer);
    }
    return;
  }

  if (data.type === 'FILE_ERROR') {
    if (pendingFileReject) {
      const reject = pendingFileReject;
      pendingFileResolve = null;
      pendingFileReject = null;
      reject(new Error(data.error));
    }
    return;
  }

  if (data.type === 'START_BUILD') {
    const { project, layout, stampConfig = defaultStampConfig, submittalCoverPdf } = data;
    const totalSteps = Math.max(1, layout.totalPages);
    let completedPages = 0;

    const reportProgress = (msg: string) => {
      self.postMessage({
        type: 'PROGRESS',
        current: Math.min(completedPages, totalSteps),
        total: totalSteps,
        message: msg,
      } as WorkerOutMessage);
    };

    try {
      const mergedDoc = await PDFDocument.create();

      // 1. Extension point: Submittal cover if provided
      if (submittalCoverPdf && submittalCoverPdf.length > 0) {
        reportProgress('Adding Submittal Cover page(s)...');
        const coverDoc = await PDFDocument.load(submittalCoverPdf);
        const count = coverDoc.getPageCount();
        const indices = Array.from({ length: count }, (_, i) => i);
        const pages = await mergedDoc.copyPages(coverDoc, indices);
        pages.forEach((p) => mergedDoc.addPage(p));
        completedPages += count;
      }

      // 2. Table of contents
      reportProgress('Generating Table of Contents...');
      const tocDoc = await drawTocPages(layout.tocPages);
      const tocPageCount = tocDoc.getPageCount();
      const tocIndices = Array.from({ length: tocPageCount }, (_, i) => i);
      const copiedTocPages = await mergedDoc.copyPages(tocDoc, tocIndices);
      copiedTocPages.forEach((p) => mergedDoc.addPage(p));
      completedPages += tocPageCount;

      // 3. Components & Fixtures
      for (let i = 0; i < project.components.length; i++) {
        const comp = project.components[i];
        const compNum = i + 1;
        const compName = comp.nameOverride ?? comp.sourceName;

        // Draw component cover
        reportProgress(`Generating cover for Component ${compNum}: ${compName}...`);
        const compCoverDoc = await drawComponentCover(compNum, compName);
        const [copiedCover] = await mergedDoc.copyPages(compCoverDoc, [0]);
        mergedDoc.addPage(copiedCover);
        completedPages += 1;

        // Process fixtures one at a time
        for (const fixture of comp.fixtures) {
          reportProgress(`Loading ${fixture.path}...`);

          // Request file buffer from main thread
          const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
            pendingFileResolve = resolve;
            pendingFileReject = reject;
            self.postMessage({
              type: 'REQUEST_FILE',
              fixtureId: fixture.id,
              path: fixture.path,
            } as WorkerOutMessage);
          });

          // Load single PDF in isolation
          let srcDoc: PDFDocument;
          try {
            srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
          } catch (loadErr: any) {
            throw new Error(`Failed to parse PDF "${fixture.path}": ${loadErr.message || 'Corrupted or password protected'}`);
          }

          const srcPageCount = srcDoc.getPageCount();
          const indices = Array.from({ length: srcPageCount }, (_, idx) => idx);

          try {
            const pages = await mergedDoc.copyPages(srcDoc, indices);
            pages.forEach((p) => mergedDoc.addPage(p));
          } catch (copyErr: any) {
            throw new Error(`Failed to copy pages from "${fixture.path}": ${copyErr.message}`);
          }

          completedPages += srcPageCount;
          reportProgress(`Added ${fixture.path} (${srcPageCount} pages)`);
        }
      }

      // 4. Stamping continuous page numbers
      reportProgress(`Applying continuous page numbers (1 of ${mergedDoc.getPageCount()})...`);
      await stampPageNumbers(mergedDoc, stampConfig);

      // 5. Bookmarks & Outline Tree
      reportProgress('Generating nested PDF bookmarks and outline tree...');
      const outlineItems = buildProjectOutlines(project, layout, {
        submittalCoverPageCount: submittalCoverPdf && submittalCoverPdf.length > 0 ? 1 : 0,
      });
      await addOutline(mergedDoc, outlineItems);

      // 6. Save final merged document
      reportProgress('Finalizing and encoding submittal PDF...');
      const outputPdfBytes = await mergedDoc.save();

      // Send result back using Transferable ArrayBuffer
      (self as any).postMessage(
        {
          type: 'SUCCESS',
          pdfBytes: outputPdfBytes,
        } as WorkerOutMessage,
        [outputPdfBytes.buffer]
      );
    } catch (err: any) {
      self.postMessage({
        type: 'ERROR',
        error: err.message || 'An unknown error occurred during PDF assembly',
      } as WorkerOutMessage);
    }
  }
};
