import type { Component, Fixture } from '../core/types';
import { naturalCompare } from './naturalSort';

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'id_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

export type ParseFilesResult = {
  components: Component[];
  fileMap: Map<string, File>; // fixture.id -> File
  warnings: string[];
};

/**
 * Parses files from folder upload input or drop zone.
 * Follows rules:
 * - Each top-level folder becomes a component, with its direct PDF children as fixtures.
 * - Warns on nested subfolders (e.g. folder/subfolder/file.pdf).
 * - Ignores non-PDF files.
 * - Each loose PDF becomes its own component with 1 fixture.
 * - Initial order: natural sort (localeCompare with numeric: true).
 */
export async function parseUploadedFiles(
  files: File[],
  relativePathMap?: Map<File, string>
): Promise<ParseFilesResult> {
  const warnings: string[] = [];
  const fileMap = new Map<string, File>();

  // Map folderName -> list of direct PDF files
  const folderDirectPdfs = new Map<string, { filename: string; path: string; file: File }[]>();
  // Loose PDF files
  const loosePdfs: { filename: string; path: string; file: File }[] = [];

  const seenNestedSubfolders = new Set<string>();

  for (const file of files) {
    const rawPath = relativePathMap?.get(file) || file.webkitRelativePath || file.name;
    // Normalize path separators to forward slashes
    const normalizedPath = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
    const parts = normalizedPath.split('/').filter(Boolean);

    // If loose file (no folder in path)
    if (parts.length === 1) {
      if (parts[0].toLowerCase().endsWith('.pdf')) {
        loosePdfs.push({
          filename: parts[0],
          path: parts[0],
          file,
        });
      }
      continue;
    }

    // parts.length >= 2 (inside a folder)
    const topLevelFolder = parts[0];

    // If nested subfolder (e.g. parts.length > 2)
    if (parts.length > 2) {
      const subfolderKey = `${topLevelFolder}/${parts.slice(1, -1).join('/')}`;
      if (!seenNestedSubfolders.has(subfolderKey)) {
        seenNestedSubfolders.add(subfolderKey);
        warnings.push(`Nested subfolder "${subfolderKey}" was ignored. Binder only includes direct PDF files of top-level folders.`);
      }
      continue;
    }

    // Direct child of top-level folder (parts.length === 2)
    const filename = parts[1];
    if (filename.toLowerCase().endsWith('.pdf')) {
      if (!folderDirectPdfs.has(topLevelFolder)) {
        folderDirectPdfs.set(topLevelFolder, []);
      }
      folderDirectPdfs.get(topLevelFolder)!.push({
        filename,
        path: `${topLevelFolder}/${filename}`,
        file,
      });
    }
  }

  const components: Component[] = [];

  // 1. Process top-level folders
  const sortedFolderNames = Array.from(folderDirectPdfs.keys()).sort(naturalCompare);
  for (const folderName of sortedFolderNames) {
    const pdfItems = folderDirectPdfs.get(folderName) ?? [];
    if (pdfItems.length === 0) continue;

    // Natural sort fixtures within folder
    pdfItems.sort((a, b) => naturalCompare(a.filename, b.filename));

    const fixtures: Fixture[] = pdfItems.map((item) => {
      const fixtureId = generateId();
      fileMap.set(fixtureId, item.file);
      return {
        id: fixtureId,
        path: item.path,
      };
    });

    components.push({
      id: generateId(),
      sourceName: folderName,
      fixtures,
    });
  }

  // 2. Process loose PDFs (each becomes its own component)
  loosePdfs.sort((a, b) => naturalCompare(a.filename, b.filename));
  for (const item of loosePdfs) {
    const fixtureId = generateId();
    fileMap.set(fixtureId, item.file);

    const sourceName = item.filename.replace(/\.pdf$/i, '');
    components.push({
      id: generateId(),
      sourceName,
      fixtures: [
        {
          id: fixtureId,
          path: item.path,
        },
      ],
    });
  }

  return { components, fileMap, warnings };
}

/**
 * Recursively extracts files from DataTransferItems using webkitGetAsEntry
 */
export async function extractFilesFromDataTransfer(
  items: DataTransferItemList
): Promise<{ files: File[]; relativePathMap: Map<File, string> }> {
  const files: File[] = [];
  const relativePathMap = new Map<File, string>();

  async function readEntry(entry: any, currentPath: string): Promise<void> {
    if (!entry) return;

    if (entry.isFile) {
      return new Promise<void>((resolve) => {
        entry.file(
          (file: File) => {
            const relPath = currentPath ? `${currentPath}/${file.name}` : file.name;
            relativePathMap.set(file, relPath);
            files.push(file);
            resolve();
          },
          () => resolve()
        );
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const entries = await new Promise<any[]>((resolve) => {
        const result: any[] = [];
        function readNext() {
          dirReader.readEntries(
            (batch: any[]) => {
              if (batch.length === 0) {
                resolve(result);
              } else {
                result.push(...batch);
                readNext();
              }
            },
            () => resolve(result)
          );
        }
        readNext();
      });

      const nextPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
      for (const child of entries) {
        await readEntry(child, nextPath);
      }
    }
  }

  const entriesToRead: any[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (typeof item.webkitGetAsEntry === 'function') {
      const entry = item.webkitGetAsEntry();
      if (entry) entriesToRead.push(entry);
    } else {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }

  for (const entry of entriesToRead) {
    await readEntry(entry, '');
  }

  return { files, relativePathMap };
}
