import React from 'react';

const MetricCard = ({ title, value, type, isActive, progress }) => {
    return (
        <div className={`card ${type}`}>
            <div className="card-header">
                <div className="status-indicator">
                    <div className={`led ${isActive ? 'active' : ''}`}></div>
                    {isActive ? 'ALIVE' : 'OFFLINE'}
                </div>
                <span className="isp-label">{title}</span>
            </div>

            <div className="stat-value">{value.toFixed(2)} GB</div>
            <div className="stat-label">Total Consumption</div>

            <div className="progress-container">
                <div
                    className="progress-bar"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
        </div>
    );
};

export default MetricCard;
