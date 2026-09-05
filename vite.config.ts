import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({base:'./',plugins:[react()],build:{chunkSizeWarningLimit:650},server:{proxy:{'/api':'http://127.0.0.1:4186','/files':'http://127.0.0.1:4186'}}});
