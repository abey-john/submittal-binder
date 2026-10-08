import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type Fixture, getFixtureTitle } from '../core/types';
import type { PdfMetadata } from '../utils/pdfMeta';
import { GripVertical, Trash2, AlertTriangle, FileText } from 'lucide-react';

interface Props {
  fixture: Fixture;
  componentId: string;
  metadata?: PdfMetadata;
  startPage?: number;
  onDelete: (componentId: string, fixtureId: string) => void;
  isOverlay?: boolean;
}

export const SortableFixtureRow: React.FC<Props> = ({
  fixture,
  componentId,
  metadata,
  startPage,
  onDelete,
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
    id: fixture.id,
    data: {
      type: 'fixture',
      fixture,
      componentId,
    },
    disabled: isOverlay,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const title = getFixtureTitle(fixture.path);
  const pageCount = metadata?.pageCount ?? 1;
  const hasError = Boolean(metadata?.error);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`fixture-row ${hasError ? 'fixture-has-error' : ''} ${isOverlay ? 'fixture-drag-overlay' : ''}`}
      id={`fixture-${fixture.id}`}
    >
      {/* Drag Handle */}
      <button
        type="button"
        className="drag-handle-btn"
        {...attributes}
        {...listeners}
        title="Drag to reorder or move between components"
      >
        <GripVertical size={16} />
      </button>

      {/* Thumbnail */}
      <div className="fixture-thumbnail-container">
        {metadata?.thumbnailDataUrl ? (
          <img
            src={metadata.thumbnailDataUrl}
            alt={title}
            className="fixture-thumbnail-img"
          />
        ) : (
          <div className="fixture-thumbnail-placeholder">
            <FileText size={20} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="fixture-info">
        <div className="fixture-title-row">
          <span className="fixture-title" title={title}>
            {title}
          </span>
          <span className="fixture-badge fixture-page-count">
            {pageCount} {pageCount === 1 ? 'page' : 'pages'}
          </span>
          {startPage !== undefined && (
            <span className="fixture-badge fixture-start-page" title="Starting page in assembled document">
              p. {startPage}
            </span>
          )}
        </div>
        <div className="fixture-path" title={fixture.path}>
          {fixture.path}
        </div>
        {hasError && (
          <div className="fixture-error-message" role="alert">
            <AlertTriangle size={13} />
            <span>{metadata?.error}</span>
          </div>
        )}
      </div>

      {/* Delete button */}
      {!isOverlay && (
        <button
          type="button"
          className="icon-btn delete-btn"
          onClick={() => onDelete(componentId, fixture.id)}
          title={`Remove ${title} from this component`}
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
};
