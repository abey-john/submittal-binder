import {
  degrees,
  PDFDocument,
  rgb,
  StandardFonts,
} from 'pdf-lib';
import type {
  OutlineItem,
  PageNumberStampConfig,
  TocLayoutOptions,
  TocPage,
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
 * Stub outline bookmark generator (to be completed in Milestone 5)
 */
export async function addOutline(
  _doc: PDFDocument,
  _outline: OutlineItem[]
): Promise<void> {
  // Milestone 5 bookmarks implementation
}

export const defaultPdfEngine: PdfEngine = {
  drawComponentCover,
  drawTocPages,
  stampPageNumbers,
  addOutline,
};
