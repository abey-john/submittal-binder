import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Component, Fixture, LayoutResult } from '../core/types';
import type { ProjectAction, ProjectState } from '../state/projectReducer';
import { SortableComponentCard } from './SortableComponentCard';
import { SortableFixtureRow } from './SortableFixtureRow';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { InsertFixtureModal } from './InsertFixtureModal';
import { AlertTriangle, X } from 'lucide-react';

interface Props {
  state: ProjectState;
  dispatch: React.Dispatch<ProjectAction>;
  layout: LayoutResult;
  onOpenUpload: () => void;
  onStartBuild: () => void;
  onExportProject: () => void;
}

export const ArrangeScreen: React.FC<Props> = ({
  state,
  dispatch,
  layout,
  onOpenUpload: _onOpenUpload,
  onStartBuild: _onStartBuild,
  onExportProject: _onExportProject,
}) => {
  const { project, metadataMap, warnings } = state;

  // Active drag state
  const [activeItem, setActiveItem] = useState<{
    type: 'component' | 'fixture';
    component?: Component;
    fixture?: Fixture;
    sourceComponentId?: string;
  } | null>(null);

  // Modal states
  const [deleteDialog, setDeleteDialog] = useState<{
    componentId: string;
    componentNumber: number;
    componentName: string;
    fixtureCount: number;
  } | null>(null);

  const [insertModalCompId, setInsertModalCompId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const componentIds = project.components.map((c) => c.id);

  // Helper to find which component owns a given fixture ID
  const findComponentByFixtureId = (fixtureId: string): Component | undefined => {
    return project.components.find((c) => c.fixtures.some((f) => f.id === fixtureId));
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeData = active.data.current;

    if (activeData?.type === 'component') {
      setActiveItem({
        type: 'component',
        component: activeData.component,
      });
    } else if (activeData?.type === 'fixture') {
      setActiveItem({
        type: 'fixture',
        fixture: activeData.fixture,
        sourceComponentId: activeData.componentId,
      });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Moving fixture between components live during drag
    if (activeData?.type === 'fixture') {
      const activeFixtureId = String(active.id);
      const sourceComp = findComponentByFixtureId(activeFixtureId);
      if (!sourceComp) return;

      let targetCompId: string | null = null;
      let targetIndex: number | undefined;

      if (overData?.type === 'fixture') {
        const overFixtureId = String(over.id);
        const overComp = findComponentByFixtureId(overFixtureId);
        if (overComp) {
          targetCompId = overComp.id;
          targetIndex = overComp.fixtures.findIndex((f) => f.id === overFixtureId);
        }
      } else if (overData?.type === 'component') {
        targetCompId = String(over.id);
      }

      if (targetCompId && targetCompId !== sourceComp.id) {
        dispatch({
          type: 'MOVE_FIXTURE',
          payload: {
            sourceComponentId: sourceComp.id,
            targetComponentId: targetCompId,
            fixtureId: activeFixtureId,
            targetIndex,
          },
        });
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);

    if (!over) return;
    if (active.id === over.id) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type === 'component' && overData?.type === 'component') {
      dispatch({
        type: 'REORDER_COMPONENTS',
        payload: {
          activeId: String(active.id),
          overId: String(over.id),
        },
      });
    } else if (activeData?.type === 'fixture') {
      const activeFixtureId = String(active.id);
      const activeComp = findComponentByFixtureId(activeFixtureId);
      if (!activeComp) return;

      if (overData?.type === 'fixture') {
        const overFixtureId = String(over.id);
        const overComp = findComponentByFixtureId(overFixtureId);
        if (overComp && activeComp.id === overComp.id) {
          dispatch({
            type: 'REORDER_FIXTURES',
            payload: {
              componentId: activeComp.id,
              activeId: activeFixtureId,
              overId: overFixtureId,
            },
          });
        }
      }
    }
  };

  const handleRequestDeleteComponent = (componentId: string) => {
    const comp = project.components.find((c) => c.id === componentId);
    if (!comp) return;
    const componentNumber = layout.componentNumbers[componentId] ?? 1;
    setDeleteDialog({
      componentId,
      componentNumber,
      componentName: comp.nameOverride ?? comp.sourceName,
      fixtureCount: comp.fixtures.length,
    });
  };

  const handleConfirmDeleteComponent = () => {
    if (deleteDialog) {
      dispatch({
        type: 'DELETE_COMPONENT',
        payload: { componentId: deleteDialog.componentId },
      });
      setDeleteDialog(null);
    }
  };

  return (
    <div className="arrange-container">
      {/* Warnings Banner */}
      {warnings.length > 0 && (
        <div className="warnings-banner" role="alert">
          <div className="warning-banner-header">
            <AlertTriangle size={18} className="warning-icon" />
            <span className="warning-title">Upload Warnings ({warnings.length})</span>
            <button
              type="button"
              className="btn-text-sm"
              onClick={() => dispatch({ type: 'CLEAR_WARNINGS' })}
            >
              Dismiss all
            </button>
          </div>
          <ul className="warnings-list">
            {warnings.map((warn, index) => (
              <li key={index} className="warning-item">
                <span>{warn}</span>
                <button
                  type="button"
                  className="icon-btn-xs"
                  onClick={() => dispatch({ type: 'DISMISS_WARNING', payload: { index } })}
                  title="Dismiss this warning"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* DND Context */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="components-list">
          <SortableContext items={componentIds} strategy={verticalListSortingStrategy}>
            {project.components.map((comp) => (
              <SortableComponentCard
                key={comp.id}
                component={comp}
                componentNumber={layout.componentNumbers[comp.id] ?? 1}
                coverPage={layout.coverPages[comp.id] ?? 1}
                startPages={layout.startPages}
                metadataMap={metadataMap}
                onRename={(componentId, newName) =>
                  dispatch({ type: 'RENAME_COMPONENT', payload: { componentId, nameOverride: newName } })
                }
                onUpdatePreviouslyApproved={(componentId, text) =>
                  dispatch({
                    type: 'UPDATE_PREVIOUSLY_APPROVED',
                    payload: { componentId, previouslyApproved: text },
                  })
                }
                onDeleteComponent={handleRequestDeleteComponent}
                onDeleteFixture={(componentId, fixtureId) =>
                  dispatch({ type: 'DELETE_FIXTURE', payload: { componentId, fixtureId } })
                }
                onOpenInsertModal={(compId) => setInsertModalCompId(compId)}
              />
            ))}
          </SortableContext>
        </div>

        {/* Drag Overlay Preview */}
        <DragOverlay>
          {activeItem?.type === 'component' && activeItem.component && (
            <SortableComponentCard
              component={activeItem.component}
              componentNumber={layout.componentNumbers[activeItem.component.id] ?? 1}
              coverPage={layout.coverPages[activeItem.component.id] ?? 1}
              startPages={layout.startPages}
              metadataMap={metadataMap}
              onRename={() => {}}
              onUpdatePreviouslyApproved={() => {}}
              onDeleteComponent={() => {}}
              onDeleteFixture={() => {}}
              onOpenInsertModal={() => {}}
              isOverlay
            />
          )}
          {activeItem?.type === 'fixture' && activeItem.fixture && (
            <SortableFixtureRow
              fixture={activeItem.fixture}
              componentId={activeItem.sourceComponentId ?? ''}
              metadata={metadataMap[activeItem.fixture.id]}
              startPage={layout.startPages[activeItem.fixture.id]}
              onDelete={() => {}}
              isOverlay
            />
          )}
        </DragOverlay>
      </DndContext>

      {/* Delete Confirmation Modal */}
      {deleteDialog && (
        <DeleteConfirmModal
          isOpen={true}
          componentNumber={deleteDialog.componentNumber}
          componentName={deleteDialog.componentName}
          fixtureCount={deleteDialog.fixtureCount}
          onConfirm={handleConfirmDeleteComponent}
          onCancel={() => setDeleteDialog(null)}
        />
      )}

      {/* Insert Fixture Modal */}
      {insertModalCompId && (
        <InsertFixtureModal
          isOpen={true}
          components={project.components}
          initialComponentId={insertModalCompId}
          onInsert={(targetCompId, fixture, file, meta) => {
            dispatch({
              type: 'INSERT_FIXTURE',
              payload: {
                targetComponentId: targetCompId,
                fixture,
                file,
                meta,
              },
            });
            setInsertModalCompId(null);
          }}
          onClose={() => setInsertModalCompId(null)}
        />
      )}
    </div>
  );
};
