/**
 * CodeForge AI — Centralized Configuration
 * ------------------------------------------
 * All sensitive keys and routing logic live on the server.
 * This file only holds the gateway URL and static UI data
 * used to populate dropdown menus in the popup.
 */

const CONFIG = Object.freeze({

  /** Server gateway endpoint — the ONLY outbound destination */
  SERVER_API_URL: 'https://api.yourdomain.com/v1/forge',

  /** Request timeout in milliseconds (30 s) */
  REQUEST_TIMEOUT_MS: 30_000,

  /**
   * Supported AI models — labels shown in the popup dropdown.
   * The server decides which provider/key to use for each model id.
   */
  MODELS: Object.freeze([
    { id: 'llama-3.3-70b-instruct',     label: 'Llama 3.3 70B',        desc: 'Meta flagship reasoning',        color: '#3b82f6' },
    { id: 'llama-3.1-70b-instruct',     label: 'Llama 3.1 70B',        desc: 'Meta complex conversations',      color: '#2563eb' },
    { id: 'llama-3.1-8b-instruct',      label: 'Llama 3.1 8B',         desc: 'Meta lightweight chat',          color: '#60a5fa' },
    { id: 'llama-3.2-3b-instruct',      label: 'Llama 3.2 3B',         desc: 'Meta small efficient model',     color: '#93c5fd' },
    { id: 'llama-3.2-1b-instruct',      label: 'Llama 3.2 1B',         desc: 'Meta ultra-lightweight',         color: '#bfdbfe' },
    { id: 'phi-4-mini-instruct',        label: 'Phi 4 Mini',           desc: 'Microsoft latency-optimized',    color: '#00a4ef' },
    { id: 'gemma-2-2b-it',              label: 'Gemma 2 2B IT',        desc: 'Google edge-optimized chat',     color: '#fbbf24' },
    { id: 'mixtral-8x7b-instruct-v0.1',  label: 'Mixtral 8x7B Instruct', desc: 'Mistral high-performance MoE', color: '#ff5e00' },
  ]),

  /**
   * Supported coding languages — labels shown in the popup dropdown.
   * The server can expand or remap these as needed.
   */
  LANGUAGES: Object.freeze([
    { id: 'javascript',   label: 'JavaScript' },
    { id: 'typescript',   label: 'TypeScript' },
    { id: 'python',       label: 'Python' },
    { id: 'java',         label: 'Java' },
    { id: 'csharp',       label: 'C#' },
    { id: 'cpp',          label: 'C++' },
    { id: 'go',           label: 'Go' },
    { id: 'rust',         label: 'Rust' },
    { id: 'ruby',         label: 'Ruby' },
    { id: 'php',          label: 'PHP' },
    { id: 'swift',        label: 'Swift' },
    { id: 'kotlin',       label: 'Kotlin' },
    { id: 'html',         label: 'HTML / CSS' },
    { id: 'sql',          label: 'SQL' },
    { id: 'bash',         label: 'Bash / Shell' },
  ]),
});
