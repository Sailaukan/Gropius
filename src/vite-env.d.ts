/// <reference types="vite/client" />

// Glaze's components check process.env.NODE_ENV for development warnings; vite.config.ts defines it.
declare const process: {env: {NODE_ENV?: string}};
