/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MODE?: 'internal' | 'partner'
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
