// State
let pdfs = [];
let bookmarksData = [];
let currentPdf = null;
let currentChapter = 'document';
let currentFolder = '';

// DOM Elements
const fileListEl = document.getElementById('file-list');
const chapterBtns = document.querySelectorAll('.chapter-btn');
const currentChapterLabel = document.getElementById('current-chapter-label');
const viewerContainer = document.getElementById('viewer-container');
const refreshBtn = document.getElementById('refresh-files');
const openFolderBtn = document.getElementById('open-folder-btn');
const statusMessage = document.getElementById('status-message');
const dropZone = document.getElementById('drop-zone');
const currentFolderDisplay = document.getElementById('current-folder-display');

const bmInputs = {
    1: document.getElementById('bm-1'),
    2: document.getElementById('bm-2'),
    3: document.getElementById('bm-3')
};
const goBtns = document.querySelectorAll('.go-btn');
const saveBtns = document.querySelectorAll('.save-btn');
const eraseBtns = document.querySelectorAll('.erase-btn');
const missingBtns = document.querySelectorAll('.missing-btn');

// Initialize
async function init() {
    await fetchCurrentFolder();
    await fetchPdfs();
    await fetchBookmarks();
    setupEventListeners();
    renderFileList();
    updateBookmarkInputs();
}

// API Calls
async function fetchCurrentFolder() {
    try {
        const res = await fetch('/api/folder');
        const data = await res.json();
        currentFolder = data.folder;
        currentFolderDisplay.textContent = currentFolder;
    } catch (err) {
        console.error('Failed to fetch folder:', err);
    }
}

async function pickNativeFolder() {
    try {
        showStatus('Opening folder dialog...');
        const res = await fetch('/api/pick-folder');
        const data = await res.json();
        if (data.success) {
            currentFolder = data.folder;
            currentFolderDisplay.textContent = currentFolder;
            currentPdf = null;
            viewerContainer.innerHTML = '<div class="empty-state">Select a PDF to view</div>';
            await fetchPdfs();
            await fetchBookmarks();
            renderFileList();
            updateBookmarkInputs();
            showStatus('Folder changed successfully!');
        } else if (data.error !== 'Canceled') {
            showStatus(data.error || 'Failed to change folder', true);
        } else {
            showStatus('Folder selection canceled');
        }
    } catch (err) {
        console.error('Failed to pick folder:', err);
        showStatus('Error changing folder.', true);
    }
}

async function setFolder(newFolder) {
    try {
        const res = await fetch('/api/folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder: newFolder })
        });
        const data = await res.json();
        if (data.success) {
            currentFolder = data.folder;
            currentFolderDisplay.textContent = currentFolder;
            currentPdf = null; // reset view
            viewerContainer.innerHTML = '<div class="empty-state">Select a PDF to view</div>';
            await fetchPdfs();
            await fetchBookmarks();
            renderFileList();
            updateBookmarkInputs();
            showStatus('Folder changed successfully!');
        } else {
            showStatus(data.error || 'Failed to change folder', true);
        }
    } catch (err) {
        console.error('Failed to change folder:', err);
        showStatus('Error changing folder.', true);
    }
}

async function fetchPdfs() {
    try {
        const res = await fetch('/api/pdfs');
        const data = await res.json();
        pdfs = data.files || [];
    } catch (err) {
        console.error('Failed to fetch PDFs:', err);
    }
}

async function fetchBookmarks() {
    try {
        const res = await fetch('/api/bookmarks');
        bookmarksData = await res.json();
    } catch (err) {
        console.error('Failed to fetch bookmarks:', err);
    }
}

async function saveBookmarks() {
    if (!currentPdf) return;

    const bmValues = [
        bmInputs[1].value || null,
        bmInputs[2].value || null,
        bmInputs[3].value || null
    ];

    try {
        const res = await fetch('/api/bookmarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: currentPdf,
                chapter: currentChapter,
                bookmarks: bmValues
            })
        });
        const data = await res.json();
        if (data.success) {
            bookmarksData = data.data; // update local state
            showStatus('Saved!');
        }
    } catch (err) {
        console.error('Failed to save bookmarks:', err);
        showStatus('Error saving bookmarks.', true);
    }
}

// Helpers
function getFileBookmarks(filename, chapter) {
    const row = bookmarksData.find(b => b.filename === filename);
    if (!row) {
        // If "document" return 1 for first bookmark
        return chapter === 'document' ? ['1', '', ''] : ['', '', ''];
    }
    return [
        row[`${chapter}_1`] || '',
        row[`${chapter}_2`] || '',
        row[`${chapter}_3`] || ''
    ];
}

function showStatus(msg, isError = false) {
    statusMessage.textContent = msg;
    statusMessage.style.color = isError ? 'var(--danger-color)' : 'var(--success-color)';
    statusMessage.style.opacity = 1;
    setTimeout(() => {
        statusMessage.style.opacity = 0;
    }, 3000);
}

function renderFileList() {
    fileListEl.innerHTML = '';
    pdfs.forEach(pdf => {
        const li = document.createElement('li');
        li.className = 'file-item';
        if (pdf === currentPdf) li.classList.add('active');
        li.textContent = pdf;
        li.onclick = () => selectPdf(pdf);
        fileListEl.appendChild(li);
    });
}

function updateBookmarkInputs() {
    if (!currentPdf) {
        bmInputs[1].value = '';
        bmInputs[2].value = '';
        bmInputs[3].value = '';
        return;
    }

    const bms = getFileBookmarks(currentPdf, currentChapter);
    bmInputs[1].value = bms[0];
    bmInputs[2].value = bms[1];
    bmInputs[3].value = bms[2];
}

function selectPdf(pdf) {
    currentPdf = pdf;
    renderFileList();
    updateBookmarkInputs();

    // Auto go to first available bookmark for current chapter
    const bms = getFileBookmarks(currentPdf, currentChapter);
    const firstBm = bms.find(b => b !== '' && b !== 'N/A');
    const pageStr = firstBm ? `#page=${firstBm}` : '';

    viewerContainer.innerHTML = `<iframe id="pdf-viewer" src="/pdfs/${encodeURIComponent(pdf)}${pageStr}"></iframe>`;
}

function selectChapter(chapter) {
    currentChapter = chapter;
    currentChapterLabel.textContent = chapter;

    chapterBtns.forEach(btn => {
        if (btn.dataset.chapter === chapter) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    updateBookmarkInputs();

    // If a PDF is open, navigate to the first bookmark of the new chapter
    if (currentPdf) {
        const bms = getFileBookmarks(currentPdf, currentChapter);
        const firstBm = bms.find(b => b !== '' && b !== 'N/A');
        const pageStr = firstBm ? `#page=${firstBm}` : '';
        viewerContainer.innerHTML = `<iframe id="pdf-viewer" src="/pdfs/${encodeURIComponent(currentPdf)}${pageStr}"></iframe>`;
    }
}

function goToBookmark(slotIndex) {
    if (!currentPdf) return;
    const page = bmInputs[slotIndex].value;
    if (page && page !== 'N/A') {
        viewerContainer.innerHTML = `<iframe id="pdf-viewer" src="/pdfs/${encodeURIComponent(currentPdf)}#page=${page}"></iframe>`;
    }
}

// Event Listeners
function setupEventListeners() {
    chapterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            selectChapter(e.target.dataset.chapter);
        });
    });

    openFolderBtn.addEventListener('click', () => {
        // Use native dialog instead of prompt
        pickNativeFolder();
    });

    // Drag and drop for folder path
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');

        // Browsers restrict absolute paths of dropped files/folders
        // But if someone drags text (like a path string), we can use it
        const textData = e.dataTransfer.getData('text/plain');
        if (textData && textData.includes('/')) {
            setFolder(textData.trim());
        } else {
            showStatus('Browser security prevents dropping folders directly. Please use the 📁 icon.', true);
        }
    });

    refreshBtn.addEventListener('click', async () => {
        await fetchPdfs();
        await fetchBookmarks();
        renderFileList();
        showStatus('Refreshed!');
    });

    goBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            goToBookmark(e.target.dataset.slot);
        });
    });

    saveBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            saveBookmarks();
        });
    });

    eraseBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const slot = e.target.dataset.slot;
            bmInputs[slot].value = '';
            saveBookmarks();
        });
    });

    missingBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const slot = e.target.dataset.slot;
            bmInputs[slot].value = 'N/A';
            saveBookmarks();
        });
    });
}

// Boot
init();
