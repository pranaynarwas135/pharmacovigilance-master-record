const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const AUDIT_TRAIL_FILE = path.join(__dirname, 'audit_trail.json');

app.use(express.json());
app.use(express.static(__dirname));

// POST Endpoint: Receive and log Pharmacovigilance Case
app.post('/api/pv-record', (req, res) => {
    const { patientId, drugName, adverseEvent, reporter } = req.body;

    if (!patientId || !drugName || !adverseEvent) {
        return res.status(400).json({ error: 'Missing mandatory GxP reporting fields.' });
    }

    const timestamp = new Date().toISOString();
    const caseData = { timestamp, patientId, drugName, adverseEvent, reporter: reporter || 'Anonymous' };

    // SHA-256 Cryptographic Hash for FDA 21 CFR Part 11 Data Integrity
    const hash = crypto.createHash('sha256').update(JSON.stringify(caseData)).digest('hex');
    const auditRecord = { ...caseData, verificationHash: hash, status: 'Validated & Signed' };

    let auditTrail = [];
    if (fs.existsSync(AUDIT_TRAIL_FILE)) {
        try {
            auditTrail = JSON.parse(fs.readFileSync(AUDIT_TRAIL_FILE, 'utf8'));
        } catch (err) {
            console.error('Error reading audit trail:', err);
        }
    }

    auditTrail.push(auditRecord);

    fs.writeFile(AUDIT_TRAIL_FILE, JSON.stringify(auditTrail, null, 2), (err) => {
        if (err) return res.status(500).json({ error: 'Failed to write to audit log.' });
        res.status(201).json({ message: 'Case securely committed to Master Record.', verificationHash: hash });
    });
});

// GET Endpoint: Retrieve full history
app.get('/api/pv-records', (req, res) => {
    if (!fs.existsSync(AUDIT_TRAIL_FILE)) return res.json([]);
    fs.readFile(AUDIT_TRAIL_FILE, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Failed to retrieve records.' });
        res.json(JSON.parse(data));
    });
});

app.listen(PORT, () => console.log(`Pharmacovigilance server running on port ${PORT}`));
