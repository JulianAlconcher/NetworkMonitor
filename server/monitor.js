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

const IS_SIMULATION = process.env.SIMULATION_MODE === 'true';

// Simulation data generator
function getSimulatedTraffic() {
    return Math.floor(Math.random() * 5 * 1024 * 1024); // Random 0-5 MB
}

// ASUS SSH Polling (Personal ISP)
async function pollAsus() {
    if (IS_SIMULATION) {
        state.history['Personal'].bytesIn += getSimulatedTraffic();
        state.history['Personal'].bytesOut += getSimulatedTraffic() * 0.1;
        state.history['Personal'].lastCheck = Date.now();
        return;
    }

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
    }).connect({
        host: process.env.ASUS_HOST || '192.168.50.1',
        port: 22,
        username: process.env.ASUS_USER || 'admin',
        password: process.env.ASUS_PASS
    });
}

function parseAsusTraffic(output) {
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

// Starlink Polling
async function pollStarlink() {
    if (IS_SIMULATION) {
        state.history['Starlink'].bytesIn += getSimulatedTraffic();
        state.history['Starlink'].bytesOut += getSimulatedTraffic() * 0.1;
        state.history['Starlink'].lastCheck = Date.now();
        return;
    }

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
                }
            }
            state.lastStarlinkStats = currentTotal;
        }
    } catch (e) {
        console.error('Starlink polling failed:', e.message);
    }
}

// Routes
app.get('/api/status', (req, res) => {
    res.json({
        currentIsp: 'Multi-Network (Active)',
        history: state.history,
        simulation: IS_SIMULATION
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
    console.log(`\n🚀 NOC Monitor running at http://localhost:${port}`);
    if (IS_SIMULATION) console.log('⚠️  SIMULATION MODE ENABLED');
});
