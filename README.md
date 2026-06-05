# PDF Browser with Bookmarking

A lightweight Node.js/Express web application for browsing local PDF files and setting bookmarks.

## Features
- **Browse PDFs:** View and navigate PDFs stored in a local directory.
- **Set Bookmarks:** Set up to 3 bookmarks per category (e.g. document, tasks, budgeting, expertise, phases).
- **Persistent Bookmarks:** Bookmarks are saved directly to a `bookmarks.csv` file within the selected PDF directory.
- **Folder Picker:** Select folders dynamically on macOS using a native system dialog.

## Getting Started

### Prerequisites
- Node.js installed.

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```

### Running the App
1. Start the server using the helper script:
   ```bash
   ./run.sh
   ```
2. Open your browser and navigate to [http://localhost:3000](http://localhost:3000).
