# Binder

> **Assemble professional submittal packages in your browser. Your files never leave your computer.**

Binder is a client-side web application for assembling construction and engineering submittal packages from multiple PDFs. It automatically generates component covers, formats a multi-page table of contents, stamps continuous page numbers, and constructs hierarchical PDF bookmarks.

---

## Privacy Statement

**Your files never leave your computer.**

- **100% Client-Side**: Binder runs entirely in your web browser. All PDF parsing, thumbnail rendering, merging, and stamping take place locally on your device.
- **No Cloud Uploads**: There is no backend server, no cloud storage, and no database.
- **Zero Telemetry**: No analytics, tracking scripts, or external network requests are made with your documents or data.

---

## Key Features

1. **Derived Automatic Renumbering**:
   - No numbers are ever typed or stored; all component numbers, cover pages, and start pages are derived strictly from order.
   - Drag components or fixtures to reorder, and everything renumbers instantly.
2. **Bulk One-Click Upload**:
   - Pick or drag your entire `Submittal` folder. Binder automatically turns each subfolder into a numbered Component and its PDFs into Fixtures. Loose PDFs become individual components.
   - Natural sorting (`localeCompare` with `numeric: true`) applied by default.
3. **Generated Component Covers**:
   - Clean Letter portrait separator sheet for each component (`Component {n}: {name}`). Font automatically scales or wraps for long descriptions.
4. **Automated Table of Contents (TOC)**:
   - Formatted table with columns `#`, `Component Name`, `Submitted in this Package`, `Where Previously Approved`, and reviewer `Status Code`.
   - Real vector table borders, wrapped cell text, and repeated headers across multi-page TOCs.
5. **Continuous Page Numbers**:
   - Stamps `Page {page} of {total}` at the visual bottom-center of every page.
   - Automatically handles mixed page sizes (Letter, Tabloid 11×17, Arch), non-default `CropBox` coordinates, and rotated landscape pages (`/Rotate` of 0°, 90°, 180°, and 270°).
6. **Hierarchical Bookmarks (PDF Outlines)**:
   - Builds native PDF outline trees from low-level objects (`Component` -> `Fixture` with `.pdf` extension stripped).
7. **Web Worker Performance**:
   - Merging runs off the main thread with an honest progress bar and cancellation support.
   - Processes source PDFs one file at a time to minimize browser heap memory.
8. **Project File Persistence (`.json`)**:
   - Save your submittal structure to a lightweight JSON file validated with Zod.
   - Reopen anytime with automatic path matching and a "Missing Files" reconciliation dialog.
9. **Full Undo/Redo**:
   - Reducer-backed history stack with keyboard shortcuts (`Ctrl+Z`, `Ctrl+Y`).

---

## How to Use

### 1. Add Folders & PDFs
- **Option A (Recommended)**: Drag and drop your main submittal folder into the dropzone (or click **Select Submittal Folder**). Binder imports all component folders and loose PDFs in bulk.
- **Option B**: Select loose PDF cut sheets or individual folders.

### 2. Arrange Your Submittal
- **Reorder**: Drag any component or fixture using its drag handle.
- **Move Fixtures**: Drag a fixture between different components.
- **Rename**: Click on any component title to rename it inline.
- **Review Notes**: Enter details in the *Where Previously Approved* field for the TOC table.
- **Insert / Delete**: Add additional PDFs to components or remove fixtures with confirmation protection.

### 3. Build & Download
- Click **Build Submittal** in the header.
- Watch the progress bar as Binder generates covers, formats the TOC, merges source files, applies continuous page numbers, and writes bookmarks.
- Click **Download Submittal PDF** to save your final package.

### 4. Save & Reopen
- Click **Save** to export your submittal structure as `submittal-binder-project.json`.
- Click **Open** to reload a project file. If source files need to be re-linked from disk, the reconciliation modal guides you to re-select the folder.

---

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl + Z` / `Cmd + Z` | Undo last change |
| `Ctrl + Y` / `Cmd + Y` or `Ctrl + Shift + Z` | Redo change |

---

## Tested Size Limit

*(This section is reserved for recording stress-test thresholds and memory boundaries on target environments.)*

- **Target Environments**: Google Chrome / Microsoft Edge (Desktop, 64-bit).
- **Tested Package Size**: Verified with standard packages up to ~25 MB to ~250 MB.
- **Memory Boundary**: Browser tabs typically have a heap ceiling between 2 GB and 4 GB. For packages approaching 500 MB+, processing in smaller batches or using vector-optimized sources is recommended.

---

## Technical Stack

- **Framework**: Vite + React 19 + TypeScript (strict mode)
- **Styling**: Vanilla CSS design system (dark mode, glassmorphic cards, responsive feedback)
- **Drag & Drop**: `@dnd-kit/core`, `@dnd-kit/sortable`
- **PDF Engine**: `pdf-lib` (merging, covers, table generation, rotation-aware stamping, low-level outline tree)
- **Previews & Metrics**: `pdfjs-dist` (canvas first-page thumbnails and page counting without heap duplication)
- **Validation**: `zod` schema validation for project files
- **Testing**: `vitest` unit test suite

---

## Development

```bash
# Install dependencies
npm install

# Start local dev server
npm run dev

# Run unit tests
npm test

# Build production bundle
npm run build
```

---

## License

This project is licensed under the [MIT License](LICENSE).
