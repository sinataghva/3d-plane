import { fileURLToPath, URL } from 'node:url';

import { readFileSync } from 'node:fs';

import { defineConfig } from 'vite';

export default defineConfig({
    base: '/3d-plane/',
    plugins: [
        {
            name: 'local-scenery-data',
            generateBundle() {
                for (const file of [
                    'luxeuil/map.json',
                    'luxeuil/elevation.json',
                    'saint-cyr.json',
                    'saint-cyr-elevation.json',
                    'terrain-attribution.md'
                ]) {
                    this.emitFile({
                        type: 'asset',
                        fileName: `data/${file}`,
                        source: readFileSync(
                            new URL(`./data/${file}`, import.meta.url)
                        )
                    });
                }
            }
        }
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    server: {
        host: '127.0.0.1',
        port: 5173,
        strictPort: true
    },
    preview: {
        host: '127.0.0.1',
        port: 4173,
        strictPort: true
    }
});
