import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

function preventInvalidLoadersPlugin() {
  return {
    name: 'prevent-invalid-loaders',
    resolveId(id: string) {
      if (id.startsWith('/res.cloudinary.com') || id.startsWith('res.cloudinary.com') || (/\.(com|org|net)$/i.test(id) && !id.endsWith('.js') && !id.endsWith('.ts') && !id.endsWith('.tsx') && !id.endsWith('.jsx'))) {
        return '\0virtual:empty-module';
      }
    },
    load(id: string) {
      if (id === '\0virtual:empty-module') {
        return 'export default {};';
      }
    }
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [preventInvalidLoadersPlugin(), react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react-router-dom',
        'motion/react',
        'lucide-react',
        '@supabase/supabase-js',
      ],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
