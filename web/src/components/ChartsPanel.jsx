import React from 'react';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Filler,
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Filler
);

const ChartsPanel = ({ starlinkData, personalData, timelineLabels, starlinkHistory, personalHistory }) => {
    const doughnutData = {
        labels: ['Starlink', 'Personal'],
        datasets: [{
            data: [starlinkData, personalData],
            backgroundColor: ['#3b82f6', '#06b6d4'],
            borderWidth: 0,
            hoverOffset: 15
        }]
    };

    const lineData = {
        labels: timelineLabels,
        datasets: [
            {
                label: 'Starlink (GB)',
                data: starlinkHistory,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 0
            },
            {
                label: 'Personal (GB)',
                data: personalHistory,
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 0
            }
        ]
    };

    const lineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: { color: '#64748b' }
            },
            x: {
                grid: { display: false },
                ticks: { color: '#64748b', maxRotation: 0 }
            }
        },
        plugins: {
            legend: { display: false }
        }
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: { color: '#94a3b8', padding: 20, font: { family: 'Inter', size: 12 } }
            }
        },
        cutout: '80%'
    };

    return (
        <div className="charts-row">
            <div className="card chart-card">
                <h3>Traffic Timeline (GB)</h3>
                <div className="chart-container">
                    <Line data={lineData} options={lineOptions} />
                </div>
            </div>

            <div className="card chart-card">
                <h3>Distribution</h3>
                <div className="chart-container">
                    <Doughnut data={doughnutData} options={doughnutOptions} />
                </div>
            </div>
        </div>
    );
};

export default ChartsPanel;
