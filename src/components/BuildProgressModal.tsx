import React from 'react';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileDown,
  X,
  FileText,
} from 'lucide-react';

export type BuildStatus = 'idle' | 'building' | 'success' | 'error';

interface Props {
  isOpen: boolean;
  status: BuildStatus;
  progress: { current: number; total: number; message: string };
  errorMessage?: string;
  resultBlobUrl?: string;
  pdfSizeBytes?: number;
  totalPages?: number;
  onCancel: () => void;
  onClose: () => void;
}

export const BuildProgressModal: React.FC<Props> = ({
  isOpen,
  status,
  progress,
  errorMessage,
  resultBlobUrl,
  pdfSizeBytes = 0,
  totalPages = 0,
  onCancel,
  onClose,
}) => {
  if (!isOpen) return null;

  const percent = progress.total > 0
    ? Math.min(100, Math.round((progress.current / progress.total) * 100))
    : 0;

  const formattedSize = (pdfSizeBytes / (1024 * 1024)).toFixed(2) + ' MB';

  return (
    <div className="modal-backdrop">
      <div className="modal-card build-modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div className="modal-title-with-icon">
            {status === 'building' && (
              <div className="modal-icon-badge primary">
                <Loader2 size={20} className="spinner-icon" />
              </div>
            )}
            {status === 'success' && (
              <div className="modal-icon-badge success">
                <CheckCircle2 size={20} />
              </div>
            )}
            {status === 'error' && (
              <div className="modal-icon-badge danger">
                <AlertCircle size={20} />
              </div>
            )}
            <h3>
              {status === 'building' && 'Assembling Submittal Package...'}
              {status === 'success' && 'Submittal Package Ready!'}
              {status === 'error' && 'Build Failed'}
            </h3>
          </div>
          {status !== 'building' && (
            <button type="button" className="icon-btn" onClick={onClose} title="Close dialog">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="modal-body">
          {status === 'building' && (
            <div className="build-progress-container">
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="progress-stats-row">
                <span className="progress-message">{progress.message}</span>
                <span className="progress-percentage">{percent}%</span>
              </div>
              <p className="progress-footnote">
                Processing source PDFs one at a time locally in your browser...
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="build-success-container">
              <div className="success-stats-card">
                <div className="success-stat-item">
                  <span className="success-stat-label">Total Document Pages</span>
                  <span className="success-stat-val">{totalPages} pages</span>
                </div>
                <div className="stat-divider" />
                <div className="success-stat-item">
                  <span className="success-stat-label">File Size</span>
                  <span className="success-stat-val">{formattedSize}</span>
                </div>
              </div>
              <p className="success-desc">
                Your submittal package contains all generated component covers, table of contents, and hierarchical PDF bookmarks.
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="build-error-container" role="alert">
              <p className="error-lead">An error occurred while building the PDF:</p>
              <div className="error-box">
                <FileText size={16} className="error-box-icon" />
                <span className="error-text">{errorMessage}</span>
              </div>
              <p className="error-help">
                Please check that the source file is not password-protected or corrupted.
              </p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {status === 'building' && (
            <button type="button" className="btn-secondary" onClick={onCancel} id="btn-cancel-build">
              Cancel Build
            </button>
          )}

          {status === 'error' && (
            <button type="button" className="btn-secondary" onClick={onClose}>
              Dismiss
            </button>
          )}

          {status === 'success' && (
            <>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Done
              </button>
              {resultBlobUrl && (
                <a
                  href={resultBlobUrl}
                  download="Submittal_Package.pdf"
                  className="btn-build-submittal"
                  id="btn-download-pdf"
                >
                  <FileDown size={16} />
                  <span>Download Submittal PDF</span>
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
