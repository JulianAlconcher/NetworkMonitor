let usageChart = null;
let timelineChart = null;
let trafficHistory = {
    labels: [],
    starlink: [],
    personal: []
};

async function fetchData() {
    try {
        const response = await fetch('http://localhost:3001/api/status');
        const data = await response.json();
        updateUI(data);
    } catch (e) {
        console.error('Failed to fetch stats:', e);
        updateStatusLEDs(false, false);
    }
}

function updateUI(data) {
    const { currentIsp, history } = data;

    // Calculate totals in GB
    const starlinkTotal = (history['Starlink'].bytesIn + history['Starlink'].bytesOut) / (1024 ** 3);
    const personalTotal = (history['Personal'].bytesIn + history['Personal'].bytesOut) / (1024 ** 3);
    const totalGB = starlinkTotal + personalTotal;

    // Update Text Stats
    document.getElementById('starlink-usage').textContent = `${starlinkTotal.toFixed(2)} GB`;
    document.getElementById('personal-usage').textContent = `${personalTotal.toFixed(2)} GB`;
    document.getElementById('last-update').textContent = new Date().toLocaleTimeString();

    // Update Progress Bars (Relative contribution)
    const starlinkPercent = totalGB > 0 ? (starlinkTotal / totalGB) * 100 : 0;
    const personalPercent = totalGB > 0 ? (personalTotal / totalGB) * 100 : 0;
    document.getElementById('starlink-progress').style.width = `${starlinkPercent}%`;
    document.getElementById('personal-progress').style.width = `${personalPercent}%`;

    // Update LEDs (active if lastCheck < 2 minutes ago)
    const now = Date.now();
    const starlinkActive = (now - history['Starlink'].lastCheck) < 120000;
    const personalActive = (now - history['Personal'].lastCheck) < 120000;
    updateStatusLEDs(starlinkActive, personalActive);

    // Update Charts
    updateDistributionChart(starlinkTotal, personalTotal);
    updateTimelineChart(starlinkTotal, personalTotal);
}

function updateStatusLEDs(starlink, personal) {
    const sLed = document.getElementById('starlink-led');
    const pLed = document.getElementById('personal-led');

    sLed.className = `led ${starlink ? 'active' : ''}`;
    pLed.className = `led ${personal ? 'active' : ''}`;
}

function updateDistributionChart(starlink, personal) {
    const ctx = document.getElementById('usageChart').getContext('2d');

    if (usageChart) {
        usageChart.data.datasets[0].data = [starlink, personal];
        usageChart.update();
        return;
    }

    usageChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Starlink', 'Personal'],
            datasets: [{
                data: [starlink, personal],
                backgroundColor: ['#3b82f6', '#06b6d4'],
                borderWidth: 0,
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', padding: 20, font: { family: 'Inter', size: 12 } }
                }
            },
            cutout: '80%'
        }
    });
}

function updateTimelineChart(starlink, personal) {
    const ctx = document.getElementById('timelineChart').getContext('2d');
    const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Keep only last 30 data points
    if (trafficHistory.labels.length > 30) {
        trafficHistory.labels.shift();
        trafficHistory.starlink.shift();
        trafficHistory.personal.shift();
    }

    trafficHistory.labels.push(timeLabel);
    trafficHistory.starlink.push(starlink);
    trafficHistory.personal.push(personal);

    if (timelineChart) {
        timelineChart.update();
        return;
    }

    timelineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: trafficHistory.labels,
            datasets: [
                {
                    label: 'Starlink (GB)',
                    data: trafficHistory.starlink,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 0
                },
                {
                    label: 'Personal (GB)',
                    data: trafficHistory.personal,
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 0
                }
            ]
        },
        options: {
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
        }
    });
}

document.getElementById('reset-btn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all usage history?')) {
        await fetch('http://localhost:3001/api/reset', { method: 'POST' });
        trafficHistory = { labels: [], starlink: [], personal: [] };
        if (timelineChart) timelineChart.destroy();
        timelineChart = null;
        fetchData();
    }
});

// Initial fetch and poll
fetchData();
setInterval(fetchData, 10000); // 10s updates
