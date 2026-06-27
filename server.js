require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const sgMail = require('@sendgrid/mail');
const twilio = require('twilio');

const app = express();
const PORT = process.env.PORT || 3000;
const SANDBOX_MODE = process.env.SANDBOX_MODE !== 'false';

const db = new sqlite3.Database('./vora_automation.db', (err) => {
    if (err) console.error('DB Error:', err.message);
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS events_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT,
        user_id TEXT,
        channel TEXT,
        status TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        details TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS opt_outs (
        phone_number TEXT PRIMARY KEY,
        opted_out_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

app.use(express.json());
app.use(express.static('public'));

const verifyHMAC = (req, res, next) => {
    const signature = req.headers['x-vora-signature'];
    if (!signature) return res.status(401).json({ error: 'Missing signature' });

    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
        .createHmac('sha256', process.env.WEBHOOK_SECRET || 'test_secret')
        .update(payload)
        .digest('hex');

    if (signature !== expectedSignature && !SANDBOX_MODE) {
        return res.status(403).json({ error: 'Invalid signature' });
    }
    next();
};

app.post('/api/events', verifyHMAC, async (req, res) => {
    const { event, user, metadata } = req.body;
    processEventAsync(event, user, metadata).catch(console.error);
    res.status(202).json({ status: 'queued', eventId: crypto.randomUUID() });
});

async function processEventAsync(event, user, metadata) {
    let emailSent = false;
    let smsSent = false;

    // Check TCPA Opt-out before sending SMS
    const isOptedOut = await new Promise((resolve) => {
        db.get('SELECT * FROM opt_outs WHERE phone_number = ?', [user.phone], (err, row) => {
            resolve(!!row);
        });
    });

    switch (event) {
        case 'user.signup':
            await sendEmail(user.email, 'Welcome to Vora Protocol!', 'd-welcome-template');
            if (!isOptedOut) {
                await sendSMS(user.phone, 'Welcome to Vora! Protect your first asset today.');
                smsSent = true;
            } else {
                logEvent('sms_blocked_tcpa', user.phone, 'SYSTEM', 'BLOCKED', { reason: 'User opted out' });
            }
            emailSent = true;
            break;
            
        case 'mint_started_abandoned':
            if (!isOptedOut) {
                await sendSMS(user.phone, 'VoraProtocol: Did something go wrong? Your draft is saved. Click to resume: https://voraprotocol.com/resume');
                smsSent = true;
            }
            break;
            
        case 'proof_limit_80_percent':
            await sendEmail(user.email, 'You are on fire! 1 free proof left.', 'd-upsell-template');
            emailSent = true;
            break;

        case 'sendgrid_bounce':
            logEvent('email_bounce', user.email, 'EMAIL', 'BOUNCED', { reason: 'Invalid Address' });
            break;

        case 'twilio_stop':
            db.run('INSERT OR IGNORE INTO opt_outs (phone_number) VALUES (?)', [user.phone]);
            logEvent('tcpa_opt_out', user.phone, 'SMS', 'UNSUBSCRIBED', { reason: 'User texted STOP' });
            break;
    }

    if (emailSent) logEvent(event, user.email, 'EMAIL', 'SENT', metadata);
    if (smsSent) logEvent(event, user.phone, 'SMS', 'SENT', metadata);
}

async function sendEmail(to, subject, templateId) {
    if (SANDBOX_MODE) return true;
    try {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        const msg = {
            to,
            from: process.env.SENDGRID_FROM_EMAIL || 'alerts@voraprotocol.com',
            subject,
            text: 'Vora Protocol Update',
            html: `<strong>${subject}</strong><br><p>This is an automated notification from Vora Protocol.</p>`
            // Note: In production, uncomment the line below to use real SendGrid templates
            // templateId: templateId 
        };
        await sgMail.send(msg);
        return true;
    } catch (error) {
        console.error('SendGrid Error:', error.response ? error.response.body : error);
        return false;
    }
}

async function sendSMS(to, body) {
    if (SANDBOX_MODE) return true;
    try {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.messages.create({
            body,
            from: process.env.TWILIO_PHONE_NUMBER,
            to
        });
        return true;
    } catch (error) {
        console.error('Twilio Error:', error);
        return false;
    }
}

function logEvent(eventType, userId, channel, status, details) {
    db.run(
        'INSERT INTO events_log (event_type, user_id, channel, status, details) VALUES (?, ?, ?, ?, ?)',
        [eventType, userId, channel, status, JSON.stringify(details)]
    );
}

app.get('/api/logs', (req, res) => {
    db.all('SELECT * FROM events_log ORDER BY timestamp DESC LIMIT 50', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/metrics', (req, res) => {
    const queries = [
        new Promise(res => db.all("SELECT channel, COUNT(*) as count FROM events_log WHERE channel IN ('EMAIL', 'SMS') GROUP BY channel", (err, rows) => res(rows))),
        new Promise(res => db.get("SELECT COUNT(*) as count FROM opt_outs", (err, row) => res(row))),
        new Promise(res => db.get("SELECT COUNT(*) as count FROM events_log WHERE event_type = 'email_bounce'", (err, row) => res(row))),
    ];
    
    Promise.all(queries).then(([channels, optOuts, bounces]) => {
        res.json({ channels, optOuts: optOuts.count, bounces: bounces.count });
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Pilgrim Content x Vora Engine running on port ${PORT}`);
});
