/**
 * CodeForge AI — Backend Server Gateway
 * ========================================
 * Production-ready Express server that:
 *
 *  1. Receives JSON POST requests from the Chrome Extension.
 *  2. Forwards prompts to the NVIDIA NIM AI Chat Completions API.
 *  3. Strips markdown fences from the response.
 *  4. Returns clean { "code": "..." } JSON to the extension.
 *
 * Environment variables:
 *   NVIDIA_API_KEY      — Your NVIDIA NIM API key (REQUIRED)
 *   PORT                — Server port (default: 3000)
 *   ALLOWED_ORIGINS     — Comma-separated allowed CORS origins (optional)
 *
 * Usage:
 *   NVIDIA_API_KEY=nvapi-... node server.js
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

/* ── Config ───────────────────────────────────────────── */

const PORT = process.env.PORT || 3000;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

if (!NVIDIA_API_KEY) {
  console.error('❌  NVIDIA_API_KEY environment variable is required.');
  process.exit(1);
}

const NVIDIA_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';

/**
 * Model ID mapping — the extension sends a friendly slug,
 * we resolve it to the provider-specific model identifier.
 */
const MODEL_MAP = {
  'llama-3.3-70b-instruct':     'meta/llama-3.3-70b-instruct',
  'llama-3.1-70b-instruct':     'meta/llama-3.1-70b-instruct',
  'llama-3.1-8b-instruct':      'meta/llama-3.1-8b-instruct',
  'llama-3.2-3b-instruct':      'meta/llama-3.2-3b-instruct',
  'llama-3.2-1b-instruct':      'meta/llama-3.2-1b-instruct',
  'phi-4-mini-instruct':        'microsoft/phi-4-mini-instruct',
  'gemma-2-2b-it':              'google/gemma-2-2b-it',
  'mixtral-8x7b-instruct-v0.1': 'mistralai/mixtral-8x7b-instruct-v0.1',
};

/* ── Express app ──────────────────────────────────────── */

const app = express();

/* Security headers */
app.use(helmet());

/* CORS — lock to extension origin in production */
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['*'];

/* CORS validation middleware */
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    next();
  } else {
    console.warn(`[CORS Blocked] Origin: ${origin}`);
    res.status(403).json({ error: 'CORS: origin not allowed' });
  }
});

app.use(cors({
  origin: true,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

/* Body parser */
app.use(express.json({ limit: '64kb' }));

/* Rate limiter — per IP, 60 requests per minute */
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

app.use('/v1/forge', limiter);

/* ── Health check ─────────────────────────────────────── */

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

/* ── Main forge endpoint ──────────────────────────────── */

app.post('/v1/forge', async (req, res) => {
  try {
    const { model, language, instructions } = req.body;

    /* ── Validate ─────────────────────────────────── */
    if (!instructions || typeof instructions !== 'string' || instructions.trim().length === 0) {
      return res.status(400).json({ error: 'Missing or empty "instructions" field.' });
    }

    if (instructions.length > 5000) {
      return res.status(400).json({ error: 'Instructions exceed maximum allowed length of 5000 characters.' });
    }

    if (language && (typeof language !== 'string' || language.length > 50)) {
      return res.status(400).json({ error: 'Invalid or excessively long "language" field.' });
    }

    if (!model || !MODEL_MAP[model]) {
      return res.status(400).json({
        error: `Invalid model "${model}". Supported: ${Object.keys(MODEL_MAP).join(', ')}`,
      });
    }

    const resolvedModel = MODEL_MAP[model];

    /* ── Build prompt ─────────────────────────────── */
    const systemPrompt = [
      `You are an expert software engineer. Generate clean, production-ready code.`,
      `Target language: ${language || 'auto-detect'}.`,
      `Return ONLY the raw code — no explanations, no markdown fences, no prose.`,
      `If the request is ambiguous, make reasonable assumptions and implement fully.`,
      `Include necessary imports and exports based on the target language conventions.`,
      `Generate Beginner-friendly code.`
    ].join('\n');

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: instructions.trim() },
    ]

    /* ── Call NVIDIA NIM ──────────────────────────── */
    const nimResponse = await fetch(NVIDIA_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages,
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    if (!nimResponse.ok) {
      const errText = await nimResponse.text().catch(() => 'Unknown upstream error');
      console.error(`[NVIDIA NIM ${nimResponse.status}]`, errText);
      return res.status(502).json({
        error: `Upstream AI provider error (${nimResponse.status}).`,
      });
    }

    const nimData = await nimResponse.json();

    /* ── Extract code ─────────────────────────────── */
    const rawContent = nimData?.choices?.[0]?.message?.content;

    if (!rawContent || typeof rawContent !== 'string') {
      return res.status(502).json({ error: 'AI returned an empty response.' });
    }

    const cleanCode = stripMarkdownFences(rawContent);

    /* ── Respond ──────────────────────────────────── */
    return res.json({ code: cleanCode });

  } catch (err) {
    console.error('[Forge Error]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/* ── Markdown stripping ───────────────────────────────── */

/**
 * Removes markdown code fences and leading/trailing whitespace
 * from AI-generated output.
 *
 * Handles patterns like:
 *   ```javascript\n...\n```
 *   ```\n...\n```
 *   ~~~\n...\n~~~
 *
 * @param {string} raw
 * @returns {string}
 */
function stripMarkdownFences(raw) {
  let code = raw.trim();

  /* Match triple-backtick or triple-tilde fences with optional language tag */
  const fenceRegex = /^(```|~~~)\s*\w*\s*\n([\s\S]*?)\n\1\s*$/;
  const match = code.match(fenceRegex);

  if (match) {
    code = match[2];
  } else {
    /* Fallback: strip leading/trailing fences even if mismatched */
    code = code
      .replace(/^(```|~~~)\s*\w*\s*\n/, '')
      .replace(/\n(```|~~~)\s*$/, '');
  }

  return code.trim();
}

/* ── 404 catch-all ────────────────────────────────────── */

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

/* ── Global error handler ─────────────────────────────── */

app.use((err, _req, res, _next) => {
  console.error('[Unhandled]', err);
  res.status(500).json({ error: 'Internal server error.' });
});

/* ── Start ────────────────────────────────────────────── */

app.listen(PORT, () => {
  console.log(`\n⚡ CodeForge AI server running on port ${PORT}`);
  console.log(`   POST /v1/forge — main generation endpoint`);
  console.log(`   GET  /health   — health check\n`);
});
