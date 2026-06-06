import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    plugins: [vue()],
    build: {
        manifest: true,
        outDir: 'resources/dist/build',
        emptyOutDir: true,
        rollupOptions: {
            input: [
                'resources/js/cp.js',
                'resources/css/cp.css',
            ],
        },
    },
});
