/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GENERATOR_PASSWORD?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
