/**
 * CodeForge AI — Backend Server Gateway
 * ========================================
 * Production-ready Express server that:
 *
 *  1. Receives JSON POST requests from the Chrome Extension.
 *  2. Forwards prompts to the NVIDIA NIM AI Chat Completions API.
 *  3. Strips markdown fences from the response.
 *  4. Returns clean { "code": "..." } JSON to the extension.
 *  5. Saves persistent logs to `server.log` for requests, errors, and validation.
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
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/* ── Logging Setup ────────────────────────────────────── */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logFilePath = path.join(__dirname, 'server.log');

/**
 * Write a formatted log line to both the console and server.log.
 * 
 * @param {'INFO'|'WARN'|'ERROR'} level 
 * @param {string} message 
 * @param {object|null} details 
 */
function logToFile(level, message, details = null) {
  const timestamp = new Date().toISOString();
  const detailStr = details ? ` | Details: ${JSON.stringify(details)}` : '';
  const logLine = `[${timestamp}] [${level}] ${message}${detailStr}\n`;

  // Output to standard console
  if (level === 'ERROR') {
    console.error(`[${timestamp}] [${level}] ${message}`, details || '');
  } else if (level === 'WARN') {
    console.warn(`[${timestamp}] [${level}] ${message}`, details || '');
  } else {
    console.log(`[${timestamp}] [${level}] ${message}`, details || '');
  }

  // Append to log file
  fs.appendFile(logFilePath, logLine, (err) => {
    if (err) {
      console.error('❌ Failed to write to log file:', err);
    }
  });
}

/* ── Config ───────────────────────────────────────────── */

const PORT = process.env.PORT || 3000;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

if (!NVIDIA_API_KEY || NVIDIA_API_KEY === 'nvapi-YOUR_NVIDIA_API_KEY_HERE') {
  logToFile('ERROR', 'NVIDIA_API_KEY environment variable is missing or placeholder value is used.');
  process.exit(1);
}

const NVIDIA_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';

/**
 * Model ID mapping — the extension sends a friendly slug,
 * we resolve it to the provider-specific model identifier.
 */
const MODEL_MAP = {
  'llama-3.3-70b-instruct': 'meta/llama-3.3-70b-instruct',
  'llama-3.1-70b-instruct': 'meta/llama-3.1-70b-instruct',
  'llama-3.1-8b-instruct': 'meta/llama-3.1-8b-instruct',
  'llama-3.2-3b-instruct': 'meta/llama-3.2-3b-instruct',
  'llama-3.2-1b-instruct': 'meta/llama-3.2-1b-instruct',
  'phi-4-mini-instruct': 'microsoft/phi-4-mini-instruct',
  'gemma-2-2b-it': 'google/gemma-2-2b-it',
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
    logToFile('WARN', 'CORS Blocked: origin not allowed', { origin });
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

    logToFile('INFO', 'Generation request received', {
      model,
      language,
      instructionsLength: instructions ? instructions.length : 0
    });

    /* ── Validate ─────────────────────────────────── */
    if (!instructions || typeof instructions !== 'string' || instructions.trim().length === 0) {
      logToFile('WARN', 'Validation failed: Missing or empty instructions');
      return res.status(400).json({ error: 'Missing or empty "instructions" field.' });
    }

    if (instructions.length > 5000) {
      logToFile('WARN', 'Validation failed: Instructions exceed max length', { length: instructions.length });
      return res.status(400).json({ error: 'Instructions exceed maximum allowed length of 5000 characters.' });
    }

    if (language && (typeof language !== 'string' || language.length > 50)) {
      logToFile('WARN', 'Validation failed: Invalid or excessively long language name', { language });
      return res.status(400).json({ error: 'Invalid or excessively long "language" field.' });
    }

    if (!model || !MODEL_MAP[model]) {
      logToFile('WARN', 'Validation failed: Invalid model selection', { model });
      return res.status(400).json({
        error: `Invalid model "${model}". Supported: ${Object.keys(MODEL_MAP).join(', ')}`,
      });
    }

    const resolvedModel = MODEL_MAP[model];

    /* ── Build prompt ─────────────────────────────── */
    const systemPrompt = [
      `Target language: ${language || 'auto-detect'}.`,
      `Generate beginner-level code only.

      Rules:
      - Return only code.
      - No comments.
      - No explanations.
      - Keep code simple and short.
      - Follow the user's request exactly.
      - Do not add extra functions or methods unless explicitly requested or required by the language.
      - Do not wrap code inside main(), classes, or functions unless required by the selected language or requested by the user.
      - Avoid advanced programming concepts.
      - Write code suitable for first-year practical exams.
      `,
    ].join('\n');

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: instructions.trim() },
    ]

    /* ── Call NVIDIA NIM ──────────────────────────── */
    logToFile('INFO', 'Calling NVIDIA NIM API', { resolvedModel });
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
      logToFile('ERROR', `Upstream NVIDIA NIM returned error status ${nimResponse.status}`, { error: errText });
      return res.status(502).json({
        error: `Upstream AI provider error (${nimResponse.status}).`,
      });
    }

    const nimData = await nimResponse.json();

    /* ── Extract code ─────────────────────────────── */
    const rawContent = nimData?.choices?.[0]?.message?.content;

    if (!rawContent || typeof rawContent !== 'string') {
      logToFile('ERROR', 'NVIDIA NIM API returned empty content choices');
      return res.status(502).json({ error: 'AI returned an empty response.' });
    }

    const cleanCode = stripMarkdownFences(rawContent);

    logToFile('INFO', 'Code generated successfully', {
      model,
      language,
      outputLength: cleanCode.length
    });

    /* ── Respond ──────────────────────────────────── */
    return res.json({ code: cleanCode });

  } catch (err) {
    logToFile('ERROR', 'Unexpected server error during generation', { error: err.message, stack: err.stack });
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
  logToFile('ERROR', 'Unhandled Express error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error.' });
});

/* ── Start ────────────────────────────────────────────── */

app.listen(PORT, () => {
  logToFile('INFO', `CodeForge AI server running on port ${PORT}`);
  console.log(`   POST /v1/forge — main generation endpoint`);
  console.log(`   GET  /health   — health check\n`);
});
