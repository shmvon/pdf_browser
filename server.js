const express = require('express');
const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const cors = require('cors');
const bodyParser = require('body-parser');
const { execSync } = require('child_process');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

let pdfDir = path.join(__dirname, 'Pdf');
let csvFile = path.join(pdfDir, 'bookmarks.csv');

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Serve PDFs dynamically based on current pdfDir
app.use('/pdfs', (req, res, next) => {
    express.static(pdfDir)(req, res, next);
});

// Ensure Pdf directory exists
if (!fs.existsSync(pdfDir)) {
    fs.mkdirSync(pdfDir);
}

// Columns for CSV
const chapters = ['document', 'taken', 'fasering', 'expertise', 'budget'];
const headers = ['filename'];
chapters.forEach(ch => {
    headers.push(`${ch}_1`, `${ch}_2`, `${ch}_3`);
});

// Helper to ensure CSV exists and has headers
function ensureCsvExists() {
    if (!fs.existsSync(csvFile)) {
        const writableStream = fs.createWriteStream(csvFile);
        const csvStream = csv.format({ headers });
        csvStream.pipe(writableStream);
        csvStream.end();
    }
}

ensureCsvExists();

app.get('/api/folder', (req, res) => {
    res.json({ folder: pdfDir });
});

app.post('/api/folder', (req, res) => {
    const { folder } = req.body;
    if (!folder || !fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
        return res.status(400).json({ error: 'Invalid or non-existent directory path.' });
    }
    pdfDir = folder;
    csvFile = path.join(pdfDir, 'bookmarks.csv');
    ensureCsvExists();
    res.json({ success: true, folder: pdfDir });
});

app.get('/api/pick-folder', (req, res) => {
    try {
        // Use AppleScript to show a native folder picker dialog
        const script = 'POSIX path of (choose folder with prompt "Select the PDF folder:")';
        const pathPicked = execSync(`osascript -e '${script}'`).toString().trim();
        
        if (pathPicked && fs.existsSync(pathPicked) && fs.statSync(pathPicked).isDirectory()) {
            pdfDir = pathPicked;
            csvFile = path.join(pdfDir, 'bookmarks.csv');
            ensureCsvExists();
            res.json({ success: true, folder: pdfDir });
        } else {
            res.json({ success: false, error: 'Invalid folder selected' });
        }
    } catch (e) {
        // User likely canceled the dialog
        res.json({ success: false, error: 'Canceled' });
    }
});

app.get('/api/pdfs', (req, res) => {
    fs.readdir(pdfDir, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to read directory' });
        }
        const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
        res.json({ files: pdfFiles });
    });
});

app.get('/api/bookmarks', (req, res) => {
    const data = [];
    fs.createReadStream(csvFile)
        .pipe(csv.parse({ headers: true }))
        .on('data', row => data.push(row))
        .on('end', () => {
            res.json(data);
        })
        .on('error', err => {
            console.error('Error reading CSV:', err);
            res.status(500).json({ error: 'Failed to read bookmarks' });
        });
});

app.post('/api/bookmarks', (req, res) => {
    const { filename, chapter, bookmarks } = req.body;
    
    if (!filename || !chapter || !bookmarks || bookmarks.length !== 3) {
        return res.status(400).json({ error: 'Invalid data format' });
    }

    const allData = [];
    let fileFound = false;

    fs.createReadStream(csvFile)
        .pipe(csv.parse({ headers: true }))
        .on('data', row => {
            if (row.filename === filename) {
                fileFound = true;
                row[`${chapter}_1`] = bookmarks[0] !== null ? bookmarks[0] : '';
                row[`${chapter}_2`] = bookmarks[1] !== null ? bookmarks[1] : '';
                row[`${chapter}_3`] = bookmarks[2] !== null ? bookmarks[2] : '';
            }
            allData.push(row);
        })
        .on('end', () => {
            if (!fileFound) {
                // Add new row if not found
                const newRow = { filename };
                headers.forEach(h => {
                    if (h !== 'filename') newRow[h] = '';
                });
                newRow[`${chapter}_1`] = bookmarks[0] !== null ? bookmarks[0] : '';
                newRow[`${chapter}_2`] = bookmarks[1] !== null ? bookmarks[1] : '';
                newRow[`${chapter}_3`] = bookmarks[2] !== null ? bookmarks[2] : '';
                
                // Document always has page 1 for first bookmark if newly created, but let frontend handle it or enforce here?
                // Request said "The document chapter always has page 1 bookmarked by default."
                // I'll set it here if newly created row.
                if (chapter !== 'document') {
                    newRow['document_1'] = '1';
                } else if (!bookmarks[0]) {
                    newRow['document_1'] = '1';
                }
                
                allData.push(newRow);
            }

            const writableStream = fs.createWriteStream(csvFile);
            const csvStream = csv.format({ headers: true });
            csvStream.pipe(writableStream);
            allData.forEach(row => csvStream.write(row));
            csvStream.end();

            res.json({ success: true, data: allData });
        })
        .on('error', err => {
            console.error('Error updating CSV:', err);
            res.status(500).json({ error: 'Failed to update bookmarks' });
        });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
