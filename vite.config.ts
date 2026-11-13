import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {backendModule, validateBrowserEnvironment} from './scripts/frontend-policy.mjs';

export default defineConfig(({mode}) => {
  validateBrowserEnvironment({...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env});
  return {
    plugins: [react(), tailwindcss(), {
      name: 'frontend-module-boundary',
      generateBundle(_options, bundle) {
        for (const output of Object.values(bundle)) if (output.type === 'chunk') {
          for (const [id, info] of Object.entries(output.modules)) {
            if (backendModule(id) && info.renderedLength > 0) throw Error('FRONTEND_BACKEND_MODULE_REJECTED');
          }
        }
      },
    }],
    build: {
      sourcemap: false,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
