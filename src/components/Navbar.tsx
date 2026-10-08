import React from 'react';
import {
  FolderPlus,
  Undo2,
  Redo2,
  FileDown,
  Upload,
  Hammer,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import type { LayoutResult } from '../core/types';
import type { ProjectState } from '../state/projectReducer';

interface Props {
  state: ProjectState;
  layout: LayoutResult;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onToggleUpload: () => void;
  onExport: () => void;
  onImport: () => void;
  onClear: () => void;
  onBuild: () => void;
  onOpenRelink: () => void;
  isUploadOpen: boolean;
  missingCount: number;
}

export const Navbar: React.FC<Props> = ({
  state,
  layout,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onToggleUpload,
  onExport,
  onImport,
  onClear,
  onBuild,
  onOpenRelink,
  isUploadOpen,
  missingCount,
}) => {
  const componentCount = state.project.components.length;
  const fixtureCount = state.project.components.reduce(
    (acc, c) => acc + c.fixtures.length,
    0
  );

  return (
    <header className="app-header">
      <div className="header-top-row">
        {/* Brand */}
        <div className="brand-group">
          <div className="brand-icon-box">
            <span className="brand-logo-mark">B</span>
          </div>
          <div>
            <h1 className="brand-title">Binder</h1>
            <p className="brand-tagline">Submittal Package Builder</p>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="header-actions">
          {/* Undo / Redo */}
          <div className="undo-redo-group">
            <button
              type="button"
              className="icon-btn-header"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo last action (Ctrl+Z)"
              id="btn-undo"
            >
              <Undo2 size={16} />
            </button>
            <button
              type="button"
              className="icon-btn-header"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo last action (Ctrl+Y)"
              id="btn-redo"
            >
              <Redo2 size={16} />
            </button>
          </div>

          {/* Add Files button */}
          <button
            type="button"
            className={`btn-header ${isUploadOpen ? 'btn-header-active' : ''}`}
            onClick={onToggleUpload}
            id="btn-toggle-upload"
          >
            <FolderPlus size={15} />
            <span>{isUploadOpen ? 'Hide Upload' : 'Add Files'}</span>
          </button>

          {/* Relink Missing Files Alert Button */}
          {missingCount > 0 && componentCount > 0 && (
            <button
              type="button"
              className="btn-header btn-header-warning"
              onClick={onOpenRelink}
              title={`${missingCount} files need to be linked before building`}
              id="btn-relink-missing"
            >
              <AlertCircle size={15} />
              <span>{missingCount} Missing Files</span>
            </button>
          )}

          {/* Project File Import/Export */}
          <div className="project-file-buttons">
            <button
              type="button"
              className="btn-header"
              onClick={onImport}
              title="Import saved project JSON"
              id="btn-import-project"
            >
              <Upload size={15} />
              <span>Open</span>
            </button>
            <button
              type="button"
              className="btn-header"
              onClick={onExport}
              disabled={componentCount === 0}
              title="Export project structure as JSON"
              id="btn-export-project"
            >
              <FileDown size={15} />
              <span>Save</span>
            </button>
          </div>

          {/* Clear button */}
          {componentCount > 0 && (
            <button
              type="button"
              className="btn-header btn-header-danger"
              onClick={onClear}
              title="Reset workspace"
              id="btn-clear-workspace"
            >
              <RotateCcw size={14} />
            </button>
          )}

          {/* Generate PDF button */}
          <button
            type="button"
            className="btn-build-submittal"
            onClick={onBuild}
            disabled={componentCount === 0}
            id="btn-generate-submittal"
          >
            <Hammer size={16} />
            <span>Build Submittal</span>
          </button>
        </div>
      </div>

      {/* Live Stats Ribbon */}
      {componentCount > 0 && (
        <div className="stats-ribbon">
          <div className="stat-item">
            <span className="stat-label">Components</span>
            <span className="stat-value">{componentCount}</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-label">PDF Fixtures</span>
            <span className="stat-value">{fixtureCount}</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-label">TOC Pages</span>
            <span className="stat-value">{layout.tocPageCount}</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item highlight">
            <span className="stat-label">Total Document Pages</span>
            <span className="stat-value">{layout.totalPages}</span>
          </div>
        </div>
      )}
    </header>
  );
};
