import { z } from 'zod';

export const FixtureSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1), // e.g. "folder/file.pdf" or "file.pdf"
});

export const ComponentSchema = z.object({
  id: z.string().min(1),
  sourceName: z.string().min(1), // folder name, or filename without .pdf
  nameOverride: z.string().optional(), // display name = nameOverride ?? sourceName
  previouslyApproved: z.string().optional(), // text for the TOC column
  fixtures: z.array(FixtureSchema),
});

export const ProjectSchema = z.object({
  version: z.literal(1),
  components: z.array(ComponentSchema),
});

export type Fixture = z.infer<typeof FixtureSchema>;
export type Component = z.infer<typeof ComponentSchema>;
export type Project = z.infer<typeof ProjectSchema>;

/** Helper to get display name: nameOverride ?? sourceName */
export function getComponentDisplayName(component: Pick<Component, 'sourceName' | 'nameOverride'>): string {
  if (component.nameOverride && component.nameOverride.trim() !== '') {
    return component.nameOverride.trim();
  }
  return component.sourceName;
}

/** Helper to extract fixture title: filename without .pdf */
export function getFixtureTitle(path: string): string {
  const filename = path.split('/').pop()?.split('\\').pop() ?? path;
  return filename.replace(/\.pdf$/i, '');
}

export type TocRow = {
  componentId: string;
  componentNumber: number;
  componentName: string;
  submitted: 'Yes';
  previouslyApproved: string;
  statusCode: ''; // blank status cell for reviewer
  estimatedHeight: number; // in points
};

export type TocPage = {
  pageIndex: number; // 0-based among TOC pages
  rows: TocRow[];
};

export type TocLayoutOptions = {
  pageWidth?: number; // default Letter width 612
  pageHeight?: number; // default Letter height 792
  margin?: number; // default 36 pt (0.5 in)
  titleHeight?: number; // default 50 pt on first page
  headerRowHeight?: number; // default 28 pt
  baseRowHeight?: number; // default 24 pt
  lineHeight?: number; // default 14 pt
  legendHeight?: number; // default 90 pt
  maxRowsPerPageFirstPage?: number; // optional manual override
  maxRowsPerPageSubsequent?: number; // optional manual override
};

export type LayoutOptions = {
  submittalCoverPageCount?: number; // default 0
  tocOptions?: TocLayoutOptions;
};

export type LayoutResult = {
  componentNumbers: Record<string, number>; // component.id -> 1-based component number
  coverPages: Record<string, number>; // component.id -> 1-based page number of cover
  startPages: Record<string, number>; // component.id & fixture.id -> 1-based start page
  tocPageCount: number;
  totalPages: number;
  tocPages: TocPage[];
};

export type PageNumberStampConfig = {
  fontSize: number; // e.g. 9 pt
  bottomMargin: number; // e.g. 28 pt
  format: string; // e.g. "Page {page} of {total}"
};

export type OutlineItem = {
  title: string;
  pageNumber: number; // 1-based target page
  children?: OutlineItem[];
};
