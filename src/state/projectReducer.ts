import type { Component, Fixture, Project } from '../core/types';
import type { PdfMetadata } from '../utils/pdfMeta';

export type ProjectAction =
  | { type: 'SET_PROJECT'; payload: { project: Project; fileMap?: Record<string, File>; metadataMap?: Record<string, PdfMetadata> } }
  | { type: 'ADD_COMPONENTS'; payload: { components: Component[]; files?: Record<string, File>; metadata?: Record<string, PdfMetadata> } }
  | { type: 'REORDER_COMPONENTS'; payload: { activeId: string; overId: string } }
  | { type: 'REORDER_FIXTURES'; payload: { componentId: string; activeId: string; overId: string } }
  | { type: 'MOVE_FIXTURE'; payload: { sourceComponentId: string; targetComponentId: string; fixtureId: string; targetIndex?: number } }
  | { type: 'INSERT_FIXTURE'; payload: { targetComponentId: string; fixture: Fixture; file?: File; meta?: PdfMetadata } }
  | { type: 'DELETE_FIXTURE'; payload: { componentId: string; fixtureId: string } }
  | { type: 'DELETE_COMPONENT'; payload: { componentId: string } }
  | { type: 'RENAME_COMPONENT'; payload: { componentId: string; nameOverride: string } }
  | { type: 'UPDATE_PREVIOUSLY_APPROVED'; payload: { componentId: string; previouslyApproved: string } }
  | { type: 'UPDATE_FIXTURE_META'; payload: { fixtureId: string; meta: Partial<PdfMetadata> } }
  | { type: 'REGISTER_FILES'; payload: { fileMap: Record<string, File>; metadataMap?: Record<string, PdfMetadata> } }
  | { type: 'ADD_WARNINGS'; payload: { warnings: string[] } }
  | { type: 'DISMISS_WARNING'; payload: { index: number } }
  | { type: 'CLEAR_WARNINGS' }
  | { type: 'UNDO' }
  | { type: 'REDO' };

export type ProjectState = {
  project: Project;
  history: {
    past: Project[];
    future: Project[];
  };
  fileMap: Record<string, File>; // keyed by fixture.id
  metadataMap: Record<string, PdfMetadata>; // keyed by fixture.id
  warnings: string[];
};

export const initialProject: Project = {
  version: 1,
  components: [],
};

export const initialProjectState: ProjectState = {
  project: initialProject,
  history: {
    past: [],
    future: [],
  },
  fileMap: {},
  metadataMap: {},
  warnings: [],
};

const MAX_HISTORY_LENGTH = 50;

function pushToHistory(state: ProjectState, nextProject: Project): ProjectState {
  if (state.project === nextProject) return state;
  const newPast = [...state.history.past, state.project];
  if (newPast.length > MAX_HISTORY_LENGTH) {
    newPast.shift();
  }
  return {
    ...state,
    project: nextProject,
    history: {
      past: newPast,
      future: [], // New user edit clears redo branch
    },
  };
}

export function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case 'SET_PROJECT': {
      const nextProject = action.payload.project;
      const nextFileMap = action.payload.fileMap ? { ...state.fileMap, ...action.payload.fileMap } : state.fileMap;
      const nextMetaMap = action.payload.metadataMap ? { ...state.metadataMap, ...action.payload.metadataMap } : state.metadataMap;

      const newPast = [...state.history.past, state.project];
      return {
        ...state,
        project: nextProject,
        fileMap: nextFileMap,
        metadataMap: nextMetaMap,
        history: {
          past: newPast,
          future: [],
        },
      };
    }

    case 'ADD_COMPONENTS': {
      const nextProject: Project = {
        ...state.project,
        components: [...state.project.components, ...action.payload.components],
      };
      const nextFileMap = action.payload.files ? { ...state.fileMap, ...action.payload.files } : state.fileMap;
      const nextMetaMap = action.payload.metadata ? { ...state.metadataMap, ...action.payload.metadata } : state.metadataMap;

      return {
        ...pushToHistory(state, nextProject),
        fileMap: nextFileMap,
        metadataMap: nextMetaMap,
      };
    }

    case 'REORDER_COMPONENTS': {
      const { activeId, overId } = action.payload;
      if (activeId === overId) return state;

      const oldIndex = state.project.components.findIndex((c) => c.id === activeId);
      const newIndex = state.project.components.findIndex((c) => c.id === overId);
      if (oldIndex === -1 || newIndex === -1) return state;

      const updated = [...state.project.components];
      const [moved] = updated.splice(oldIndex, 1);
      updated.splice(newIndex, 0, moved);

      return pushToHistory(state, {
        ...state.project,
        components: updated,
      });
    }

    case 'REORDER_FIXTURES': {
      const { componentId, activeId, overId } = action.payload;
      if (activeId === overId) return state;

      const compIndex = state.project.components.findIndex((c) => c.id === componentId);
      if (compIndex === -1) return state;

      const comp = state.project.components[compIndex];
      const oldIndex = comp.fixtures.findIndex((f) => f.id === activeId);
      const newIndex = comp.fixtures.findIndex((f) => f.id === overId);
      if (oldIndex === -1 || newIndex === -1) return state;

      const updatedFixtures = [...comp.fixtures];
      const [moved] = updatedFixtures.splice(oldIndex, 1);
      updatedFixtures.splice(newIndex, 0, moved);

      const updatedComponents = [...state.project.components];
      updatedComponents[compIndex] = {
        ...comp,
        fixtures: updatedFixtures,
      };

      return pushToHistory(state, {
        ...state.project,
        components: updatedComponents,
      });
    }

    case 'MOVE_FIXTURE': {
      const { sourceComponentId, targetComponentId, fixtureId, targetIndex } = action.payload;
      const sourceCompIndex = state.project.components.findIndex((c) => c.id === sourceComponentId);
      const targetCompIndex = state.project.components.findIndex((c) => c.id === targetComponentId);
      if (sourceCompIndex === -1 || targetCompIndex === -1) return state;

      const sourceComp = state.project.components[sourceCompIndex];
      const targetComp = state.project.components[targetCompIndex];
      const fixIndex = sourceComp.fixtures.findIndex((f) => f.id === fixtureId);
      if (fixIndex === -1) return state;

      const fixture = sourceComp.fixtures[fixIndex];

      const newSourceFixtures = sourceComp.fixtures.filter((f) => f.id !== fixtureId);
      const newTargetFixtures = [...targetComp.fixtures];
      if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex <= newTargetFixtures.length) {
        newTargetFixtures.splice(targetIndex, 0, fixture);
      } else {
        newTargetFixtures.push(fixture);
      }

      const updatedComponents = [...state.project.components];
      if (sourceComponentId === targetComponentId) {
        // Reordering within same component
        updatedComponents[sourceCompIndex] = {
          ...sourceComp,
          fixtures: newTargetFixtures,
        };
      } else {
        updatedComponents[sourceCompIndex] = {
          ...sourceComp,
          fixtures: newSourceFixtures,
        };
        updatedComponents[targetCompIndex] = {
          ...targetComp,
          fixtures: newTargetFixtures,
        };
      }

      return pushToHistory(state, {
        ...state.project,
        components: updatedComponents,
      });
    }

    case 'INSERT_FIXTURE': {
      const { targetComponentId, fixture, file, meta } = action.payload;
      const compIndex = state.project.components.findIndex((c) => c.id === targetComponentId);
      if (compIndex === -1) return state;

      const comp = state.project.components[compIndex];
      const updatedComponents = [...state.project.components];
      updatedComponents[compIndex] = {
        ...comp,
        fixtures: [...comp.fixtures, fixture],
      };

      const nextFileMap = file ? { ...state.fileMap, [fixture.id]: file } : state.fileMap;
      const nextMetaMap = meta ? { ...state.metadataMap, [fixture.id]: meta } : state.metadataMap;

      return {
        ...pushToHistory(state, {
          ...state.project,
          components: updatedComponents,
        }),
        fileMap: nextFileMap,
        metadataMap: nextMetaMap,
      };
    }

    case 'DELETE_FIXTURE': {
      const { componentId, fixtureId } = action.payload;
      const compIndex = state.project.components.findIndex((c) => c.id === componentId);
      if (compIndex === -1) return state;

      const comp = state.project.components[compIndex];
      const updatedComponents = [...state.project.components];
      updatedComponents[compIndex] = {
        ...comp,
        fixtures: comp.fixtures.filter((f) => f.id !== fixtureId),
      };

      return pushToHistory(state, {
        ...state.project,
        components: updatedComponents,
      });
    }

    case 'DELETE_COMPONENT': {
      const { componentId } = action.payload;
      const updatedComponents = state.project.components.filter((c) => c.id !== componentId);

      return pushToHistory(state, {
        ...state.project,
        components: updatedComponents,
      });
    }

    case 'RENAME_COMPONENT': {
      const { componentId, nameOverride } = action.payload;
      const compIndex = state.project.components.findIndex((c) => c.id === componentId);
      if (compIndex === -1) return state;

      const comp = state.project.components[compIndex];
      const updatedComponents = [...state.project.components];
      updatedComponents[compIndex] = {
        ...comp,
        nameOverride: nameOverride.trim() !== '' ? nameOverride.trim() : undefined,
      };

      return pushToHistory(state, {
        ...state.project,
        components: updatedComponents,
      });
    }

    case 'UPDATE_PREVIOUSLY_APPROVED': {
      const { componentId, previouslyApproved } = action.payload;
      const compIndex = state.project.components.findIndex((c) => c.id === componentId);
      if (compIndex === -1) return state;

      const comp = state.project.components[compIndex];
      const updatedComponents = [...state.project.components];
      updatedComponents[compIndex] = {
        ...comp,
        previouslyApproved: previouslyApproved.trim() !== '' ? previouslyApproved : undefined,
      };

      return pushToHistory(state, {
        ...state.project,
        components: updatedComponents,
      });
    }

    case 'UPDATE_FIXTURE_META': {
      const { fixtureId, meta } = action.payload;
      const existing = state.metadataMap[fixtureId] || { pageCount: 1 };
      return {
        ...state,
        metadataMap: {
          ...state.metadataMap,
          [fixtureId]: {
            ...existing,
            ...meta,
          },
        },
      };
    }

    case 'REGISTER_FILES': {
      return {
        ...state,
        fileMap: {
          ...state.fileMap,
          ...action.payload.fileMap,
        },
        metadataMap: {
          ...state.metadataMap,
          ...(action.payload.metadataMap || {}),
        },
      };
    }

    case 'ADD_WARNINGS': {
      return {
        ...state,
        warnings: [...state.warnings, ...action.payload.warnings],
      };
    }

    case 'DISMISS_WARNING': {
      const nextWarnings = state.warnings.filter((_, i) => i !== action.payload.index);
      return {
        ...state,
        warnings: nextWarnings,
      };
    }

    case 'CLEAR_WARNINGS': {
      return {
        ...state,
        warnings: [],
      };
    }

    case 'UNDO': {
      if (state.history.past.length === 0) return state;

      const previous = state.history.past[state.history.past.length - 1];
      const newPast = state.history.past.slice(0, -1);
      const newFuture = [state.project, ...state.history.future];

      return {
        ...state,
        project: previous,
        history: {
          past: newPast,
          future: newFuture,
        },
      };
    }

    case 'REDO': {
      if (state.history.future.length === 0) return state;

      const next = state.history.future[0];
      const newFuture = state.history.future.slice(1);
      const newPast = [...state.history.past, state.project];

      return {
        ...state,
        project: next,
        history: {
          past: newPast,
          future: newFuture,
        },
      };
    }

    default:
      return state;
  }
}
