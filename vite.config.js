import { fileURLToPath, URL } from 'node:url';

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

import { defineConfig } from 'vite';

const buildId =
    process.env.GITHUB_SHA ||
    execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

export default defineConfig({
    base: '/3d-plane/',
    build: {
        rolldownOptions: {
            input: {
                main: fileURLToPath(new URL('./index.html', import.meta.url)),
                goldenCrown: fileURLToPath(
                    new URL('./golden-crown.html', import.meta.url)
                )
            }
        }
    },
    plugins: [
        {
            name: 'build-version',
            transformIndexHtml(html) {
                return html.replace(
                    '</head>',
                    `    <meta name="open-skies-build" content="${buildId}" />\n    </head>`
                );
            }
        },
        {
            name: 'local-scenery-data',
            generateBundle() {
                for (const file of [
                    'tehran/map.json',
                    'tehran/elevation.json',
                    'tehran/map-pois.json',
                    'luxeuil/map.json',
                    'luxeuil/elevation.json',
                    'saint-cyr/map.json',
                    'saint-cyr/elevation.json',
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
