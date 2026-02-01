import React from 'react';

const SystemHealth = ({ cpu, ram, uptime }) => {
    return (
        <section className="details">
            <div className="card info-card">
                <div className="info-grid">
                    <div className="info-item">
                        <span className="label">Last Sync</span>
                        <span className="value">{new Date().toLocaleTimeString()}</span>
                    </div>
                    <div className="info-item">
                        <span className="label">CPU Load</span>
                        <span className="value">{cpu || 0}%</span>
                    </div>
                    <div className="info-item">
                        <span className="label">RAM Usage</span>
                        <span className="value">{ram || 0}%</span>
                    </div>
                    <div className="info-item">
                        <span className="label">Uptime</span>
                        <span className="value">{uptime || '-'}</span>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default SystemHealth;
