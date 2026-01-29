let usageChart = null;

async function fetchData() {
    try {
        const response = await fetch('http://localhost:3001/api/status');
        const data = await response.json();
        updateUI(data);
    } catch (e) {
        console.error('Failed to fetch stats:', e);
    }
}

function updateUI(data) {
    const { currentIsp, history } = data;

    // Update Badge
    const badge = document.getElementById('active-isp-badge');
    badge.textContent = `Monitoring: Starlink + Personal`;
    badge.className = `isp-badge monitoring`;

    // Calculate totals
    const starlinkTotal = (history['Starlink'].bytesIn + history['Starlink'].bytesOut) / (1024 ** 3);
    const personalTotal = (history['Personal'].bytesIn + history['Personal'].bytesOut) / (1024 ** 3);
    const total = starlinkTotal + personalTotal;

    // Update stats
    document.getElementById('starlink-usage').textContent = `${starlinkTotal.toFixed(2)} GB`;
    document.getElementById('personal-usage').textContent = `${personalTotal.toFixed(2)} GB`;
    document.getElementById('last-update').textContent = new Date().toLocaleTimeString();

    // Update progress bars
    const starlinkPercent = total > 0 ? (starlinkTotal / total) * 100 : 0;
    const personalPercent = total > 0 ? (personalTotal / total) * 100 : 0;
    document.getElementById('starlink-progress').style.width = `${starlinkPercent}%`;
    document.getElementById('personal-progress').style.width = `${personalPercent}%`;

    updateChart(starlinkTotal, personalTotal);
}

function updateChart(starlink, personal) {
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
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        padding: 20,
                        font: { family: 'Inter', size: 14 }
                    }
                }
            },
            cutout: '75%'
        }
    });
}

document.getElementById('reset-btn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all usage history?')) {
        await fetch('http://localhost:3001/api/reset', { method: 'POST' });
        fetchData();
    }
});

// Initial fetch and poll
fetchData();
setInterval(fetchData, 10000);
