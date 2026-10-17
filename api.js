/**
 * api.js — Shared API Client for AI Interview Platform
 * Handles JWT tokens, auto-refresh, and all backend calls.
 */

const BASE_URL = 'http://localhost:3001';

// ─── Token Management ────────────────────────────────────────────────────────
const Auth = {
    getAccessToken: () => localStorage.getItem('access_token'),
    getRefreshToken: () => localStorage.getItem('refresh_token'),
    getUser: () => {
        const u = localStorage.getItem('user');
        return u ? JSON.parse(u) : null;
    },
    save(data) {
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
    },
    clear() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
    },
    isLoggedIn: () => !!localStorage.getItem('access_token'),
};

// ─── Core Fetch Wrapper ──────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = Auth.getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

    // Auto-refresh on 401
    if (res.status === 401 && Auth.getRefreshToken()) {
        const refreshed = await fetch(`${BASE_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: Auth.getRefreshToken() }),
        });
        if (refreshed.ok) {
            const data = await refreshed.json();
            Auth.save(data.data);
            headers['Authorization'] = `Bearer ${data.data.access_token}`;
            res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
        } else {
            Auth.clear();
            window.location.href = 'auth.html';
            return;
        }
    }

    const json = await res.json();
    if (!res.ok) throw { status: res.status, message: json.error || 'Request failed', details: json.details };
    return json;
}

// ─── Auth API ────────────────────────────────────────────────────────────────
async function apiRegister(full_name, email, password) {
    const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ full_name, email, password }),
    });
    Auth.save(res.data);
    return res.data;  // includes access_token, user, email_verification_sent
}

async function apiLogin(email, password) {
    const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
    Auth.save(res.data);
    return res.data;
}

function apiLogout() {
    Auth.clear();
    window.location.href = 'auth.html';
}

// ─── Questions API ───────────────────────────────────────────────────────────
async function apiGetQuestions(topic, difficulty, limit = 10) {
    const params = new URLSearchParams();
    if (topic) params.set('topic', topic);
    if (difficulty) params.set('difficulty', difficulty);
    params.set('limit', limit);
    const res = await apiFetch(`/api/questions?${params}`);
    return res.data;
}

// ─── Interview API ───────────────────────────────────────────────────────────
async function apiStartInterview(topic, difficulty, num_questions) {
    const res = await apiFetch('/api/interviews/start', {
        method: 'POST',
        body: JSON.stringify({ topic, difficulty, num_questions }),
    });
    return res.data;
}

async function apiSubmitAnswer(interview_id, question_id, answer_text, answer_duration_seconds) {
    const res = await apiFetch('/api/interviews/submit-answer', {
        method: 'POST',
        body: JSON.stringify({ interview_id, question_id, answer_text, answer_duration_seconds }),
    });
    return res.data;
}

async function apiCompleteInterview(interview_id) {
    const res = await apiFetch(`/api/interviews/${interview_id}/complete`, { method: 'POST' });
    return res;
}

async function apiGetResults(interview_id) {
    // Poll until all responses have AI feedback
    for (let attempt = 0; attempt < 10; attempt++) {
        const res = await apiFetch(`/api/interviews/${interview_id}/results`);
        const allDone = res.data.responses.every(r => r.ai_feedback !== null);
        if (allDone) return res.data;
        await new Promise(r => setTimeout(r, 2000)); // wait 2s between polls
    }
    // Return whatever we have after max attempts
    const res = await apiFetch(`/api/interviews/${interview_id}/results`);
    return res.data;
}

// ─── User API ────────────────────────────────────────────────────────────────
async function apiGetDashboard() {
    const res = await apiFetch('/api/user/dashboard');
    return res.data;
}

// ─── Guard: redirect to auth if not logged in ────────────────────────────────
function requireAuth() {
    if (!Auth.isLoggedIn()) {
        window.location.href = 'auth.html';
        return false;
    }
    return true;
}

// ─── Guard: redirect to interview if already logged in ───────────────────────
function redirectIfLoggedIn() {
    if (Auth.isLoggedIn()) {
        window.location.href = 'interview.html';
    }
}
