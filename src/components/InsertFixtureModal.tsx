import React, { useRef, useState } from 'react';
import { type Component, getComponentDisplayName } from '../core/types';
import { extractPdfMetadata, type PdfMetadata } from '../utils/pdfMeta';
import { generateId } from '../utils/fileHelpers';
import { Plus, X, Upload, FileText, Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  components: Component[];
  initialComponentId?: string;
  onInsert: (
    targetComponentId: string,
    fixture: { id: string; path: string },
    file: File,
    meta: PdfMetadata
  ) => void;
  onClose: () => void;
}

export const InsertFixtureModal: React.FC<Props> = ({
  isOpen,
  components,
  initialComponentId,
  onInsert,
  onClose,
}) => {
  const [selectedCompId, setSelectedCompId] = useState<string>(
    initialComponentId || components[0]?.id || ''
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileMeta, setFileMeta] = useState<PdfMetadata | null>(null);
  const [isReading, setIsReading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setIsReading(true);
      try {
        const meta = await extractPdfMetadata(file);
        setFileMeta(meta);
      } finally {
        setIsReading(false);
      }
    }
  };

  const handleConfirm = () => {
    if (!selectedFile || !selectedCompId) return;

    const fixtureId = generateId();
    const meta = fileMeta ?? { pageCount: 1 };
    onInsert(
      selectedCompId,
      {
        id: fixtureId,
        path: selectedFile.name,
      },
      selectedFile,
      meta
    );

    setSelectedFile(null);
    setFileMeta(null);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <div className="modal-icon-badge primary">
              <Plus size={20} />
            </div>
            <h3>Insert PDF Fixture</h3>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} title="Close dialog">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Target Component Selector */}
          <div className="form-group">
            <label className="form-label" htmlFor="destination-component">
              Destination Component:
            </label>
            <select
              id="destination-component"
              className="select-input"
              value={selectedCompId}
              onChange={(e) => setSelectedCompId(e.target.value)}
            >
              {components.map((c, index) => (
                <option key={c.id} value={c.id}>
                  Component {index + 1}: {getComponentDisplayName(c)}
                </option>
              ))}
            </select>
          </div>

          {/* File Picker */}
          <div className="form-group">
            <label className="form-label">Select PDF File:</label>
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />

            {!selectedFile ? (
              <div
                className="file-picker-box"
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <Upload size={24} className="file-picker-icon" />
                <span>Click to browse for a PDF document</span>
              </div>
            ) : (
              <div className="selected-file-preview">
                <div className="selected-file-thumb">
                  {fileMeta?.thumbnailDataUrl ? (
                    <img src={fileMeta.thumbnailDataUrl} alt="Preview" />
                  ) : (
                    <FileText size={24} />
                  )}
                </div>
                <div className="selected-file-details">
                  <div className="selected-file-name">{selectedFile.name}</div>
                  <div className="selected-file-pages">
                    {isReading ? (
                      <span className="reading-indicator">
                        <Loader2 size={12} className="spinner-icon" /> Reading pages...
                      </span>
                    ) : (
                      <span>{fileMeta?.pageCount ?? 1} pages</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Change
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleConfirm}
            disabled={!selectedFile || !selectedCompId || isReading}
            id="btn-confirm-insert-fixture"
          >
            <Plus size={16} />
            <span>Insert Fixture</span>
          </button>
        </div>
      </div>
    </div>
  );
};
