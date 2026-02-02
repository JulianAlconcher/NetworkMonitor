import React, { useState, useEffect, useRef } from 'react';
// import './App.css';
import MetricCard from './components/MetricCard';
import SystemHealth from './components/SystemHealth';
import ChartsPanel from './components/ChartsPanel';
import Terminal from './components/Terminal';
import { Activity, RefreshCw } from 'lucide-react';

const API_BASE = window.location.origin;

function App() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [lastLogCount, setLastLogCount] = useState(0);
  const [trafficHistory, setTrafficHistory] = useState({
    labels: [],
    starlink: [],
    personal: []
  });

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/status`);
      const data = await res.json();
      setStats(data);
      updateTrafficHistory(data);
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/logs`);
      const data = await res.json();
      if (data.length !== lastLogCount) {
        setLogs(data);
        setLastLogCount(data.length);
      }
    } catch (e) {
      console.error('Failed to fetch logs:', e);
    }
  };

  const updateTrafficHistory = (data) => {
    const { history } = data;
    const starlinkTotal = (history['Starlink'].bytesIn + history['Starlink'].bytesOut) / (1024 ** 3);
    const personalTotal = (history['Personal'].bytesIn + history['Personal'].bytesOut) / (1024 ** 3);
    const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setTrafficHistory(prev => {
      const newLabels = [...prev.labels, timeLabel];
      const newStarlink = [...prev.starlink, starlinkTotal];
      const newPersonal = [...prev.personal, personalTotal];

      if (newLabels.length > 30) {
        newLabels.shift();
        newStarlink.shift();
        newPersonal.shift();
      }

      return {
        labels: newLabels,
        starlink: newStarlink,
        personal: newPersonal
      };
    });
  };

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reset all usage history?')) {
      await fetch(`${API_BASE}/api/reset`, { method: 'POST' });
      setTrafficHistory({ labels: [], starlink: [], personal: [] });
      fetchStats();
      fetchLogs();
    }
  };

  useEffect(() => {
    fetchStats();
    fetchLogs();
    const statsInterval = setInterval(fetchStats, 10000);
    const logsInterval = setInterval(fetchLogs, 3000);

    return () => {
      clearInterval(statsInterval);
      clearInterval(logsInterval);
    };
  }, []);

  if (!stats) return <div className="loading">Initiating connection...</div>;

  const starlinkTotal = (stats.history['Starlink'].bytesIn + stats.history['Starlink'].bytesOut) / (1024 ** 3);
  const personalTotal = (stats.history['Personal'].bytesIn + stats.history['Personal'].bytesOut) / (1024 ** 3);
  const totalGB = starlinkTotal + personalTotal;

  const starlinkPercent = totalGB > 0 ? (starlinkTotal / totalGB) * 100 : 0;
  const personalPercent = totalGB > 0 ? (personalTotal / totalGB) * 100 : 0;

  const now = Date.now();
  const starlinkActive = (now - stats.history['Starlink'].lastCheck) < 120000;
  const personalActive = (now - stats.history['Personal'].lastCheck) < 120000;

  return (
    <div className="container">
      <header>
        <div className="logo">
          <Activity className="icon" size={28} color="#3b82f6" />
          <h1>NOC<span>Monitor</span></h1>
        </div>
        <div className="isp-badge monitoring">
          Live Monitoring
        </div>
      </header>

      <main>
        <div className="overview">
          <MetricCard
            title="Starlink V4"
            type="starlink"
            value={starlinkTotal}
            progress={starlinkPercent}
            isActive={starlinkActive}
          />
          <MetricCard
            title="Personal FLOW"
            type="personal"
            value={personalTotal}
            progress={personalPercent}
            isActive={personalActive}
          />
        </div>

        <SystemHealth
          cpu={stats.system?.cpu}
          ram={stats.system?.ram}
          uptime={stats.system?.uptime ? formatUptime(stats.system.uptime) : '-'}
        />

        <ChartsPanel
          starlinkData={starlinkTotal}
          personalData={personalTotal}
          timelineLabels={trafficHistory.labels}
          starlinkHistory={trafficHistory.starlink}
          personalHistory={trafficHistory.personal}
        />

        <Terminal logs={logs} />
      </main>

      <footer>
        <div className="footer-info">
          © 2026 Network Monitoring System | House Node
        </div>
        <button className="btn-reset" onClick={handleReset}>
          <RefreshCw size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Reset History
        </button>
      </footer>
    </div>
  );
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

export default App;
