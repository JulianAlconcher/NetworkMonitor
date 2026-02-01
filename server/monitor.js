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
app.use(express.static(path.join(__dirname, '../web/dist')));

const DB_PATH = path.join(__dirname, 'usage-history.json');

let state = {
    history: {
        'Starlink': { bytesIn: 0, bytesOut: 0, lastCheck: Date.now() },
        'Personal': { bytesIn: 0, bytesOut: 0, lastCheck: Date.now() }
    },
    logs: [],
    lastAsusStats: null,
    lastStarlinkStats: null
};

// Log helper
function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { timestamp, message, type };
    state.logs.push(logEntry);
    if (state.logs.length > 50) state.logs.shift();

    // Console output for terminal
    const colors = { info: '\x1b[37m', success: '\x1b[32m', warn: '\x1b[33m', error: '\x1b[31m' };
    console.log(`${colors[type] || colors.info}[${timestamp}] ${message}\x1b[0m`);
}

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
    if (!process.env.ASUS_PASS) {
        addLog('ASUS: Missing password in .env', 'warn');
        return;
    }

    const conn = new Client();
    conn.on('ready', () => {
        conn.exec('cat /proc/net/dev', (err, stream) => {
            if (err) {
                addLog(`ASUS SSH Exec Error: ${err.message}`, 'error');
                return;
            }
            let data = '';
            stream.on('data', (d) => data += d);
            stream.on('close', () => {
                parseAsusTraffic(data);
                conn.end();
            });
        });
    }).on('error', (err) => {
        addLog(`ASUS SSH Connection Error: ${err.message}`, 'error');
    }).connect({
        host: process.env.ASUS_HOST || '192.168.50.1',
        port: 22,
        username: process.env.ASUS_USER || 'admin',
        password: process.env.ASUS_PASS,
        readyTimeout: 5000
    });
}

const { parseAsusOutput } = require('./parser');

function parseAsusTraffic(output) {
    const stats = parseAsusOutput(output);

    if (stats) {
        const { rx, tx } = stats;

        if (state.lastAsusStats) {
            const rxDiff = rx - state.lastAsusStats.rx;
            const txDiff = tx - state.lastAsusStats.tx;

            if (rxDiff >= 0 && txDiff >= 0) {
                state.history['Personal'].bytesIn += rxDiff;
                state.history['Personal'].bytesOut += txDiff;
                state.history['Personal'].lastCheck = Date.now();
                if (rxDiff > 0) addLog(`ASUS: Updated traffic +${(rxDiff / (1024 * 1024)).toFixed(2)} MB`, 'success');
            }
        }
        state.lastAsusStats = { rx, tx };
    }
}

// Starlink Polling
async function pollStarlink() {
    try {
        const url = `http://${process.env.STARLINK_HOST || '192.168.100.1'}/support/debug`;
        const res = await fetch(url, { timeout: 5000 });
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

        const text = await res.text();
        let data = JSON.parse(text);

        const stats = data?.dish?.deviceState?.consumption;
        if (stats) {
            const currentTotal = stats.totalBytes || 0;
            if (state.lastStarlinkStats !== null) {
                const diff = currentTotal - state.lastStarlinkStats;
                if (diff >= 0) {
                    state.history['Starlink'].bytesIn += diff;
                    state.history['Starlink'].lastCheck = Date.now();
                    if (diff > 0) addLog(`Starlink: Updated traffic +${(diff / (1024 * 1024)).toFixed(2)} MB`, 'success');
                }
            }
            state.lastStarlinkStats = currentTotal;
        }
    } catch (e) {
        addLog(`Starlink Polling Failed: ${e.message}`, 'error');
    }
}

const si = require('systeminformation');
const os = require('os');

// Routes
app.get('/api/status', async (req, res) => {
    try {
        const cpu = await si.currentLoad();
        const mem = await si.mem();

        res.json({
            currentIsp: 'Multi-Network (Active)',
            history: state.history,
            system: {
                cpu: Math.round(cpu.currentLoad),
                ram: Math.round((mem.active / mem.total) * 100),
                uptime: Math.round(os.uptime())
            }
        });
    } catch (e) {
        res.json({
            currentIsp: 'Multi-Network (Active)',
            history: state.history,
            system: { cpu: 0, ram: 0, uptime: 0 }
        });
    }
});

app.get('/api/logs', (req, res) => {
    res.json(state.logs);
});

app.post('/api/reset', (req, res) => {
    state.history = {
        'Starlink': { bytesIn: 0, bytesOut: 0, lastCheck: Date.now() },
        'Personal': { bytesIn: 0, bytesOut: 0, lastCheck: Date.now() }
    };
    addLog('System reset requested by user', 'warn');
    saveDb();
    res.json({ message: 'History reset' });
});

cron.schedule('* * * * *', () => {
    pollAsus();
    pollStarlink();
    saveDb();
});

app.listen(port, () => {
    addLog(`NOC Monitor running at http://localhost:${port}`, 'info');
});
