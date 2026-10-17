# PrepMind AI — Your Personal AI Interview Coach

<p align="center">
  <img src="https://img.shields.io/badge/Status-Beta-brightgreen.svg" alt="Status" />
  <img src="https://img.shields.io/badge/Stack-Node%20%7C%20Express%20%7C%20Postgres-blue.svg" alt="Tech Stack" />
  <img src="https://img.shields.io/badge/AI-Google%20Gemini-orange.svg" alt="AI Engine" />
  <img src="https://img.shields.io/badge/Billing-Stripe-6772E5.svg" alt="Billing" />
</p>

PrepMind AI is a comprehensive SaaS platform built to help candidates ace their interviews, and for recruiters to create AI-powered assessments. It uses advanced language models (Google Gemini) to analyze resumes, job descriptions, and conduct real-time mock interviews with actionable feedback.

---

## ✨ Key Features

- **🧠 Real-time AI Interviews** — Pick a topic, difficulty, and duration. A countdown timer keeps you on track, and the AI provides detailed feedback (score, strengths, improvements, ideal answer) for every response.
- **📄 JD Matcher & Resume Analysis** — Upload your resume (PDF/DOCX/TXT) and paste a Job Description. Our AI extracts your skills, calculates a match score, highlights missing skills, and generates tailored practice questions for the role.
- **🏢 B2B Recruiter Dashboard** — (Team/Enterprise Plan) Create custom assessments, generate shareable links, and track candidate progress through a dedicated dashboard.
- **📊 Analytics Dashboard** — Track your interview history, average scores, and improvement over time.
- **💳 SaaS Billing & Subscriptions** — Complete Stripe integration with Monthly/Annual toggles, Customer Portal, and plan-gated features (Pro / Team / Enterprise).
- **🔒 Secure Authentication** — JWT-based authentication with email verification flow.
- **💅 Premium UI** — Beautiful "Aurora Dark" design system with glassmorphism, fluid animations, and a responsive layout built entirely without heavy UI frameworks.

---

## 🛠 Tech Stack

### Frontend
- **HTML5, CSS3, Vanilla JS** — Lightweight, blazing fast frontend. No heavy frameworks.
- **Google Fonts** — `Inter` and `Sora` for modern typography.
- **FontAwesome** — Iconography.

### Backend
- **Node.js & Express** — Robust backend API serving the frontend client.
- **TypeScript** — Strongly typed server code architecture.
- **PostgreSQL** — Relational database for storing users, interviews, resumes, and subscriptions.
- **Stripe** — Subscription management and webhooks.
- **Google Gemini 1.5 Pro** — The AI engine powering interview feedback and resume analysis.
- **multer & pdf-parse** — For robust file uploads and text extraction.
- **JWT & bcrypt** — Security, hashing, and session management.
- **Nodemailer** — For transactional email verification.

---

## 🚀 Getting Started

Follow these instructions to run the project locally.

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [PostgreSQL](https://www.postgresql.org/) (Running locally or via Docker)
- [Stripe CLI](https://stripe.com/docs/stripe-cli) (For local webhook testing)
- A Google Gemini API Key from [Google AI Studio](https://aistudio.google.com/)

### 2. Database Setup
Create a PostgreSQL database (e.g., `interview_db`). Then run the provided migrations in order:
```bash
# In the /server/migrations/ folder, run the SQL files against your database
# 001_initial_schema.sql
# 002_email_verification.sql
# 003_subscriptions.sql
# 004_resumes_and_recruiter.sql
```

### 3. Environment Variables
Create a `.env` file in the `/server` directory:
```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/interview_db

# JWT Secrets
JWT_ACCESS_SECRET=your_super_secret_access_key
JWT_REFRESH_SECRET=your_super_secret_refresh_key
JWT_ACCESS_EXPIRY=1h
JWT_REFRESH_EXPIRY=30d

# APIs
GEMINI_API_KEY=your_gemini_key_here
GEMINI_MODEL=gemini-1.5-pro

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=your_email@gmail.com

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
STRIPE_PRICE_TEAM_MONTHLY=price_...
STRIPE_PRICE_TEAM_ANNUAL=price_...

APP_URL=http://localhost:3000
```

### 4. Install & Run Backend
```bash
cd server
npm install
npm run dev
```
*The backend will start on `http://localhost:3001`.*

### 5. Install & Run Frontend
In a new terminal, run the static frontend folder:
```bash
# In the root project directory
npx serve . --listen 3000
```
*The frontend will start on `http://localhost:3000`.*

### 6. Stripe Webhooks (Testing Subscriptions)
In a third terminal, forward Stripe events to your local server:
```bash
stripe listen --forward-to http://localhost:3001/api/billing/webhook
```
*Copy the `whsec_...` secret output from this command and place it in your `.env` file for signature verification.*

---

## 📂 Project Structure

```text
/
├── index.html            # Landing page
├── pricing.html          # Pricing & Stripe Checkout
├── auth.html             # Login & Registration
├── interview.html        # AI Interview Practice Window
├── dashboard.html        # Analytics Dashboard
├── jd-match.html         # Resume & Job Description Analysis
├── recruiter.html        # B2B Assessment Creator
├── blog.html             # SEO / Content Marketing
├── styles.css            # Aurora Dark Design System
├── api.js                # Shared API Client Wrapper
│
└── server/               # Node.js/Express Backend
    ├── src/
    │   ├── ai/           # Gemini AI prompts and parsing
    │   ├── modules/      # Domain-driven features (auth, billing, interview, resume)
    │   ├── config/       # Postgres DB connection
    │   └── app.ts        # Express app and middleware setup
    ├── migrations/       # SQL Database Migrations
    └── package.json      
```

---

## 📜 License

Created for private and commercial use as an AI SaaS Platform. All rights reserved.
