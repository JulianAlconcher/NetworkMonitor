require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));
app.use('/js', express.static(path.join(__dirname, '../js')));

const DB_PATH = path.join(__dirname, 'usage-history.json');

let state = {
    history: {
        'Starlink': { bytesIn: 0, bytesOut: 0, lastCheck: Date.now() },
        'Personal': { bytesIn: 0, bytesOut: 0, lastCheck: Date.now() }
    },
    lastAsusStats: null,
    lastStarlinkStats: null
};

// Load DB
if (fs.existsSync(DB_PATH)) {
    try {
        const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        state.history = data.history || state.history;
    } catch (e) {
        console.error('Error loading DB:', e);
    }
}

function saveDb() {
    fs.writeFileSync(DB_PATH, JSON.stringify({ history: state.history }, null, 2));
}

// ASUS SSH Polling (Personal ISP)
async function pollAsus() {
    if (!process.env.ASUS_PASS) return;

    const conn = new Client();
    conn.on('ready', () => {
        conn.exec('cat /proc/net/dev', (err, stream) => {
            if (err) return console.error('ASUS SSH Exec Error:', err);
            let data = '';
            stream.on('data', (d) => data += d);
            stream.on('close', () => {
                parseAsusTraffic(data);
                conn.end();
            });
        });
    }).on('error', (err) => {
        console.error('ASUS SSH Connection Error:', err.message);
        if (err.message.includes('authentication')) {
            console.warn('TIP: Check your .env credentials and ensure SSH is enabled in ASUS Admin -> System.');
        }
    }).connect({
        host: process.env.ASUS_HOST || '192.168.50.1',
        port: 22,
        username: process.env.ASUS_USER || 'admin',
        password: process.env.ASUS_PASS
    });
}

function parseAsusTraffic(output) {
    // We look for eth0 (typical WAN on ASUS RT-ACRH13) or ppp0
    const lines = output.split('\n');
    const wanLine = lines.find(l => l.includes('eth0:') || l.includes('ppp0') || l.includes('vlan2:'));

    if (wanLine) {
        const parts = wanLine.trim().split(/\s+/);
        const rx = parseInt(parts[1]);
        const tx = parseInt(parts[9]);

        if (state.lastAsusStats) {
            const rxDiff = rx - state.lastAsusStats.rx;
            const txDiff = tx - state.lastAsusStats.tx;

            if (rxDiff >= 0 && txDiff >= 0) {
                state.history['Personal'].bytesIn += rxDiff;
                state.history['Personal'].bytesOut += txDiff;
                state.history['Personal'].lastCheck = Date.now();
            }
        }
        state.lastAsusStats = { rx, tx };
    }
}

// Starlink Polling (via Support Debug JSON)
async function pollStarlink() {
    try {
        const url = `http://${process.env.STARLINK_HOST || '192.168.100.1'}/support/debug`;
        const res = await fetch(url, { timeout: 5000 });
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('Starlink returned non-JSON response. Check if 192.168.100.1 is showing the login page.');
            return;
        }

        // Extract stats from Starlink JSON (structure varies by firmware)
        const stats = data?.dish?.deviceState?.consumption;
        if (stats) {
            const currentTotal = stats.totalBytes || 0;
            if (state.lastStarlinkStats !== null) {
                const diff = currentTotal - state.lastStarlinkStats;
                if (diff >= 0) {
                    state.history['Starlink'].bytesIn += diff;
                    state.history['Starlink'].lastCheck = Date.now();
                }
            }
            state.lastStarlinkStats = currentTotal;
        }
    } catch (e) {
        console.error('Starlink polling failed:', e.message);
    }
}

async function isStarlinkReachable() {
    try {
        const res = await fetch(`http://192.168.100.1`, { timeout: 2000 });
        return res.ok;
    } catch {
        return false;
    }
}

// Routes
app.get('/api/status', (req, res) => {
    res.json({
        currentIsp: 'Multi-Network (Active)',
        history: state.history
    });
});

app.post('/api/reset', (req, res) => {
    state.history = {
        'Starlink': { bytesIn: 0, bytesOut: 0, lastCheck: Date.now() },
        'Personal': { bytesIn: 0, bytesOut: 0, lastCheck: Date.now() }
    };
    saveDb();
    res.json({ message: 'History reset' });
});

// Schedule
cron.schedule('* * * * *', () => {
    pollAsus();
    pollStarlink();
    saveDb();
});

app.listen(port, () => {
    console.log(`Integrated Monitor running at http://localhost:${port}`);
    console.log(`Please ensure .env is configured for ASUS SSH.`);
});
