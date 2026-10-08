import React, { useRef, useState } from 'react';
import { extractFilesFromDataTransfer, parseUploadedFiles } from '../utils/fileHelpers';
import { extractPdfMetadata, type PdfMetadata } from '../utils/pdfMeta';
import type { Component } from '../core/types';
import { FolderUp, FileUp, UploadCloud, Loader2, ShieldCheck } from 'lucide-react';

interface Props {
  onFilesParsed: (
    components: Component[],
    fileMap: Record<string, File>,
    metadataMap: Record<string, PdfMetadata>,
    warnings: string[]
  ) => void;
  compact?: boolean;
}

export const UploadDropZone: React.FC<Props> = ({ onFilesParsed, compact = false }) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');

  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  const processFileList = async (files: File[], relativePathMap?: Map<File, string>) => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setProcessingStatus('Analyzing structure and natural sorting...');

    try {
      const parsed = await parseUploadedFiles(files, relativePathMap);
      const fileMapObj: Record<string, File> = {};
      const metaMapObj: Record<string, PdfMetadata> = {};

      parsed.fileMap.forEach((file, fixId) => {
        fileMapObj[fixId] = file;
      });

      // Extract metadata (page counts & thumbnails) for all fixtures
      const totalFixtures = parsed.components.reduce((acc, c) => acc + c.fixtures.length, 0);
      let count = 0;

      for (const comp of parsed.components) {
        for (const fixture of comp.fixtures) {
          count++;
          setProcessingStatus(`Rendering thumbnails & counting pages (${count} / ${totalFixtures})...`);
          const file = parsed.fileMap.get(fixture.id);
          if (file) {
            const meta = await extractPdfMetadata(file);
            metaMapObj[fixture.id] = meta;
          }
        }
      }

      onFilesParsed(parsed.components, fileMapObj, metaMapObj, parsed.warnings);
    } catch (err: any) {
      console.error('Failed to parse uploaded files:', err);
      alert(`Error reading files: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsProcessing(true);
      setProcessingStatus('Scanning dropped items...');
      const { files, relativePathMap } = await extractFilesFromDataTransfer(e.dataTransfer.items);
      await processFileList(files, relativePathMap);
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      await processFileList(files);
    }
  };

  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      await processFileList(files);
      e.target.value = '';
    }
  };

  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      await processFileList(files);
      e.target.value = '';
    }
  };

  return (
    <div
      className={`upload-dropzone ${isDraggingOver ? 'dropzone-active' : ''} ${compact ? 'dropzone-compact' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      id="upload-dropzone"
    >
      {/* Hidden inputs */}
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
        <div className="dropzone-processing">
          <Loader2 size={36} className="spinner-icon" />
          <p className="processing-title">Reading Submittal PDFs...</p>
          <p className="processing-subtitle">{processingStatus}</p>
        </div>
      ) : (
        <div className="dropzone-content">
          <div className="dropzone-icon-box">
            <UploadCloud size={compact ? 28 : 44} className="upload-icon" />
          </div>

          <div className="dropzone-text-group">
            <h3 className="dropzone-heading">
              {compact ? 'Add More Submittal Folders or PDFs' : 'Drag & Drop Submittal Folder or PDFs'}
            </h3>
            <p className="dropzone-subheading">
              Drop your entire submittal folder, or select multiple component folders and loose PDFs from File Explorer.
            </p>
          </div>

          <div className="dropzone-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => folderInputRef.current?.click()}
              id="btn-upload-folder"
              title="Bulk import your entire submittal folder (with all subfolders and PDFs) in one click"
            >
              <FolderUp size={16} />
              <span>Select Submittal Folder</span>
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => filesInputRef.current?.click()}
              id="btn-upload-files"
              title="Select one or more loose PDF files"
            >
              <FileUp size={16} />
              <span>Select Loose PDF(s)</span>
            </button>
          </div>

          {!compact && (
            <div className="dropzone-footnote">
              <div className="privacy-pill">
                <ShieldCheck size={14} />
                <span>100% Client-Side • Files never leave your browser</span>
              </div>
              <p className="dropzone-rule-tip">
                Bulk upload: Select or drop your top-level <code>Submittal</code> folder to automatically create Components for all folders and loose PDFs.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
