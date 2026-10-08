import type { Project } from '../core/types';
import { unwrapPackageRoot } from './fileHelpers';

export type FixtureStatus = {
  fixtureId: string;
  path: string;
  componentId: string;
  componentName: string;
  isLinked: boolean;
  file?: File;
};

export type RelinkMatchResult = {
  totalFixtures: number;
  linkedCount: number;
  missingCount: number;
  matchedFiles: Record<string, File>; // fixtureId -> File
  fixtureStatuses: FixtureStatus[];
};

/**
 * Normalizes a file path for robust matching (converts backslashes, trims slashes).
 */
export function normalizePathForMatching(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').trim().toLowerCase();
}

/**
 * Matches project fixtures to candidate files by relative path or filename.
 */
export function matchProjectFiles(
  project: Project,
  candidateFiles: File[],
  existingFileMap: Record<string, File> = {}
): RelinkMatchResult {
  // 1. Unwrap common root prefix if a parent folder was picked
  const rawItems = candidateFiles.map((file) => ({
    file,
    rawPath: file.webkitRelativePath || file.name,
  }));
  const unwrapped = unwrapPackageRoot(rawItems);

  // Index candidate files by exact normalized path and filename
  const candidatesByExactPath = new Map<string, File>();
  const candidatesByFilename = new Map<string, File>();

  for (const item of unwrapped) {
    const norm = normalizePathForMatching(item.normalizedPath);
    candidatesByExactPath.set(norm, item.file);

    const filename = normalizePathForMatching(item.file.name);
    if (!candidatesByFilename.has(filename)) {
      candidatesByFilename.set(filename, item.file);
    }
  }

  const matchedFiles: Record<string, File> = {};
  const fixtureStatuses: FixtureStatus[] = [];
  let linkedCount = 0;
  let totalFixtures = 0;

  for (const comp of project.components) {
    const compName = comp.nameOverride ?? comp.sourceName;

    for (const fixture of comp.fixtures) {
      totalFixtures++;
      const normFixPath = normalizePathForMatching(fixture.path);
      const fixFilename = normalizePathForMatching(
        fixture.path.split('/').pop()?.split('\\').pop() ?? fixture.path
      );

      // Check existing file reference first
      let matchedFile: File | undefined = existingFileMap[fixture.id];

      // If not already in fileMap, check candidate files
      if (!matchedFile) {
        matchedFile =
          candidatesByExactPath.get(normFixPath) ||
          candidatesByFilename.get(fixFilename);
      }

      const isLinked = Boolean(matchedFile);
      if (matchedFile) {
        linkedCount++;
        matchedFiles[fixture.id] = matchedFile;
      }

      fixtureStatuses.push({
        fixtureId: fixture.id,
        path: fixture.path,
        componentId: comp.id,
        componentName: compName,
        isLinked,
        file: matchedFile,
      });
    }
  }

  return {
    totalFixtures,
    linkedCount,
    missingCount: totalFixtures - linkedCount,
    matchedFiles,
    fixtureStatuses,
  };
}
