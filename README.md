# Omnichannel Lifecycle Growth Engine

![Vora Protocol Engine](https://img.shields.io/badge/Status-Production_Ready-success) ![Node.js](https://img.shields.io/badge/Node.js-18.x-green) ![SendGrid](https://img.shields.io/badge/SendGrid-Email_API-blue) ![Twilio](https://img.shields.io/badge/Twilio-SMS_API-red)

A decoupled, event-driven microservice built to orchestrate and automate B2C subscriber growth workflows. This engine acts as the telemetry and communications layer, integrating seamlessly with existing platforms (e.g., Vora Protocol) to drive constituent engagement, manage lifecycle marketing, and enforce strict legal compliance (TCPA).

## 🚀 Key Features

* **Event-Driven Architecture:** Listens for platform webhooks (e.g., `user.signup`, `proof_limit_80_percent`, `mint_started_abandoned`) and triggers precise automated flows.
* **SendGrid Email Workflows:** Manages Welcome Series, Aha! Moment re-engagement, and frictionless upsell prompts directly into subscriber inboxes.
* **Twilio SMS & TCPA Compliance:** Handles outbound SMS verification and marketing. Includes automated logic to capture "STOP" replies and instantly blocklist numbers, preventing DND/TCPA violations.
* **Real-time Analytics Dashboard:** A React-like vanilla JS frontend providing live visualization (Chart.js) of dispatch metrics, open rates, CTRs, and opt-outs.
* **HMAC Payload Verification:** Endpoints are secured using SHA-256 HMAC signatures to prevent event spoofing.

## 🛠️ Tech Stack

* **Backend:** Node.js, Express.js
* **Database:** SQLite (In-memory/Persistent for fast state-tracking & Opt-outs)
* **APIs:** SendGrid SDK (`@sendgrid/mail`), Twilio SDK
* **Frontend:** HTML5, Vanilla CSS (Glassmorphism & Samsung-inspired enterprise design), Vanilla JS, Chart.js

## 📁 Repository Structure

```text
├── server.js         # Core Event Processor & API Gateway
├── .env.example      # Template for required API keys
├── public/           # Frontend Dashboard & Analytics UI
│   ├── index.html    # Main dashboard view
│   ├── css/style.css # Enterprise styling
│   └── js/app.js     # Telemetry polling & simulator logic
```

## ⚙️ Local Setup

1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Copy `.env.example` to `.env` and add your SendGrid and Twilio credentials.
4. Run `node server.js` or `npm start`.
5. Access the dashboard at `http://localhost:3000`.

## 🌐 Static Demo (GitHub Pages)

The frontend (`/public`) can be deployed as a static site. The application features a built-in **Static Mock Mode** that simulates the backend webhook responses, allowing recruiters and stakeholders to interact with the Dashboard Simulator entirely in the browser without spinning up the Node.js server.

*Demo Link:* [Available on GitHub Pages]

---
*Built as a scalable architectural demonstration for B2C Growth Automation.*
