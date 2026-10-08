import {
  type Component,
  getComponentDisplayName,
  type LayoutOptions,
  type LayoutResult,
  type Project,
  type TocLayoutOptions,
  type TocPage,
  type TocRow,
} from './types';

/**
 * Splits text into lines based on approximate character width wrap.
 */
export function wrapTextToLines(text: string, maxCharsPerLine: number): string[] {
  if (!text || text.trim() === '') return [''];
  const paragraphs = text.split(/\r?\n/);
  const resultLines: string[] = [];

  for (const para of paragraphs) {
    if (para.length <= maxCharsPerLine) {
      resultLines.push(para);
      continue;
    }
    const words = para.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      if (!currentLine) {
        currentLine = word;
      } else if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
        currentLine += ' ' + word;
      } else {
        resultLines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      resultLines.push(currentLine);
    }
  }

  return resultLines.length > 0 ? resultLines : [''];
}

/**
 * Calculates estimated height for a TOC row in points.
 */
export function estimateTocRowHeight(
  componentName: string,
  previouslyApproved: string,
  options?: TocLayoutOptions
): number {
  const baseRowHeight = options?.baseRowHeight ?? 24;
  const lineHeight = options?.lineHeight ?? 14;

  // Approx character limits for column widths:
  // Component Name (180 pt) ~ 28 chars
  // Where Previously Approved (140 pt) ~ 22 chars
  const nameLines = wrapTextToLines(componentName, 28).length;
  const prevApprovedLines = wrapTextToLines(previouslyApproved, 22).length;
  const maxLines = Math.max(1, nameLines, prevApprovedLines);

  return baseRowHeight + (maxLines - 1) * lineHeight;
}

/**
 * Pure TOC pagination function shared between computeLayout and PDF renderer.
 * Guarantees that layout and renderer never disagree on TOC page count or row distribution.
 */
export function paginateToc(
  components: Component[],
  options?: TocLayoutOptions
): TocPage[] {
  const pageHeight = options?.pageHeight ?? 792; // Letter height
  const margin = options?.margin ?? 36;
  const titleHeight = options?.titleHeight ?? 50;
  const headerRowHeight = options?.headerRowHeight ?? 28;

  const firstPageUsableHeight = pageHeight - margin * 2 - titleHeight - headerRowHeight;
  const subsequentUsableHeight = pageHeight - margin * 2 - headerRowHeight;

  if (components.length === 0) {
    return [{ pageIndex: 0, rows: [] }];
  }

  const pages: TocPage[] = [];
  let currentPageRows: TocRow[] = [];
  let currentPageHeight = 0;
  let isFirstPage = true;

  for (let i = 0; i < components.length; i++) {
    const comp = components[i];
    const compNumber = i + 1;
    const compName = getComponentDisplayName(comp);
    const prevApproved = comp.previouslyApproved ?? '';
    const rowHeight = estimateTocRowHeight(compName, prevApproved, options);

    const row: TocRow = {
      componentId: comp.id,
      componentNumber: compNumber,
      componentName: compName,
      submitted: 'Yes',
      previouslyApproved: prevApproved,
      statusCode: '',
      estimatedHeight: rowHeight,
    };

    const maxAllowedHeight = isFirstPage ? firstPageUsableHeight : subsequentUsableHeight;

    // Check if adding this row exceeds page capacity (and page already has at least one row)
    if (currentPageRows.length > 0 && currentPageHeight + rowHeight > maxAllowedHeight) {
      pages.push({
        pageIndex: pages.length,
        rows: currentPageRows,
      });
      currentPageRows = [row];
      currentPageHeight = rowHeight;
      isFirstPage = false;
    } else {
      currentPageRows.push(row);
      currentPageHeight += rowHeight;
    }
  }

  if (currentPageRows.length > 0 || pages.length === 0) {
    pages.push({
      pageIndex: pages.length,
      rows: currentPageRows,
    });
  }

  return pages;
}

/**
 * Pure, framework-free module that computes all numbering, covers, start pages, and total pages.
 *
 * @param project The submittal Project (components & fixtures)
 * @param pageCounts Map or Record of fixture page counts (by fixture.id or fixture.path)
 * @param options Optional submittal cover page count and TOC layout options
 */
export function computeLayout(
  project: Project,
  pageCounts: Record<string, number> = {},
  options?: LayoutOptions
): LayoutResult {
  const submittalCoverPageCount = Math.max(0, options?.submittalCoverPageCount ?? 0);
  const tocPages = paginateToc(project.components, options?.tocOptions);
  const tocPageCount = Math.max(1, tocPages.length);

  const componentNumbers: Record<string, number> = {};
  const coverPages: Record<string, number> = {};
  const startPages: Record<string, number> = {};

  let currentPage = submittalCoverPageCount + tocPageCount + 1;

  for (let i = 0; i < project.components.length; i++) {
    const comp = project.components[i];
    const compNumber = i + 1;

    componentNumbers[comp.id] = compNumber;
    coverPages[comp.id] = currentPage;
    startPages[comp.id] = currentPage; // Component starts on its cover page

    currentPage += 1; // Component cover page is 1 page

    for (const fixture of comp.fixtures) {
      const fixturePages = Math.max(
        1,
        pageCounts[fixture.id] ?? pageCounts[fixture.path] ?? 1
      );
      startPages[fixture.id] = currentPage;
      currentPage += fixturePages;
    }
  }

  const totalPages = currentPage - 1;

  return {
    componentNumbers,
    coverPages,
    startPages,
    tocPageCount,
    totalPages,
    tocPages,
  };
}
