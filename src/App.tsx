import React, { useEffect, useMemo, useRef, useReducer, useState } from 'react';
import { initialProjectState, projectReducer } from './state/projectReducer';
import { computeLayout } from './core/layout';
import { ProjectSchema } from './core/types';
import { Navbar } from './components/Navbar';
import { UploadDropZone } from './components/UploadDropZone';
import { ArrangeScreen } from './components/ArrangeScreen';
import { FolderDown, ShieldAlert, Sparkles, BookOpen } from 'lucide-react';

export const App: React.FC = () => {
  const [state, dispatch] = useReducer(projectReducer, initialProjectState);
  const [isUploadDrawerOpen, setIsUploadDrawerOpen] = useState(false);
  const projectFileInputRef = useRef<HTMLInputElement>(null);

  // Compute live page counts mapping from metadataMap
  const pageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.entries(state.metadataMap).forEach(([id, meta]) => {
      counts[id] = meta.pageCount;
    });
    return counts;
  }, [state.metadataMap]);

  // Pure framework-free layout calculation
  // "Everything renumbers automatically when the arrangement changes. No numbers are ever typed or stored; all are derived from order."
  const layout = useMemo(() => {
    return computeLayout(state.project, pageCounts);
  }, [state.project, pageCounts]);

  const canUndo = state.history.past.length > 0;
  const canRedo = state.history.future.length > 0;

  // Keyboard shortcut listener for Undo / Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;

      // Allow Ctrl+Z inside text inputs to behave natively
      if (isInput) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          if (canRedo) dispatch({ type: 'REDO' });
        } else {
          e.preventDefault();
          if (canUndo) dispatch({ type: 'UNDO' });
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (canRedo) dispatch({ type: 'REDO' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo]);

  // Export project structure as JSON file
  const handleExportProject = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state.project, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'submittal-binder-project.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import saved project JSON
  const handleImportProjectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const parsed = ProjectSchema.safeParse(json);
        if (!parsed.success) {
          alert('Invalid project file: ' + parsed.error.issues.map((i) => i.message).join(', '));
          return;
        }

        dispatch({
          type: 'SET_PROJECT',
          payload: {
            project: parsed.data,
          },
        });
        dispatch({
          type: 'ADD_WARNINGS',
          payload: {
            warnings: [
              'Project structure loaded! Please re-select the original files/folders if you need to generate a new PDF or render thumbnails.',
            ],
          },
        });
      } catch (err: any) {
        alert('Could not read project JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClearWorkspace = () => {
    if (window.confirm('Reset workspace and remove all components? You can Undo this action.')) {
      dispatch({
        type: 'SET_PROJECT',
        payload: {
          project: { version: 1, components: [] },
        },
      });
    }
  };

  const hasComponents = state.project.components.length > 0;

  return (
    <div className="app-layout">
      {/* Hidden project file picker */}
      <input
        type="file"
        ref={projectFileInputRef}
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImportProjectFile}
      />

      {/* Top Navbar */}
      <Navbar
        state={state}
        layout={layout}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => dispatch({ type: 'UNDO' })}
        onRedo={() => dispatch({ type: 'REDO' })}
        onToggleUpload={() => setIsUploadDrawerOpen((prev) => !prev)}
        onExport={handleExportProject}
        onImport={() => projectFileInputRef.current?.click()}
        onClear={handleClearWorkspace}
        onBuild={() => {
          alert('Milestone 2 complete! PDF Generation will be implemented in Milestone 3.');
        }}
        isUploadOpen={isUploadDrawerOpen}
      />

      <main className="main-workspace">
        {/* If no components are loaded, show welcome hero + main upload dropzone */}
        {!hasComponents ? (
          <div className="welcome-hero-container">
            <div className="welcome-hero-badge">
              <Sparkles size={14} />
              <span>Browser-Only Construction Submittal Package Tool</span>
            </div>
            <h2 className="welcome-hero-title">Assemble Professional Submittals in Seconds</h2>
            <p className="welcome-hero-desc">
              Drop your product cut sheets and drawings below. Binder automatically renumbers components,
              formats table of contents, stamps continuous page numbers, and builds PDF bookmarks.
            </p>

            <UploadDropZone
              onFilesParsed={(newComponents, files, metadata, warnings) => {
                dispatch({
                  type: 'ADD_COMPONENTS',
                  payload: {
                    components: newComponents,
                    files,
                    metadata,
                  },
                });
                if (warnings.length > 0) {
                  dispatch({ type: 'ADD_WARNINGS', payload: { warnings } });
                }
              }}
            />

            <div className="hero-features-grid">
              <div className="hero-feature-card">
                <BookOpen size={20} className="feature-icon" />
                <h4>Derived Renumbering</h4>
                <p>No numbers are ever typed or stored. Component and page numbers update automatically when you drag.</p>
              </div>
              <div className="hero-feature-card">
                <FolderDown size={20} className="feature-icon" />
                <h4>Automated Covers & TOC</h4>
                <p>Generates crisp Letter covers for each component and an exact multi-page Table of Contents table.</p>
              </div>
              <div className="hero-feature-card">
                <ShieldAlert size={20} className="feature-icon" />
                <h4>100% Client-Side Privacy</h4>
                <p>Zero cloud uploads. All parsing, rendering, and PDF merging happen strictly inside your browser.</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Collapsible Upload Drawer for adding more items */}
            {isUploadDrawerOpen && (
              <div className="upload-drawer">
                <UploadDropZone
                  compact
                  onFilesParsed={(newComponents, files, metadata, warnings) => {
                    dispatch({
                      type: 'ADD_COMPONENTS',
                      payload: {
                        components: newComponents,
                        files,
                        metadata,
                      },
                    });
                    if (warnings.length > 0) {
                      dispatch({ type: 'ADD_WARNINGS', payload: { warnings } });
                    }
                    setIsUploadDrawerOpen(false);
                  }}
                />
              </div>
            )}

            {/* Arrange Screen with dnd-kit multi-container sorting */}
            <ArrangeScreen
              state={state}
              dispatch={dispatch}
              layout={layout}
              onOpenUpload={() => setIsUploadDrawerOpen(true)}
              onStartBuild={() => {}}
              onExportProject={handleExportProject}
            />
          </>
        )}
      </main>
    </div>
  );
};

export default App;
