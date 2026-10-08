import { describe, expect, it } from 'vitest';
import { computeLayout, paginateToc, wrapTextToLines } from './layout';
import type { Component, Project } from './types';

describe('computeLayout and layout engine', () => {
  const sampleProject: Project = {
    version: 1,
    components: [
      {
        id: 'c1',
        sourceName: 'Folder1',
        nameOverride: 'Custom Folder One',
        previouslyApproved: 'Submittal 001',
        fixtures: [
          { id: 'f1', path: 'Folder1/file1.pdf' },
          { id: 'f2', path: 'Folder1/file2.pdf' },
        ],
      },
      {
        id: 'c2',
        sourceName: 'file3.pdf',
        fixtures: [{ id: 'f3', path: 'file3.pdf' }],
      },
      {
        id: 'c3',
        sourceName: 'Folder2',
        previouslyApproved: 'Spec Section 15000',
        fixtures: [
          { id: 'f4', path: 'Folder2/file4.pdf' },
          { id: 'f5', path: 'Folder2/file5.pdf' },
          { id: 'f6', path: 'Folder2/file6.pdf' },
        ],
      },
    ],
  };

  const samplePageCounts: Record<string, number> = {
    f1: 3,
    f2: 2,
    f3: 5,
    f4: 1,
    f5: 4,
    f6: 2,
  };

  it('computes correct component numbers, cover pages, start pages, and total pages', () => {
    const layout = computeLayout(sampleProject, samplePageCounts);

    // TOC is 1 page (pages 1)
    expect(layout.tocPageCount).toBe(1);

    // Component numbers (1-based from order)
    expect(layout.componentNumbers).toEqual({
      c1: 1,
      c2: 2,
      c3: 3,
    });

    // Component 1 cover is at page 2
    expect(layout.coverPages['c1']).toBe(2);
    expect(layout.startPages['c1']).toBe(2);
    // Fixtures of C1
    expect(layout.startPages['f1']).toBe(3); // 3 pages (3, 4, 5)
    expect(layout.startPages['f2']).toBe(6); // 2 pages (6, 7)

    // Component 2 cover is at page 8
    expect(layout.coverPages['c2']).toBe(8);
    expect(layout.startPages['c2']).toBe(8);
    // Fixture of C2
    expect(layout.startPages['f3']).toBe(9); // 5 pages (9, 10, 11, 12, 13)

    // Component 3 cover is at page 14
    expect(layout.coverPages['c3']).toBe(14);
    expect(layout.startPages['c3']).toBe(14);
    // Fixtures of C3
    expect(layout.startPages['f4']).toBe(15); // 1 page (15)
    expect(layout.startPages['f5']).toBe(16); // 4 pages (16, 17, 18, 19)
    expect(layout.startPages['f6']).toBe(20); // 2 pages (20, 21)

    // Total pages: 1 (TOC) + (1 + 5) + (1 + 5) + (1 + 7) = 21
    expect(layout.totalPages).toBe(21);
  });

  it('updates all numbering and page indices after reordering components', () => {
    // Move c3 to the front: [c3, c1, c2]
    const reorderedProject: Project = {
      ...sampleProject,
      components: [
        sampleProject.components[2],
        sampleProject.components[0],
        sampleProject.components[1],
      ],
    };

    const layout = computeLayout(reorderedProject, samplePageCounts);

    expect(layout.componentNumbers).toEqual({
      c3: 1,
      c1: 2,
      c2: 3,
    });

    // c3 is now first component, cover at page 2
    expect(layout.coverPages['c3']).toBe(2);
    expect(layout.startPages['f4']).toBe(3);
    expect(layout.startPages['f5']).toBe(4);
    expect(layout.startPages['f6']).toBe(8);

    // c1 is next, cover at page 10 (2 + 1 + 7 = 10)
    expect(layout.coverPages['c1']).toBe(10);
    expect(layout.startPages['f1']).toBe(11);
    expect(layout.startPages['f2']).toBe(14);

    // c2 is last, cover at page 16 (10 + 1 + 5 = 16)
    expect(layout.coverPages['c2']).toBe(16);
    expect(layout.startPages['f3']).toBe(17);

    // Total pages remain 21
    expect(layout.totalPages).toBe(21);
  });

  it('updates numbering and total pages after deleting a component', () => {
    // Delete c2: [c1, c3]
    const deletedProject: Project = {
      ...sampleProject,
      components: [sampleProject.components[0], sampleProject.components[2]],
    };

    const layout = computeLayout(deletedProject, samplePageCounts);

    expect(layout.componentNumbers).toEqual({
      c1: 1,
      c3: 2,
    });

    expect(layout.coverPages['c1']).toBe(2);
    // c3 cover starts right after c1 (cover: 2 + 1, f1: 3, f2: 2 -> next is 2 + 1 + 5 = 8)
    expect(layout.coverPages['c3']).toBe(8);
    // Total pages = 21 - (1 cover + 5 pages of f3) = 15
    expect(layout.totalPages).toBe(15);
  });

  it('updates start pages after moving a fixture between components', () => {
    // Move f3 from c2 into c1 as the last fixture
    const movedProject: Project = {
      version: 1,
      components: [
        {
          ...sampleProject.components[0],
          fixtures: [
            ...sampleProject.components[0].fixtures,
            sampleProject.components[1].fixtures[0], // f3
          ],
        },
        {
          ...sampleProject.components[1],
          fixtures: [], // c2 now has no fixtures
        },
        sampleProject.components[2],
      ],
    };

    const layout = computeLayout(movedProject, samplePageCounts);

    // c1 has f1 (3 pages), f2 (2 pages), f3 (5 pages)
    expect(layout.coverPages['c1']).toBe(2);
    expect(layout.startPages['f1']).toBe(3);
    expect(layout.startPages['f2']).toBe(6);
    expect(layout.startPages['f3']).toBe(8); // 8 .. 12

    // c2 has empty fixtures, cover at page 13
    expect(layout.coverPages['c2']).toBe(13);

    // c3 cover starts at page 14 (13 + 1)
    expect(layout.coverPages['c3']).toBe(14);
    expect(layout.startPages['f4']).toBe(15);

    // Total pages still 21
    expect(layout.totalPages).toBe(21);
  });

  it('respects submittalCoverPageCount extension point', () => {
    const layout = computeLayout(sampleProject, samplePageCounts, {
      submittalCoverPageCount: 2,
    });

    // Submittal covers: pages 1, 2
    // TOC: page 3
    expect(layout.tocPageCount).toBe(1);
    // Component 1 cover: page 4 (2 + 1 + 1 = 4)
    expect(layout.coverPages['c1']).toBe(4);
    expect(layout.startPages['f1']).toBe(5);

    // Total pages = 21 + 2 = 23
    expect(layout.totalPages).toBe(23);
  });

  it('paginates TOC across multiple pages when rows exceed single page height', () => {
    // Create 40 components with long descriptions
    const manyComponents: Component[] = Array.from({ length: 45 }, (_, i) => ({
      id: `c_${i + 1}`,
      sourceName: `Component Item ${i + 1} with a relatively detailed long descriptive name for testing wrap`,
      previouslyApproved: `Previously reviewed and stamped in submittal revision package #${i + 100}`,
      fixtures: [{ id: `f_${i + 1}`, path: `file_${i + 1}.pdf` }],
    }));

    const bigProject: Project = {
      version: 1,
      components: manyComponents,
    };

    const tocPages = paginateToc(bigProject.components);
    // 45 components with long descriptions will span multiple pages
    expect(tocPages.length).toBeGreaterThan(1);

    const layout = computeLayout(bigProject, {});
    expect(layout.tocPageCount).toBe(tocPages.length);

    // Component 1 cover starts right after the multi-page TOC
    expect(layout.coverPages['c_1']).toBe(layout.tocPageCount + 1);

    // Verify all rows are accounted for across all TOC pages
    const totalRowsCount = tocPages.reduce((acc, p) => acc + p.rows.length, 0);
    expect(totalRowsCount).toBe(45);
  });

  it('handles empty components gracefully', () => {
    const emptyProject: Project = {
      version: 1,
      components: [],
    };

    const layout = computeLayout(emptyProject, {});
    expect(layout.tocPageCount).toBe(1);
    expect(layout.totalPages).toBe(1);
    expect(layout.componentNumbers).toEqual({});
  });

  it('correctly wraps long text in table cells', () => {
    const text = 'This is a long line of description that should wrap into multiple lines for the table of contents';
    const lines = wrapTextToLines(text, 25);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(30); // reasonable word boundary
    }
  });

  it('reserves space for Status Codes legend on final TOC page', () => {
    // 25 components with standard height (24 pt each) = 600 pt
    // firstPageUsableHeight = 792 - 72 - 50 - 28 = 642 pt
    // Without legend: 25 * 24 = 600 <= 642 pt -> fits on 1 page
    // With legend (90 pt): 600 + 90 = 690 > 642 pt -> spills to page 2
    const components: Component[] = Array.from({ length: 25 }, (_, i) => ({
      id: `c_${i + 1}`,
      sourceName: `Comp ${i + 1}`,
      fixtures: [],
    }));

    const pagesWithLegend = paginateToc(components);
    expect(pagesWithLegend.length).toBe(2);

    const pagesWithoutLegend = paginateToc(components, { legendHeight: 0 });
    expect(pagesWithoutLegend.length).toBe(1);
  });
});
