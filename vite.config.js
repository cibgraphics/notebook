import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';

export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            vue: resolve(__dirname, 'resources/js/statamic/vue.js'),
            '@inertiajs/vue3': resolve(__dirname, 'resources/js/statamic/inertia.js'),
            '@ui': resolve(__dirname, 'resources/js/statamic/ui.js'),
            '@statamic/cms/index.js': resolve(__dirname, 'resources/js/statamic/core.js'),
        },
    },
    build: {
        manifest: 'manifest.json',
        outDir: 'resources/dist/build',
        emptyOutDir: true,
        rollupOptions: {
            input: [
                'resources/js/cp.js',
                'resources/css/cp.css',
            ],
            output: {
                entryFileNames: 'assets/cp-native-ui.js',
                assetFileNames: 'assets/[name][extname]',
            },
        },
    },
});
