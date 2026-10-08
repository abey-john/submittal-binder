import { describe, expect, it } from 'vitest';
import { matchProjectFiles } from './relinkHelper';
import type { Project } from '../core/types';

function createMockFile(name: string, webkitRelativePath: string = ''): File {
  const blob = new Blob(['%PDF-1.4 mock'], { type: 'application/pdf' });
  const file = new File([blob], name, { type: 'application/pdf' });
  if (webkitRelativePath) {
    Object.defineProperty(file, 'webkitRelativePath', {
      value: webkitRelativePath,
      writable: false,
    });
  }
  return file;
}

describe('relinkHelper: Matching fixtures to disk files', () => {
  const sampleProject: Project = {
    version: 1,
    components: [
      {
        id: 'c1',
        sourceName: 'Folder1',
        fixtures: [
          { id: 'f1', path: 'Folder1/file1.pdf' },
          { id: 'f2', path: 'Folder1/file2.pdf' },
        ],
      },
      {
        id: 'c2',
        sourceName: 'file3',
        fixtures: [{ id: 'f3', path: 'file3.pdf' }],
      },
    ],
  };

  it('correctly matches fixtures when parent submittal folder is re-selected', () => {
    const candidateFiles = [
      createMockFile('file1.pdf', 'Submittal/Folder1/file1.pdf'),
      createMockFile('file2.pdf', 'Submittal/Folder1/file2.pdf'),
      createMockFile('file3.pdf', 'Submittal/file3.pdf'),
    ];

    const result = matchProjectFiles(sampleProject, candidateFiles);

    expect(result.totalFixtures).toBe(3);
    expect(result.linkedCount).toBe(3);
    expect(result.missingCount).toBe(0);
    expect(result.matchedFiles['f1']).toBeDefined();
    expect(result.matchedFiles['f2']).toBeDefined();
    expect(result.matchedFiles['f3']).toBeDefined();
  });

  it('accurately identifies missing files when only a subset is provided', () => {
    // Only file1.pdf is provided; file2.pdf and file3.pdf are missing
    const candidateFiles = [
      createMockFile('file1.pdf', 'Folder1/file1.pdf'),
    ];

    const result = matchProjectFiles(sampleProject, candidateFiles);

    expect(result.totalFixtures).toBe(3);
    expect(result.linkedCount).toBe(1);
    expect(result.missingCount).toBe(2);

    const f1Status = result.fixtureStatuses.find((s) => s.fixtureId === 'f1');
    expect(f1Status?.isLinked).toBe(true);

    const f2Status = result.fixtureStatuses.find((s) => s.fixtureId === 'f2');
    expect(f2Status?.isLinked).toBe(false);

    const f3Status = result.fixtureStatuses.find((s) => s.fixtureId === 'f3');
    expect(f3Status?.isLinked).toBe(false);
  });

  it('matches loose PDFs by filename fallback', () => {
    const candidateFiles = [
      createMockFile('file3.pdf', 'some/other/path/file3.pdf'),
    ];

    const result = matchProjectFiles(sampleProject, candidateFiles);
    expect(result.matchedFiles['f3']).toBeDefined();
  });
});
