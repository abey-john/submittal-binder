import { describe, expect, it } from 'vitest';
import { parseUploadedFiles } from './fileHelpers';

// Helper to create mock File object
function createMockFile(name: string, webkitRelativePath: string = ''): File {
  const blob = new Blob(['%PDF-1.4 test'], { type: 'application/pdf' });
  const file = new File([blob], name, { type: 'application/pdf' });
  if (webkitRelativePath) {
    Object.defineProperty(file, 'webkitRelativePath', {
      value: webkitRelativePath,
      writable: false,
    });
  }
  return file;
}

describe('fileHelpers and package unwrapping', () => {
  it('unwraps a parent Submittal folder with folders and loose PDFs into components', async () => {
    // Structure matching notes/sample.md:
    // Submittal/Folder1/file1.pdf
    // Submittal/Folder1/file2.pdf
    // Submittal/Folder2/file3.pdf
    // Submittal/Folder2/file4.pdf
    // Submittal/Folder3/file5.pdf
    // Submittal/Folder3/file6.pdf
    // Submittal/file7.pdf
    // Submittal/file8.pdf
    const mockFiles = [
      createMockFile('file1.pdf', 'Submittal/Folder1/file1.pdf'),
      createMockFile('file2.pdf', 'Submittal/Folder1/file2.pdf'),
      createMockFile('file3.pdf', 'Submittal/Folder2/file3.pdf'),
      createMockFile('file4.pdf', 'Submittal/Folder2/file4.pdf'),
      createMockFile('file5.pdf', 'Submittal/Folder3/file5.pdf'),
      createMockFile('file6.pdf', 'Submittal/Folder3/file6.pdf'),
      createMockFile('file7.pdf', 'Submittal/file7.pdf'),
      createMockFile('file8.pdf', 'Submittal/file8.pdf'),
    ];

    const result = await parseUploadedFiles(mockFiles);

    // Should create 5 components: Folder1, Folder2, Folder3, file7, file8
    expect(result.components.length).toBe(5);

    // Natural sort order: Folder1, Folder2, Folder3, file7, file8
    expect(result.components.map((c) => c.sourceName)).toEqual([
      'Folder1',
      'Folder2',
      'Folder3',
      'file7',
      'file8',
    ]);

    // Check fixtures inside each folder component
    const folder1 = result.components.find((c) => c.sourceName === 'Folder1');
    expect(folder1?.fixtures.map((f) => f.path)).toEqual([
      'Folder1/file1.pdf',
      'Folder1/file2.pdf',
    ]);

    const folder2 = result.components.find((c) => c.sourceName === 'Folder2');
    expect(folder2?.fixtures.map((f) => f.path)).toEqual([
      'Folder2/file3.pdf',
      'Folder2/file4.pdf',
    ]);

    // Check loose PDF components
    const file7Comp = result.components.find((c) => c.sourceName === 'file7');
    expect(file7Comp?.fixtures.length).toBe(1);
    expect(file7Comp?.fixtures[0].path).toBe('file7.pdf');

    const file8Comp = result.components.find((c) => c.sourceName === 'file8');
    expect(file8Comp?.fixtures.length).toBe(1);
    expect(file8Comp?.fixtures[0].path).toBe('file8.pdf');

    // No false nested subfolder warnings for direct children of Folder1, Folder2, Folder3
    expect(result.warnings.length).toBe(0);
  });

  it('preserves single component folder when no deeper nesting exists', async () => {
    const mockFiles = [
      createMockFile('spec1.pdf', 'Electrical/spec1.pdf'),
      createMockFile('spec2.pdf', 'Electrical/spec2.pdf'),
    ];

    const result = await parseUploadedFiles(mockFiles);
    expect(result.components.length).toBe(1);
    expect(result.components[0].sourceName).toBe('Electrical');
    expect(result.components[0].fixtures.length).toBe(2);
  });

  it('warns on truly nested subfolders inside a component', async () => {
    const mockFiles = [
      createMockFile('file1.pdf', 'Submittal/Folder1/file1.pdf'),
      createMockFile('nested.pdf', 'Submittal/Folder1/extra_deep/nested.pdf'),
    ];

    const result = await parseUploadedFiles(mockFiles);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain('extra_deep');
  });

  it('handles bulk loose PDFs dropped without folders', async () => {
    const mockFiles = [
      createMockFile('cutsheet_A.pdf', 'cutsheet_A.pdf'),
      createMockFile('cutsheet_B.pdf', 'cutsheet_B.pdf'),
      createMockFile('drawing_C.pdf', 'drawing_C.pdf'),
    ];

    const result = await parseUploadedFiles(mockFiles);
    expect(result.components.length).toBe(3);
    expect(result.components.map((c) => c.sourceName)).toEqual([
      'cutsheet_A',
      'cutsheet_B',
      'drawing_C',
    ]);
  });
});
