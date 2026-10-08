import React, { useRef, useState } from 'react';
import type { Project } from '../core/types';
import {
  matchProjectFiles,
  type FixtureStatus,
} from '../utils/relinkHelper';
import { extractFilesFromDataTransfer } from '../utils/fileHelpers';
import { extractPdfMetadata, type PdfMetadata } from '../utils/pdfMeta';
import {
  CheckCircle2,
  AlertCircle,
  FolderUp,
  FileUp,
  X,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  project: Project;
  existingFileMap: Record<string, File>;
  onApplyRelink: (
    fileMap: Record<string, File>,
    metadataMap: Record<string, PdfMetadata>
  ) => void;
  onClose: () => void;
}

export const ProjectRelinkModal: React.FC<Props> = ({
  isOpen,
  project,
  existingFileMap,
  onApplyRelink,
  onClose,
}) => {
  const [candidateFiles, setCandidateFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');

  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Calculate matching status live
  const matchResult = matchProjectFiles(project, candidateFiles, existingFileMap);

  const handleProcessCandidateFiles = async (newFiles: File[]) => {
    setIsProcessing(true);
    setProcessingStatus('Matching files against project fixtures...');

    const combined = [...candidateFiles, ...newFiles];
    setCandidateFiles(combined);

    const match = matchProjectFiles(project, combined, existingFileMap);
    const newMetadataMap: Record<string, PdfMetadata> = {};

    let count = 0;
    const newlyMatched = Object.entries(match.matchedFiles);

    for (const [fixId, file] of newlyMatched) {
      count++;
      setProcessingStatus(`Extracting page counts & thumbnails (${count} / ${newlyMatched.length})...`);
      try {
        const meta = await extractPdfMetadata(file);
        newMetadataMap[fixId] = meta;
      } catch (e) {
        console.warn('Metadata read error for', file.name, e);
      }
    }

    onApplyRelink(match.matchedFiles, newMetadataMap);
    setIsProcessing(false);
    setProcessingStatus('');
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessCandidateFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessCandidateFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsProcessing(true);
      setProcessingStatus('Scanning dropped items...');
      const { files } = await extractFilesFromDataTransfer(e.dataTransfer.items);
      await handleProcessCandidateFiles(files);
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleProcessCandidateFiles(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card relink-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <div className="modal-icon-badge primary">
              <RefreshCw size={20} />
            </div>
            <h3>Relink Project Files</h3>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} title="Close dialog">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p className="relink-modal-desc">
            To build your merged PDF and view thumbnails, please re-select the source folders or files.
            Binder will automatically match them by path.
          </p>

          {/* Status summary banner */}
          <div className="relink-summary-box">
            <div className="relink-stat">
              <span className="relink-stat-label">Total Required</span>
              <span className="relink-stat-val">{matchResult.totalFixtures}</span>
            </div>
            <div className="stat-divider" />
            <div className="relink-stat">
              <span className="relink-stat-label">Linked</span>
              <span className="relink-stat-val text-success">
                {matchResult.linkedCount}
              </span>
            </div>
            <div className="stat-divider" />
            <div className="relink-stat">
              <span className="relink-stat-label">Missing</span>
              <span className={`relink-stat-val ${matchResult.missingCount > 0 ? 'text-danger' : 'text-success'}`}>
                {matchResult.missingCount}
              </span>
            </div>
          </div>

          {/* Quick upload zone inside modal */}
          <div
            className="relink-dropzone"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={handleDrop}
          >
            {/* Hidden file inputs */}
            <input
              type="file"
              ref={folderInputRef}
              onChange={handleFolderChange}
              style={{ display: 'none' }}
              {...({ webkitdirectory: '', directory: '', multiple: true } as any)}
            />
            <input
              type="file"
              ref={filesInputRef}
              onChange={handleFilesChange}
              accept=".pdf"
              multiple
              style={{ display: 'none' }}
            />

            {isProcessing ? (
              <div className="relink-processing-box">
                <Loader2 size={24} className="spinner-icon" />
                <span className="relink-status-text">{processingStatus}</span>
              </div>
            ) : (
              <div className="relink-picker-row">
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => folderInputRef.current?.click()}
                  id="btn-relink-folder"
                >
                  <FolderUp size={15} />
                  <span>Re-select Folder(s)</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => filesInputRef.current?.click()}
                  id="btn-relink-files"
                >
                  <FileUp size={15} />
                  <span>Re-select Loose PDF(s)</span>
                </button>
                <span className="relink-drop-hint">or drop folders & files here</span>
              </div>
            )}
          </div>

          {/* List of fixtures and their match state */}
          <div className="relink-fixtures-list-container">
            <h4 className="relink-list-title">Files Status:</h4>
            <div className="relink-fixtures-table">
              {matchResult.fixtureStatuses.map((item: FixtureStatus) => (
                <div
                  key={item.fixtureId}
                  className={`relink-row ${item.isLinked ? 'row-linked' : 'row-missing'}`}
                >
                  <div className="relink-status-indicator">
                    {item.isLinked ? (
                      <CheckCircle2 size={16} className="text-success" />
                    ) : (
                      <AlertCircle size={16} className="text-danger" />
                    )}
                  </div>
                  <div className="relink-row-details">
                    <span className="relink-file-path" title={item.path}>
                      {item.path}
                    </span>
                    <span className="relink-comp-badge">
                      {item.componentName}
                    </span>
                  </div>
                  <div className="relink-status-badge">
                    {item.isLinked ? (
                      <span className="badge-linked">Linked</span>
                    ) : (
                      <span className="badge-missing">Missing</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {matchResult.missingCount > 0 ? 'Continue with Missing Files' : 'Close'}
          </button>
          {matchResult.missingCount === 0 && (
            <button
              type="button"
              className="btn-primary"
              onClick={onClose}
              id="btn-relink-done"
            >
              All Files Linked
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
