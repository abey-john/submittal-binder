import React from 'react';
import { AlertCircle, Trash2, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  componentNumber: number;
  componentName: string;
  fixtureCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmModal: React.FC<Props> = ({
  isOpen,
  componentNumber,
  componentName,
  fixtureCount,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <div className="modal-icon-badge danger">
              <AlertCircle size={20} />
            </div>
            <h3>Delete Component {componentNumber}?</h3>
          </div>
          <button type="button" className="icon-btn" onClick={onCancel} title="Close dialog">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p>
            Are you sure you want to delete <strong>Component {componentNumber}: {componentName}</strong>?
          </p>
          {fixtureCount > 0 && (
            <p className="modal-body-subtext">
              This component contains <strong>{fixtureCount} {fixtureCount === 1 ? 'fixture PDF' : 'fixture PDFs'}</strong> which will also be removed.
            </p>
          )}
          <p className="modal-tip">
            You can always restore it using <strong>Undo (Ctrl+Z)</strong>.
          </p>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm} id="btn-confirm-delete-component">
            <Trash2 size={16} />
            <span>Delete Component</span>
          </button>
        </div>
      </div>
    </div>
  );
};
