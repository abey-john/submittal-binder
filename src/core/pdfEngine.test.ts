import { describe, expect, it } from 'vitest';
import { inflateSync } from 'node:zlib';
import { PDFDocument, PDFName, degrees } from 'pdf-lib';
import {
  addOutline,
  buildProjectOutlines,
  defaultStampConfig,
  drawComponentCover,
  drawTocPages,
  stampPageNumbers,
  TOC_STATUS_CODES,
} from './pdfEngine';
import { computeLayout, paginateToc } from './layout';
import type { Component, Project } from './types';

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

    // Build bookmarks outline tree
    const testProject: Project = {
      version: 1,
      components: [
        {
          id: 'c1',
          sourceName: 'Source A',
          fixtures: [{ id: 'f1', path: 'folderA/item1.pdf' }],
        },
        {
          id: 'c2',
          sourceName: 'Source B',
          fixtures: [{ id: 'f2', path: 'item2.pdf' }],
        },
      ],
    };

    const testLayout = computeLayout(testProject, { f1: 2, f2: 1 });
    const outlineItems = buildProjectOutlines(testProject, testLayout);

    // Verify hierarchical outline items structure
    expect(outlineItems.length).toBe(3); // TOC, Component 1, Component 2
    expect(outlineItems[0].title).toBe('Table of Contents');
    expect(outlineItems[1].title).toBe('Component 1: Source A');
    expect(outlineItems[1].children?.[0].title).toBe('item1'); // .pdf stripped
    expect(outlineItems[2].title).toBe('Component 2: Source B');
    expect(outlineItems[2].children?.[0].title).toBe('item2');

    // Add outlines to document
    await addOutline(mergedDoc, outlineItems);

    const finalBytes = await mergedDoc.save();
    const finalDoc = await PDFDocument.load(finalBytes);
    expect(finalDoc.getPageCount()).toBe(6);

    // Assert low-level outline dictionary exists in PDF catalog
    expect(finalDoc.catalog.has(PDFName.of('Outlines'))).toBe(true);

    const outlinesRef = finalDoc.catalog.get(PDFName.of('Outlines'));
    const outlinesDict = finalDoc.context.lookup(outlinesRef) as any;
    expect(outlinesDict).toBeDefined();

    // Verify first item is Table of Contents
    const firstRef = outlinesDict.get(PDFName.of('First'));
    const firstItem = finalDoc.context.lookup(firstRef) as any;
    expect(firstItem.get(PDFName.of('Title')).decodeText()).toBe('Table of Contents');

    // Next item is Component 1
    const secondRef = firstItem.get(PDFName.of('Next'));
    const secondItem = finalDoc.context.lookup(secondRef) as any;
    expect(secondItem.get(PDFName.of('Title')).decodeText()).toBe('Component 1: Source A');

    // Component 1 has child 'item1'
    const childRef = secondItem.get(PDFName.of('First'));
    const childItem = finalDoc.context.lookup(childRef) as any;
    expect(childItem.get(PDFName.of('Title')).decodeText()).toBe('item1');
  });

  it('renders Status Codes legend below the table of contents', async () => {
    const sampleComponents: Component[] = [
      {
        id: 'c1',
        sourceName: 'ValveSpecs.pdf',
        fixtures: [],
      },
    ];

    const tocPages = paginateToc(sampleComponents);
    const tocDoc = await drawTocPages(tocPages);

    expect(tocDoc.getPageCount()).toBe(1);
    expect(TOC_STATUS_CODES).toEqual([
      'A \u2013 Approved',
      'AN \u2013 Approved as Noted',
      'RR \u2013 Revise and Resubmit',
      'R \u2013 Rejected',
      'V \u2013 Void',
    ]);

    const bytes = await tocDoc.save();
    const matches = [...Buffer.from(bytes).toString('binary').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)];
    const decodedTexts: string[] = [];
    for (const m of matches) {
      try {
        const decompressed = inflateSync(Buffer.from(m[1], 'binary')).toString('latin1');
        const hexMatches = [...decompressed.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)];
        for (const h of hexMatches) {
          const raw = Buffer.from(h[1], 'hex').toString('latin1');
          decodedTexts.push(raw.replace(/\x96/g, '\u2013'));
        }
      } catch {
        // ignore non-flate stream
      }
    }

    expect(decodedTexts).toContain('Status Codes:');
    expect(decodedTexts).toContain('A \u2013 Approved');
    expect(decodedTexts).toContain('AN \u2013 Approved as Noted');
    expect(decodedTexts).toContain('RR \u2013 Revise and Resubmit');
    expect(decodedTexts).toContain('R \u2013 Rejected');
    expect(decodedTexts).toContain('V \u2013 Void');

    // Verify pale transparent blue fill and opacity are rendered for status code column
    const fullStreamText = matches
      .map((m) => {
        try {
          return inflateSync(Buffer.from(m[1], 'binary')).toString('latin1');
        } catch {
          return '';
        }
      })
      .join('\n');
    expect(fullStreamText).toContain('0.65 0.8 0.95 rg');
    expect(fullStreamText).toContain('/ca 0.35');
  });
});
