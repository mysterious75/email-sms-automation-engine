const API_URL = 'http://localhost:3000/api';

// Detect if we are running on GitHub Pages (static mode)
const IS_STATIC_DEMO = window.location.hostname.includes('github.io') || window.location.hostname !== 'localhost';

const logsTableBody = document.querySelector('#logs-table tbody');
const emailCountEl = document.getElementById('email-count');
const smsCountEl = document.getElementById('sms-count');
const optoutCountEl = document.getElementById('optout-count');

// Mock state for static demo
let mockState = { emails: 412, sms: 184, optouts: 2, logs: [] };

// Tab Navigation Logic
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => {
            p.classList.remove('active');
            p.style.display = 'none';
        });
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-target');
        const targetPane = document.getElementById(targetId);
        targetPane.style.display = 'block';
        setTimeout(() => targetPane.classList.add('active'), 10);
    });
});

// Initialize Chart.js
let metricsChart;
function initChart() {
    const ctx = document.getElementById('metricsChart').getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(33, 137, 255, 0.5)'); 
    gradient.addColorStop(1, 'rgba(33, 137, 255, 0.0)');

    metricsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Today'],
            datasets: [{
                label: 'Total Engagement Events',
                data: [120, 190, 150, 250, 220, 300, mockState.emails + mockState.sms], 
                borderColor: '#2189ff',
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#2189ff',
                pointBorderWidth: 2,
                pointRadius: 4,
                fill: true,
                tension: 0.4 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#333', drawBorder: false }, ticks: { color: '#888' } },
                x: { grid: { display: false }, ticks: { color: '#888' } }
            }
        }
    });
}

async function fetchMetrics() {
    if (IS_STATIC_DEMO) {
        updateUIData(mockState.emails, mockState.sms, mockState.optouts);
        return;
    }
    try {
        const res = await fetch(`${API_URL}/metrics`);
        if(!res.ok) throw new Error('API Error');
        const data = await res.json();
        let emails = 0, sms = 0;
        data.channels.forEach(row => {
            if(row.channel === 'EMAIL') emails = row.count;
            if(row.channel === 'SMS') sms = row.count;
        });
        updateUIData(emails, sms, data.optOuts);
    } catch (err) {
        console.warn('Backend not running. Switching to Static Mock Mode.');
        updateUIData(mockState.emails, mockState.sms, mockState.optouts);
    }
}

function updateUIData(emails, sms, optouts) {
    emailCountEl.innerText = emails;
    smsCountEl.innerText = sms;
    optoutCountEl.innerText = optouts;
    
    document.querySelectorAll('.card-line').forEach(line => {
        line.style.width = '0%';
        setTimeout(() => { line.style.width = '100%'; }, 100);
    });

    if(metricsChart) {
        metricsChart.data.datasets[0].data[6] = emails + sms;
        metricsChart.update();
    }
}

async function fetchLogs() {
    if (IS_STATIC_DEMO) {
        renderLogs(mockState.logs);
        return;
    }
    try {
        const res = await fetch(`${API_URL}/logs`);
        if(!res.ok) throw new Error('API Error');
        const logs = await res.json();
        renderLogs(logs);
    } catch (err) {
        renderLogs(mockState.logs);
    }
}

function renderLogs(logs) {
    logsTableBody.innerHTML = '';
    const displayLogs = logs.slice(0, 10); // Show last 10
    displayLogs.forEach(log => {
        const tr = document.createElement('tr');
        const timeStr = new Date(log.timestamp).toLocaleTimeString();
        const badgeClass = log.channel.toLowerCase();
        tr.innerHTML = `
            <td>${timeStr}</td>
            <td><strong>${log.event_type}</strong></td>
            <td><span class="badge ${badgeClass}">${log.channel}</span></td>
            <td style="color: ${log.status === 'BLOCKED' ? '#ff3b30' : '#fff'}">${log.status}</td>
        `;
        logsTableBody.appendChild(tr);
    });
}

async function triggerEvent(eventName) {
    const inputEmail = document.getElementById('test-email').value.trim() || 'demo@user.com';
    const inputPhone = document.getElementById('test-phone').value.trim() || '+15550000';

    const mockUser = { email: inputEmail, phone: inputPhone };

    if (IS_STATIC_DEMO) {
        // Simulate backend logic in static mode
        let status = 'DELIVERED';
        if (eventName === 'twilio_stop') {
            mockState.optouts++;
            status = 'OPT-OUT PROCESSED';
        } else {
            // If they opted out before, block them now!
            if (mockState.optouts > 2) status = 'BLOCKED';
            if (eventName.includes('bounce')) status = 'BOUNCED';
        }
        
        const channel = (eventName.includes('mint') || eventName.includes('twilio') || eventName === 'user.signup') ? 'SMS' : 'EMAIL';
        if (channel === 'SMS' && status !== 'BLOCKED') mockState.sms++;
        if (channel === 'EMAIL') mockState.emails++;
        
        mockState.logs.unshift({
            timestamp: new Date().toISOString(),
            event_type: eventName,
            channel: channel,
            status: status
        });
        
        fetchLogs();
        fetchMetrics();
        return;
    }

    try {
        const payload = JSON.stringify({ event: eventName, user: mockUser, metadata: { source: 'samsung_simulator' } });
        const encoder = new TextEncoder();
        const keyData = encoder.encode('test_secret');
        const msgData = encoder.encode(payload);
        const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const signatureBuffer = await crypto.subtle.sign('HMAC', key, msgData);
        const hashArray = Array.from(new Uint8Array(signatureBuffer));
        const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const res = await fetch(`${API_URL}/events`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-vora-signature': signature
            },
            body: payload
        });

        if (res.ok) {
            setTimeout(() => {
                fetchLogs();
                fetchMetrics();
            }, 300);
        }
    } catch(err) {
        console.error('API call failed, running in static mode fallback.');
    }
}

// Init
initChart();
fetchLogs();
fetchMetrics();

if (!IS_STATIC_DEMO) {
    setInterval(() => {
        fetchLogs();
        fetchMetrics();
    }, 2000);
}
