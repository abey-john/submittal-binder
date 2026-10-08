import { describe, expect, it } from 'vitest';
import { PDFDocument, degrees } from 'pdf-lib';
import {
  defaultStampConfig,
  drawComponentCover,
  drawTocPages,
  stampPageNumbers,
} from './pdfEngine';
import { paginateToc } from './layout';
import type { Component } from './types';

describe('pdfEngine: Covers, TOC, and Stamping', () => {
  it('generates a valid 1-page Letter component cover', async () => {
    const doc = await drawComponentCover(1, 'Piping Specialties & Valves');
    expect(doc.getPageCount()).toBe(1);

    const page = doc.getPage(0);
    expect(page.getWidth()).toBe(612);
    expect(page.getHeight()).toBe(792);

    const bytes = await doc.save();
    expect(bytes.length).toBeGreaterThan(500);

    // Verify it re-loads cleanly
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('generates TOC pages matching paginateToc output', async () => {
    const sampleComponents: Component[] = [
      {
        id: 'c1',
        sourceName: 'Folder1',
        nameOverride: 'HVAC Ductwork Specs',
        previouslyApproved: 'Submittal 001 Approved',
        fixtures: [],
      },
      {
        id: 'c2',
        sourceName: 'PumpCutSheet.pdf',
        previouslyApproved: 'Spec 15100',
        fixtures: [],
      },
    ];

    const tocPages = paginateToc(sampleComponents);
    const tocDoc = await drawTocPages(tocPages);

    expect(tocDoc.getPageCount()).toBe(tocPages.length);

    const bytes = await tocDoc.save();
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('stamps continuous page numbers across pages with rotation and non-default CropBox', async () => {
    const doc = await PDFDocument.create();

    // Page 0: Normal Letter portrait (rotation 0)
    const p0 = doc.addPage([612, 792]);
    p0.setRotation(degrees(0));

    // Page 1: Rotated 90 degrees
    const p1 = doc.addPage([612, 792]);
    p1.setRotation(degrees(90));

    // Page 2: Rotated 180 degrees
    const p2 = doc.addPage([612, 792]);
    p2.setRotation(degrees(180));

    // Page 3: Rotated 270 degrees
    const p3 = doc.addPage([612, 792]);
    p3.setRotation(degrees(270));

    // Page 4: 11x17 Tabloid page with non-default CropBox
    const p4 = doc.addPage([1224, 792]);
    p4.setCropBox(50, 50, 1100, 700);

    // Stamp all pages
    await stampPageNumbers(doc, defaultStampConfig);

    const bytes = await doc.save();
    expect(bytes.length).toBeGreaterThan(1000);

    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(5);
  });

  it('merges covers, TOC, and source PDFs end-to-end with copyPages', async () => {
    // 1. Create a dummy source PDF A (2 pages)
    const srcDocA = await PDFDocument.create();
    srcDocA.addPage([612, 792]);
    srcDocA.addPage([612, 792]);
    const srcBytesA = await srcDocA.save();

    // 2. Create a dummy source PDF B (1 page, rotated)
    const srcDocB = await PDFDocument.create();
    const pb = srcDocB.addPage([792, 612]);
    pb.setRotation(degrees(90));
    const srcBytesB = await srcDocB.save();

    // Assemble merged document
    const mergedDoc = await PDFDocument.create();

    // Add TOC (1 page)
    const tocDoc = await drawTocPages([{ pageIndex: 0, rows: [] }]);
    const [tocPage] = await mergedDoc.copyPages(tocDoc, [0]);
    mergedDoc.addPage(tocPage);

    // Add Component 1 Cover (1 page)
    const coverDoc1 = await drawComponentCover(1, 'Source A');
    const [coverPage1] = await mergedDoc.copyPages(coverDoc1, [0]);
    mergedDoc.addPage(coverPage1);

    // Copy pages from Source A (2 pages)
    const loadedA = await PDFDocument.load(srcBytesA);
    const pagesA = await mergedDoc.copyPages(loadedA, [0, 1]);
    pagesA.forEach((p) => mergedDoc.addPage(p));

    // Add Component 2 Cover (1 page)
    const coverDoc2 = await drawComponentCover(2, 'Source B');
    const [coverPage2] = await mergedDoc.copyPages(coverDoc2, [0]);
    mergedDoc.addPage(coverPage2);

    // Copy pages from Source B (1 page)
    const loadedB = await PDFDocument.load(srcBytesB);
    const pagesB = await mergedDoc.copyPages(loadedB, [0]);
    pagesB.forEach((p) => mergedDoc.addPage(p));

    // Total pages: 1 (TOC) + 1 (Cover 1) + 2 (A) + 1 (Cover 2) + 1 (B) = 6 pages
    expect(mergedDoc.getPageCount()).toBe(6);

    // Stamp continuous page numbers
    await stampPageNumbers(mergedDoc, defaultStampConfig);

    const finalBytes = await mergedDoc.save();
    const finalDoc = await PDFDocument.load(finalBytes);
    expect(finalDoc.getPageCount()).toBe(6);
  });
});
