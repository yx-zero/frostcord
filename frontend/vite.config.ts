import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Wails serves the frontend; keep HMR working inside the webview
    strictPort: true,
  },
})
