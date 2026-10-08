import {
  degrees,
  PDFDocument,
  PDFHexString,
  PDFName,
  type PDFRef,
  rgb,
  StandardFonts,
} from 'pdf-lib';
import {
  getComponentDisplayName,
  getFixtureTitle,
  type OutlineItem,
  type PageNumberStampConfig,
  type TocLayoutOptions,
  type TocPage,
  type Project,
  type LayoutResult,
} from './types';
import { wrapTextToLines } from './layout';

export const defaultStampConfig: PageNumberStampConfig = {
  fontSize: 9,
  bottomMargin: 24,
  format: 'Page {page} of {total}',
};

export interface PdfEngine {
  drawComponentCover(
    componentNumber: number,
    componentName: string
  ): Promise<PDFDocument>;

  drawTocPages(
    tocPages: TocPage[],
    options?: TocLayoutOptions
  ): Promise<PDFDocument>;

  stampPageNumbers(
    doc: PDFDocument,
    config?: PageNumberStampConfig
  ): Promise<void>;

  addOutline(
    doc: PDFDocument,
    outline: OutlineItem[]
  ): Promise<void>;
}

/**
 * Draws a single Component cover page on a blank Letter portrait sheet (612 x 792 pt).
 * Line: "Component {n}: {name}". Shrinks font or wraps if long. Centered vertically & horizontally.
 */
export async function drawComponentCover(
  componentNumber: number,
  componentName: string
): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // Letter portrait
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const fullText = `Component ${componentNumber}: ${componentName}`;
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 54;
  const maxAllowedWidth = pageWidth - margin * 2;

  // Start with 24pt and scale down if needed
  let fontSize = 24;
  let textWidth = fontBold.widthOfTextAtSize(fullText, fontSize);

  while (textWidth > maxAllowedWidth && fontSize > 14) {
    fontSize -= 1;
    textWidth = fontBold.widthOfTextAtSize(fullText, fontSize);
  }

  // If still wider than allowed, wrap lines
  const lines: string[] = [];
  if (textWidth > maxAllowedWidth) {
    const charsPerLine = Math.floor(maxAllowedWidth / (fontSize * 0.6));
    lines.push(...wrapTextToLines(fullText, Math.max(15, charsPerLine)));
  } else {
    lines.push(fullText);
  }

  const lineHeight = fontSize * 1.35;
  const totalTextHeight = lines.length * lineHeight;
  let currentY = pageHeight / 2 + totalTextHeight / 2 - fontSize;

  for (const line of lines) {
    const lineWidth = fontBold.widthOfTextAtSize(line, fontSize);
    const x = (pageWidth - lineWidth) / 2;
    page.drawText(line, {
      x,
      y: currentY,
      size: fontSize,
      font: fontBold,
      color: rgb(0.1, 0.12, 0.18),
    });
    currentY -= lineHeight;
  }

  return doc;
}

export const TOC_STATUS_CODES = [
  'A \u2013 Approved',
  'AN \u2013 Approved as Noted',
  'RR \u2013 Revise and Resubmit',
  'R \u2013 Rejected',
  'V \u2013 Void',
] as const;

/**
 * Draws Table of Contents pages matching pure paginateToc output.
 * Exact table with real lines, wrapped cells, and repeated headers on every page.
 */
export async function drawTocPages(
  tocPages: TocPage[],
  options?: TocLayoutOptions
): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontBoldOblique = await doc.embedFont(StandardFonts.HelveticaBoldOblique);

  const pageWidth = options?.pageWidth ?? 612;
  const pageHeight = options?.pageHeight ?? 792;
  const margin = options?.margin ?? 36;
  const headerHeight = options?.headerRowHeight ?? 28;

  // Table columns (total 540 pt, fills 612 - 2 * 36)
  const columns = [
    { title: '#', width: 40, align: 'center' as const },
    { title: 'Component Name', width: 180, align: 'left' as const },
    { title: 'Submitted in this Package', width: 90, align: 'center' as const },
    { title: 'Where Previously Approved', width: 140, align: 'left' as const },
    { title: 'Status Code (By Reviewer)', width: 90, align: 'center' as const },
  ];
  const tableWidth = columns.reduce((acc, c) => acc + c.width, 0);

  for (let pageIdx = 0; pageIdx < tocPages.length; pageIdx++) {
    const tocPage = tocPages[pageIdx];
    const page = doc.addPage([pageWidth, pageHeight]);
    let currentY = pageHeight - margin;

    // Draw Title on First Page
    if (pageIdx === 0) {
      page.drawText('Table of Contents', {
        x: margin,
        y: currentY - 24,
        size: 18,
        font: fontBold,
        color: rgb(0.1, 0.15, 0.25),
      });
      currentY -= 50;
    }

    // Draw Header Row
    const headerTop = currentY;
    const headerBottom = headerTop - headerHeight;

    // Header background fill
    page.drawRectangle({
      x: margin,
      y: headerBottom,
      width: tableWidth,
      height: headerHeight,
      color: rgb(0.93, 0.94, 0.96),
      borderColor: rgb(0.65, 0.7, 0.75),
      borderWidth: 0.75,
    });

    // Header column texts and vertical dividers
    let colX = margin;
    for (const col of columns) {
      const headerTextSize = 8.5;
      const wrappedHeader = wrapTextToLines(col.title, Math.floor((col.width - 6) / 5));
      const hLineHeight = 10;
      let textY = headerBottom + (headerHeight + wrappedHeader.length * hLineHeight) / 2 - 8;

      for (const line of wrappedHeader) {
        const textW = fontBold.widthOfTextAtSize(line, headerTextSize);
        const textX =
          col.align === 'center'
            ? colX + (col.width - textW) / 2
            : colX + 5;

        page.drawText(line, {
          x: textX,
          y: textY,
          size: headerTextSize,
          font: fontBold,
          color: rgb(0.2, 0.25, 0.35),
        });
        textY -= hLineHeight;
      }

      // Vertical line after column
      colX += col.width;
      if (colX < margin + tableWidth) {
        page.drawLine({
          start: { x: colX, y: headerTop },
          end: { x: colX, y: headerBottom },
          thickness: 0.75,
          color: rgb(0.65, 0.7, 0.75),
        });
      }
    }

    currentY = headerBottom;

    // Fill Status Code column data area with pale transparent blue (not the header)
    const statusCodeColIdx = columns.findIndex((c) =>
      c.title.toLowerCase().includes('status code')
    );
    const rowsHeight = tocPage.rows.reduce((sum, r) => sum + r.estimatedHeight, 0);
    if (rowsHeight > 0 && statusCodeColIdx >= 0) {
      const statusCodeColX =
        margin +
        columns
          .slice(0, statusCodeColIdx)
          .reduce((sum, col) => sum + col.width, 0);
      const statusCodeColWidth = columns[statusCodeColIdx].width;

      page.drawRectangle({
        x: statusCodeColX,
        y: headerBottom - rowsHeight,
        width: statusCodeColWidth,
        height: rowsHeight,
        color: rgb(0.65, 0.8, 0.95),
        opacity: 0.35,
      });
    }

    // Draw Data Rows
    for (const row of tocPage.rows) {
      const rowHeight = row.estimatedHeight;
      const rowBottom = currentY - rowHeight;

      // Row outer box and bottom line
      page.drawRectangle({
        x: margin,
        y: rowBottom,
        width: tableWidth,
        height: rowHeight,
        borderColor: rgb(0.75, 0.8, 0.85),
        borderWidth: 0.75,
      });

      // Cell texts
      const cellValues = [
        String(row.componentNumber),
        row.componentName,
        row.submitted,
        row.previouslyApproved,
        row.statusCode,
      ];

      let cellX = margin;
      for (let cIdx = 0; cIdx < columns.length; cIdx++) {
        const col = columns[cIdx];
        const textVal = cellValues[cIdx];
        const textSize = 9;
        const lineHeight = 12;

        if (textVal) {
          const maxChars = Math.floor((col.width - 10) / 5.2);
          const cellLines = wrapTextToLines(textVal, maxChars);
          let lineY = currentY - 14;

          for (const line of cellLines) {
            const lineW = fontRegular.widthOfTextAtSize(line, textSize);
            const textX =
              col.align === 'center'
                ? cellX + (col.width - lineW) / 2
                : cellX + 5;

            page.drawText(line, {
              x: textX,
              y: lineY,
              size: textSize,
              font: fontRegular,
              color: rgb(0.12, 0.15, 0.2),
            });
            lineY -= lineHeight;
          }
        }

        cellX += col.width;
        // Vertical divider
        if (cellX < margin + tableWidth) {
          page.drawLine({
            start: { x: cellX, y: currentY },
            end: { x: cellX, y: rowBottom },
            thickness: 0.75,
            color: rgb(0.75, 0.8, 0.85),
          });
        }
      }

      currentY = rowBottom;
    }

    // Draw Status Codes section below the Table of Contents table on the final page
    if (pageIdx === tocPages.length - 1) {
      const legendGap = 18;
      const legendTitleY = currentY - legendGap;

      page.drawText('Status Codes:', {
        x: margin,
        y: legendTitleY,
        size: 9,
        font: fontBoldOblique,
        color: rgb(0.2, 0.25, 0.35),
      });

      let codeY = legendTitleY - 14;
      for (const statusCodeLine of TOC_STATUS_CODES) {
        page.drawText(statusCodeLine, {
          x: margin,
          y: codeY,
          size: 8.5,
          font: fontRegular,
          color: rgb(0.25, 0.3, 0.38),
        });
        codeY -= 12;
      }
    }
  }

  return doc;
}

/**
 * Stamps continuous "Page {page} of {total}" at the visual bottom-center of every page.
 * Correctly handles non-default CropBox and /Rotate (0, 90, 180, 270 degrees).
 */
export async function stampPageNumbers(
  doc: PDFDocument,
  config: PageNumberStampConfig = defaultStampConfig
): Promise<void> {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const totalPages = doc.getPageCount();
  const fontSize = config.fontSize;
  const bottomMargin = config.bottomMargin;

  for (let i = 0; i < totalPages; i++) {
    const page = doc.getPage(i);
    const cropBox = page.getCropBox();
    const rotationAngle = (page.getRotation().angle % 360 + 360) % 360;

    const pageNumText = config.format
      .replace('{page}', String(i + 1))
      .replace('{total}', String(totalPages));

    const textWidth = font.widthOfTextAtSize(pageNumText, fontSize);
    const { x: x0, y: y0, width: W, height: H } = cropBox;

    let stampX: number;
    let stampY: number;
    let textRotation = 0;

    switch (rotationAngle) {
      case 90:
        // Clockwise 90° viewer rotation
        stampX = x0 + W - bottomMargin;
        stampY = y0 + (H - textWidth) / 2;
        textRotation = 90;
        break;

      case 180:
        // 180° viewer rotation
        stampX = x0 + (W + textWidth) / 2;
        stampY = y0 + H - bottomMargin;
        textRotation = 180;
        break;

      case 270:
        // Clockwise 270° (or 90° CCW) viewer rotation
        stampX = x0 + bottomMargin;
        stampY = y0 + (H + textWidth) / 2;
        textRotation = 270;
        break;

      case 0:
      default:
        // Standard unrotated orientation
        stampX = x0 + (W - textWidth) / 2;
        stampY = y0 + bottomMargin;
        textRotation = 0;
        break;
    }

    page.drawText(pageNumText, {
      x: stampX,
      y: stampY,
      size: fontSize,
      font,
      color: rgb(0.25, 0.3, 0.38),
      rotate: degrees(textRotation),
    });
  }
}

/**
 * Builds hierarchical outline bookmark tree structure for the submittal package.
 * Hierarchy: Component -> Fixture (fixture title = filename without .pdf)
 */
export function buildProjectOutlines(
  project: Project,
  layout: LayoutResult,
  options?: { submittalCoverPageCount?: number }
): OutlineItem[] {
  const outlines: OutlineItem[] = [];
  const submittalCoverPageCount = options?.submittalCoverPageCount ?? 0;

  if (submittalCoverPageCount > 0) {
    outlines.push({
      title: 'Submittal Cover',
      pageNumber: 1,
    });
  }

  outlines.push({
    title: 'Table of Contents',
    pageNumber: submittalCoverPageCount + 1,
  });

  for (let i = 0; i < project.components.length; i++) {
    const comp = project.components[i];
    const compNum = layout.componentNumbers[comp.id] ?? (i + 1);
    const compName = getComponentDisplayName(comp);
    const coverPage = layout.coverPages[comp.id] ?? 1;

    const fixtureOutlines: OutlineItem[] = comp.fixtures.map((fixture) => ({
      title: getFixtureTitle(fixture.path),
      pageNumber: layout.startPages[fixture.id] ?? (coverPage + 1),
    }));

    outlines.push({
      title: `Component ${compNum}: ${compName}`,
      pageNumber: coverPage,
      children: fixtureOutlines.length > 0 ? fixtureOutlines : undefined,
    });
  }

  return outlines;
}

/**
 * Builds the PDF /Outlines dictionary tree from low-level objects.
 * Sets /Parent, /First, /Last, /Prev, /Next, /Title, /Dest on PDF objects.
 */
export async function addOutline(
  doc: PDFDocument,
  outlineItems: OutlineItem[]
): Promise<void> {
  if (outlineItems.length === 0) return;

  const ctx = doc.context;
  const pageCount = doc.getPageCount();

  const outlinesRef = ctx.nextRef();
  let totalVisibleItems = 0;

  function buildLevel(
    items: OutlineItem[],
    parentRef: PDFRef
  ): { firstRef: PDFRef; lastRef: PDFRef; count: number } {
    const itemRefs = items.map(() => ctx.nextRef());
    let levelVisibleCount = items.length;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemRef = itemRefs[i];

      // Safe 1-based to 0-based page index clamping
      const targetPageIndex = Math.max(0, Math.min(pageCount - 1, item.pageNumber - 1));
      const targetPage = doc.getPage(targetPageIndex);
      const destArray = ctx.obj([targetPage.ref, 'Fit']);

      const itemDictEntries: Record<string, any> = {
        Title: PDFHexString.fromText(item.title),
        Parent: parentRef,
        Dest: destArray,
      };

      if (i > 0) {
        itemDictEntries['Prev'] = itemRefs[i - 1];
      }
      if (i < items.length - 1) {
        itemDictEntries['Next'] = itemRefs[i + 1];
      }

      if (item.children && item.children.length > 0) {
        const childLevel = buildLevel(item.children, itemRef);
        itemDictEntries['First'] = childLevel.firstRef;
        itemDictEntries['Last'] = childLevel.lastRef;
        itemDictEntries['Count'] = childLevel.count; // Open state
        levelVisibleCount += childLevel.count;
      }

      ctx.assign(itemRef, ctx.obj(itemDictEntries));
    }

    return {
      firstRef: itemRefs[0],
      lastRef: itemRefs[itemRefs.length - 1],
      count: levelVisibleCount,
    };
  }

  const rootLevel = buildLevel(outlineItems, outlinesRef);
  totalVisibleItems = rootLevel.count;

  const outlinesDict = ctx.obj({
    Type: 'Outlines',
    First: rootLevel.firstRef,
    Last: rootLevel.lastRef,
    Count: totalVisibleItems,
  });

  ctx.assign(outlinesRef, outlinesDict);
  doc.catalog.set(PDFName.of('Outlines'), outlinesRef);
}

export const defaultPdfEngine: PdfEngine = {
  drawComponentCover,
  drawTocPages,
  stampPageNumbers,
  addOutline,
};
