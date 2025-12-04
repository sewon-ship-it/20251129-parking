// vite.config.js
import { resolve } from 'path'
import { defineConfig } from 'vite'
export default defineConfig({
    server: {
        host: '0.0.0.0', // 모든 네트워크 인터페이스에서 접근 가능
        port: 5173,
        open: false // 자동으로 브라우저 열지 않음
    },
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
            },
        },
    },
});
