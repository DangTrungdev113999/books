/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WORKER_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// CSS imports (side-effect)
declare module '*.css';
