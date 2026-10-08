import { describe, expect, it } from 'vitest';
import { initialProjectState, projectReducer } from './projectReducer';

describe('projectReducer with undo/redo stack', () => {
  it('adds components and records history', () => {
    let state = initialProjectState;
    state = projectReducer(state, {
      type: 'ADD_COMPONENTS',
      payload: {
        components: [
          {
            id: 'c1',
            sourceName: 'Folder1',
            fixtures: [{ id: 'f1', path: 'Folder1/a.pdf' }],
          },
          {
            id: 'c2',
            sourceName: 'Folder2',
            fixtures: [{ id: 'f2', path: 'Folder2/b.pdf' }],
          },
        ],
      },
    });

    expect(state.project.components.length).toBe(2);
    expect(state.history.past.length).toBe(1);
    expect(state.history.future.length).toBe(0);
  });

  it('reorders components and supports undo/redo', () => {
    let state = projectReducer(initialProjectState, {
      type: 'ADD_COMPONENTS',
      payload: {
        components: [
          { id: 'c1', sourceName: 'C1', fixtures: [] },
          { id: 'c2', sourceName: 'C2', fixtures: [] },
        ],
      },
    });

    // Reorder: swap c1 and c2
    state = projectReducer(state, {
      type: 'REORDER_COMPONENTS',
      payload: { activeId: 'c1', overId: 'c2' },
    });
    expect(state.project.components.map((c) => c.id)).toEqual(['c2', 'c1']);

    // Undo reorder
    state = projectReducer(state, { type: 'UNDO' });
    expect(state.project.components.map((c) => c.id)).toEqual(['c1', 'c2']);

    // Redo reorder
    state = projectReducer(state, { type: 'REDO' });
    expect(state.project.components.map((c) => c.id)).toEqual(['c2', 'c1']);
  });

  it('moves fixtures between components with undo/redo', () => {
    let state = projectReducer(initialProjectState, {
      type: 'ADD_COMPONENTS',
      payload: {
        components: [
          {
            id: 'c1',
            sourceName: 'C1',
            fixtures: [
              { id: 'f1', path: 'f1.pdf' },
              { id: 'f2', path: 'f2.pdf' },
            ],
          },
          {
            id: 'c2',
            sourceName: 'C2',
            fixtures: [{ id: 'f3', path: 'f3.pdf' }],
          },
        ],
      },
    });

    // Move f1 from c1 to c2
    state = projectReducer(state, {
      type: 'MOVE_FIXTURE',
      payload: {
        sourceComponentId: 'c1',
        targetComponentId: 'c2',
        fixtureId: 'f1',
      },
    });

    expect(state.project.components[0].fixtures.map((f) => f.id)).toEqual(['f2']);
    expect(state.project.components[1].fixtures.map((f) => f.id)).toEqual(['f3', 'f1']);

    // Undo move
    state = projectReducer(state, { type: 'UNDO' });
    expect(state.project.components[0].fixtures.map((f) => f.id)).toEqual(['f1', 'f2']);
    expect(state.project.components[1].fixtures.map((f) => f.id)).toEqual(['f3']);

    // Redo move
    state = projectReducer(state, { type: 'REDO' });
    expect(state.project.components[0].fixtures.map((f) => f.id)).toEqual(['f2']);
    expect(state.project.components[1].fixtures.map((f) => f.id)).toEqual(['f3', 'f1']);
  });

  it('renames component and edits previouslyApproved with undo', () => {
    let state = projectReducer(initialProjectState, {
      type: 'ADD_COMPONENTS',
      payload: {
        components: [{ id: 'c1', sourceName: 'Original', fixtures: [] }],
      },
    });

    // Rename
    state = projectReducer(state, {
      type: 'RENAME_COMPONENT',
      payload: { componentId: 'c1', nameOverride: 'Custom Title' },
    });
    expect(state.project.components[0].nameOverride).toBe('Custom Title');

    // Edit previously approved
    state = projectReducer(state, {
      type: 'UPDATE_PREVIOUSLY_APPROVED',
      payload: { componentId: 'c1', previouslyApproved: 'Revision 2 Stamped' },
    });
    expect(state.project.components[0].previouslyApproved).toBe('Revision 2 Stamped');

    // Undo previouslyApproved
    state = projectReducer(state, { type: 'UNDO' });
    expect(state.project.components[0].previouslyApproved).toBeUndefined();
    expect(state.project.components[0].nameOverride).toBe('Custom Title');

    // Undo rename
    state = projectReducer(state, { type: 'UNDO' });
    expect(state.project.components[0].nameOverride).toBeUndefined();
  });

  it('deletes fixture and component with undo', () => {
    let state = projectReducer(initialProjectState, {
      type: 'ADD_COMPONENTS',
      payload: {
        components: [
          {
            id: 'c1',
            sourceName: 'C1',
            fixtures: [{ id: 'f1', path: 'f1.pdf' }],
          },
          {
            id: 'c2',
            sourceName: 'C2',
            fixtures: [{ id: 'f2', path: 'f2.pdf' }],
          },
        ],
      },
    });

    // Delete fixture f1 from c1
    state = projectReducer(state, {
      type: 'DELETE_FIXTURE',
      payload: { componentId: 'c1', fixtureId: 'f1' },
    });
    expect(state.project.components[0].fixtures.length).toBe(0);

    // Delete component c2
    state = projectReducer(state, {
      type: 'DELETE_COMPONENT',
      payload: { componentId: 'c2' },
    });
    expect(state.project.components.length).toBe(1);

    // Undo delete component
    state = projectReducer(state, { type: 'UNDO' });
    expect(state.project.components.length).toBe(2);

    // Undo delete fixture
    state = projectReducer(state, { type: 'UNDO' });
    expect(state.project.components[0].fixtures.length).toBe(1);
  });
});
