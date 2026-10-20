import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // host: true lets phones on the same Wi-Fi open the dev site.
  server: { host: true, port: 5173 },
});
