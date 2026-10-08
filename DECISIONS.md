# Architectural & Design Decisions

This document records key decisions made where the project prompt was silent or allowed implementation choices, adhering to the principle of choosing the simplest reasonable option without adding out-of-scope features.

---

### 1. Root Package Folder Unwrapping (`unwrapPackageRoot`)
* **Context**: When users select a folder in Windows / Chrome using `<input webkitdirectory>`, the browser prepends the picked folder's name to all files (e.g., `Submittal/Folder1/file1.pdf` and `Submittal/file7.pdf`).
* **Decision**: If all uploaded items share a common top-level directory containing subfolders or a mix of subfolders and loose PDFs, Binder recognizes that this root directory represents the parent submittal package and unwraps it. Direct subfolders become components with their PDF fixtures, and direct PDFs become individual loose components.
* **Rationale**: Enables seamless one-click bulk upload of an entire submittal package matching the standard folder structure without triggering false "nested subfolder" warnings.

---

### 2. Streaming Web Worker Memory Model
* **Context**: Source PDFs can be large (tens to hundreds of megabytes), and JavaScript heap exhaustion is the primary crash risk in client-side PDF manipulation.
* **Decision**: 
  - Source files are kept as light browser `File` references in the main thread.
  - The Web Worker requests source PDF buffers strictly one at a time via a request-response protocol (`REQUEST_FILE` -> `FILE_DATA`).
  - The worker loads only one source document, copies its pages into the merged target document using `copyPages`, and immediately dereferences both the source document and buffer for garbage collection.
* **Rationale**: Keeps heap memory bounded to the size of the target document plus a single source document, rather than loading all source PDFs simultaneously.

---

### 3. Table of Contents Pagination & Styling
* **Context**: The TOC layout must never disagree with the rendered PDF page count, and cells can contain arbitrarily long text.
* **Decision**:
  - `paginateToc` and `drawTocPages` share the exact same deterministic text-wrapping and row-height estimation logic.
  - Geometry: Standard Letter portrait (612 × 792 pt), 36 pt margins (usable width: 540 pt).
  - Columns:
    - `#`: 40 pt (Centered)
    - `Component Name`: 180 pt (Left-aligned, wrapped)
    - `Submitted in this Package`: 90 pt (Centered "Yes")
    - `Where Previously Approved`: 140 pt (Left-aligned, wrapped)
    - `Status Code (By Reviewer)`: 90 pt (Blank cell with borders)
  - Real table borders (`borderWidth: 0.75 pt`) are drawn, and header rows repeat on every TOC page.
* **Rationale**: Complete consistency between the layout calculation and the rendered PDF output.

---

### 4. Page Number Stamping Transformation
* **Context**: Source PDFs often include mixed page dimensions, rotated landscape sheets stored with a `/Rotate` flag, and non-default `CropBox` offsets.
* **Decision**:
  - The stamp coordinates are computed relative to `page.getCropBox()` (`x0`, `y0`, `W`, `H`) rather than `MediaBox`.
  - For rotations $0^\circ, 90^\circ, 180^\circ, 270^\circ$, exact trigonometric matrix transformations are applied so text always appears horizontally oriented at the visual bottom-center of the viewer's screen.
  - A single config object `{ fontSize: 9, bottomMargin: 24, format: 'Page {page} of {total}' }` governs all styling.
* **Rationale**: Guarantees legibility on landscape drawings, rotated sheets, and cropped pages without size-specific hardcoding.

---

### 5. Low-Level Outline Tree (Bookmarks)
* **Context**: `pdf-lib` lacks a high-level API for generating PDF bookmarks (`/Outlines`).
* **Decision**:
  - Constructed directly on the `PDFDocument.context` using low-level indirect object references (`nextRef`, `assign`, `PDFDict`, `PDFArray`, `PDFName`, `PDFHexString`).
  - Hierarchy:
    - Table of Contents (points to TOC start page)
    - Component items (`Component {n}: {name}`) pointing to component covers
    - Fixture child items (`filename without .pdf`) pointing to fixture start pages
* **Rationale**: Fully compliant PDF outline tree compatible with Adobe Acrobat, Bluebeam Revu, Chrome, Edge, and macOS Preview.

---

### 6. Relinking Workflow & State Management
* **Context**: Storing raw PDF files in `localStorage` or `IndexedDB` is restricted by memory and quota limits.
* **Decision**:
  - Exported project files are lightweight JSON documents validated via Zod schemas. No page numbers or component numbers are persisted.
  - On import, Binder checks for missing `File` references and presents a dedicated reconciliation modal. Users can drop or select their folder/files, and Binder matches fixtures by normalized relative path and filename.
* **Rationale**: Zero storage leaks, complete portability, and straightforward file recovery.
