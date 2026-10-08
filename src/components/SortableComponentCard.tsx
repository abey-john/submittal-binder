import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type Component, getComponentDisplayName } from '../core/types';
import type { PdfMetadata } from '../utils/pdfMeta';
import { SortableFixtureRow } from './SortableFixtureRow';
import {
  GripVertical,
  Trash2,
  Plus,
  Layers,
  Edit2,
  Check,
  Folder,
} from 'lucide-react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

interface Props {
  component: Component;
  componentNumber: number;
  coverPage: number;
  startPages: Record<string, number>;
  metadataMap: Record<string, PdfMetadata>;
  onRename: (componentId: string, newName: string) => void;
  onUpdatePreviouslyApproved: (componentId: string, text: string) => void;
  onDeleteComponent: (componentId: string) => void;
  onDeleteFixture: (componentId: string, fixtureId: string) => void;
  onOpenInsertModal: (componentId: string) => void;
  isOverlay?: boolean;
}

export const SortableComponentCard: React.FC<Props> = ({
  component,
  componentNumber,
  coverPage,
  startPages,
  metadataMap,
  onRename,
  onUpdatePreviouslyApproved,
  onDeleteComponent,
  onDeleteFixture,
  onOpenInsertModal,
  isOverlay = false,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: component.id,
    data: {
      type: 'component',
      component,
    },
    disabled: isOverlay,
  });

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(component.nameOverride ?? component.sourceName);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const displayName = getComponentDisplayName(component);

  // Calculate component fixture page sum + 1 cover page
  const fixturesPageSum = component.fixtures.reduce((acc, f) => {
    return acc + (metadataMap[f.id]?.pageCount ?? 1);
  }, 0);
  const totalComponentPages = 1 + fixturesPageSum; // 1 cover page

  const handleNameSave = () => {
    setIsEditingName(false);
    onRename(component.id, nameValue);
  };

  const fixtureIds = component.fixtures.map((f) => f.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`component-card ${isOverlay ? 'component-drag-overlay' : ''}`}
      id={`component-${component.id}`}
    >
      {/* Component Header */}
      <div className="component-header">
        <div className="component-header-left">
          {/* Reorder drag handle */}
          <button
            type="button"
            className="drag-handle-btn component-grip"
            {...attributes}
            {...listeners}
            title="Drag to reorder component position"
          >
            <GripVertical size={18} />
          </button>

          {/* Component Number badge */}
          <div className="component-number-pill">
            <Layers size={14} />
            <span>Component {componentNumber}</span>
          </div>

          {/* Component Name */}
          <div className="component-title-box">
            {isEditingName ? (
              <div className="inline-edit-group">
                <input
                  type="text"
                  className="input-text edit-title-input"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleNameSave();
                    if (e.key === 'Escape') {
                      setNameValue(component.nameOverride ?? component.sourceName);
                      setIsEditingName(false);
                    }
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className="icon-btn save-btn"
                  onClick={handleNameSave}
                  title="Save title"
                >
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <div
                className="component-title-display"
                onClick={() => setIsEditingName(true)}
                title="Click to rename component"
              >
                <Folder size={16} className="component-folder-icon" />
                <span className="component-name-text">{displayName}</span>
                <Edit2 size={13} className="edit-pencil-icon" />
              </div>
            )}
            {component.nameOverride && component.nameOverride !== component.sourceName && (
              <span className="component-original-source" title="Source folder or file">
                (source: {component.sourceName})
              </span>
            )}
          </div>
        </div>

        {/* Component Header Right Badges and Actions */}
        <div className="component-header-right">
          <span className="component-stat-pill" title="1 generated cover page + fixture pages">
            {totalComponentPages} {totalComponentPages === 1 ? 'page' : 'pages'} (Cover: p. {coverPage})
          </span>

          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => onOpenInsertModal(component.id)}
            title="Insert a PDF into this component"
          >
            <Plus size={14} />
            <span>Add PDF</span>
          </button>

          <button
            type="button"
            className="icon-btn delete-btn"
            onClick={() => onDeleteComponent(component.id)}
            title={`Delete Component ${componentNumber} and all fixtures`}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Previously Approved TOC field */}
      <div className="component-meta-row">
        <label className="meta-label">
          <span>Where Previously Approved:</span>
          <input
            type="text"
            className="input-text meta-input"
            placeholder="e.g. Submittal Rev. 2, Spec 15000, or leave blank"
            value={component.previouslyApproved ?? ''}
            onChange={(e) => onUpdatePreviouslyApproved(component.id, e.target.value)}
          />
        </label>
      </div>

      {/* Fixtures List */}
      <div className="component-fixtures-container">
        <SortableContext items={fixtureIds} strategy={verticalListSortingStrategy}>
          {component.fixtures.length === 0 ? (
            <div className="empty-fixtures-placeholder">
              <p>No fixtures in this component.</p>
              <button
                type="button"
                className="btn-link"
                onClick={() => onOpenInsertModal(component.id)}
              >
                + Add a PDF fixture
              </button>
            </div>
          ) : (
            component.fixtures.map((fixture) => (
              <SortableFixtureRow
                key={fixture.id}
                fixture={fixture}
                componentId={component.id}
                metadata={metadataMap[fixture.id]}
                startPage={startPages[fixture.id]}
                onDelete={onDeleteFixture}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
};
