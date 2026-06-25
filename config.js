/**
 * CodeForge AI — Centralized Configuration
 * ------------------------------------------
 * All sensitive keys and routing logic live on the server.
 * This file only holds the gateway URL and static UI data
 * used to populate dropdown menus in the popup.
 */

const CONFIG = Object.freeze({

  /** Server gateway endpoint — the ONLY outbound destination */
  SERVER_API_URL: 'https://codeforge-ai-evpj.onrender.com/v1/forge',

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
    // Programming Languages
{ id: 'javascript', label: 'JavaScript' },
{ id: 'typescript', label: 'TypeScript' },
{ id: 'python', label: 'Python' },
{ id: 'java', label: 'Java' },
{ id: 'csharp', label: 'C#' },
{ id: 'cpp', label: 'C++' },
{ id: 'c', label: 'C' },
{ id: 'go', label: 'Go' },
{ id: 'rust', label: 'Rust' },
{ id: 'ruby', label: 'Ruby' },
{ id: 'php', label: 'PHP' },
{ id: 'swift', label: 'Swift' },
{ id: 'kotlin', label: 'Kotlin' },
{ id: 'dart', label: 'Dart' },
{ id: 'scala', label: 'Scala' },
{ id: 'perl', label: 'Perl' },
{ id: 'r', label: 'R' },
{ id: 'matlab', label: 'MATLAB' },
{ id: 'lua', label: 'Lua' },
{ id: 'haskell', label: 'Haskell' },
{ id: 'elixir', label: 'Elixir' },
{ id: 'clojure', label: 'Clojure' },
{ id: 'fsharp', label: 'F#' },
{ id: 'objectivec', label: 'Objective-C' },
{ id: 'assembly', label: 'Assembly' },
{ id: 'fortran', label: 'Fortran' },
{ id: 'cobol', label: 'COBOL' },

// Web Technologies
{ id: 'html', label: 'HTML' },
{ id: 'css', label: 'CSS' },
{ id: 'sass', label: 'SASS / SCSS' },
{ id: 'less', label: 'LESS' },
{ id: 'tailwind', label: 'Tailwind CSS' },
{ id: 'bootstrap', label: 'Bootstrap' },

// Frontend Frameworks
{ id: 'react', label: 'React' },
{ id: 'nextjs', label: 'Next.js' },
{ id: 'vue', label: 'Vue.js' },
{ id: 'nuxt', label: 'Nuxt.js' },
{ id: 'angular', label: 'Angular' },
{ id: 'svelte', label: 'Svelte' },
{ id: 'solidjs', label: 'SolidJS' },

// Backend Frameworks
{ id: 'nodejs', label: 'Node.js' },
{ id: 'express', label: 'Express.js' },
{ id: 'nestjs', label: 'NestJS' },
{ id: 'fastapi', label: 'FastAPI' },
{ id: 'django', label: 'Django' },
{ id: 'flask', label: 'Flask' },
{ id: 'spring', label: 'Spring Boot' },
{ id: 'laravel', label: 'Laravel' },
{ id: 'aspnet', label: 'ASP.NET Core' },
{ id: 'gin', label: 'Gin (Go)' },

// Databases
{ id: 'sql', label: 'SQL' },
{ id: 'mysql', label: 'MySQL' },
{ id: 'postgresql', label: 'PostgreSQL' },
{ id: 'sqlite', label: 'SQLite' },
{ id: 'mssql', label: 'SQL Server' },
{ id: 'oracle', label: 'Oracle DB' },
{ id: 'mongodb', label: 'MongoDB' },
{ id: 'redis', label: 'Redis' },
{ id: 'cassandra', label: 'Cassandra' },
{ id: 'firebase', label: 'Firebase Firestore' },
{ id: 'supabase', label: 'Supabase' },

// Mobile Development
{ id: 'android', label: 'Android' },
{ id: 'ios', label: 'iOS' },
{ id: 'reactnative', label: 'React Native' },
{ id: 'flutter', label: 'Flutter' },
{ id: 'xamarin', label: 'Xamarin' },

// DevOps & Infrastructure
{ id: 'docker', label: 'Docker' },
{ id: 'kubernetes', label: 'Kubernetes' },
{ id: 'terraform', label: 'Terraform' },
{ id: 'ansible', label: 'Ansible' },
{ id: 'jenkins', label: 'Jenkins' },
{ id: 'githubactions', label: 'GitHub Actions' },
{ id: 'nginx', label: 'Nginx' },

// Cloud Platforms
{ id: 'aws', label: 'AWS' },
{ id: 'azure', label: 'Microsoft Azure' },
{ id: 'gcp', label: 'Google Cloud' },
{ id: 'cloudflare', label: 'Cloudflare' },
{ id: 'vercel', label: 'Vercel' },
{ id: 'netlify', label: 'Netlify' },

// AI / Data Science
{ id: 'machinelearning', label: 'Machine Learning' },
{ id: 'deeplearning', label: 'Deep Learning' },
{ id: 'tensorflow', label: 'TensorFlow' },
{ id: 'pytorch', label: 'PyTorch' },
{ id: 'opencv', label: 'OpenCV' },
{ id: 'pandas', label: 'Pandas' },
{ id: 'numpy', label: 'NumPy' },

// Scripting & Automation
{ id: 'bash', label: 'Bash' },
{ id: 'powershell', label: 'PowerShell' },
{ id: 'shell', label: 'Shell Script' },

// Game Development
{ id: 'unity', label: 'Unity' },
{ id: 'unreal', label: 'Unreal Engine' },
{ id: 'godot', label: 'Godot' },

// Version Control
{ id: 'git', label: 'Git' },
{ id: 'github', label: 'GitHub' },
{ id: 'gitlab', label: 'GitLab' },
  ]),
});
