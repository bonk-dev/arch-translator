import * as esbuild from 'esbuild'
import * as fs from "node:fs";
import * as chokidar from 'chokidar';

const tmpPath = 'build/arch-translator.js';
const outPath = 'build/arch-translator.user.js';
const ctx = await esbuild.context({
    entryPoints: ['src/index.ts'],
    bundle: true,
    outfile: tmpPath
});

async function build() {
    try {
        await ctx.rebuild();
    } catch (e) {
        console.error('Build failed');
        console.error(e);
        return;
    }

    console.log('Prepending userscript header');

    const bundle = fs.readFileSync(tmpPath);
    const header = fs.readFileSync('src/uscript-header.txt');
    const bundleHandle = fs.openSync(outPath, 'w');

    fs.writeSync(bundleHandle, header, 0, header.length, 0);
    fs.writeSync(bundleHandle, bundle, 0, bundle.length, header.length);

    fs.closeSync(bundleHandle);
}

if (process.argv.length < 3) {
    console.error("Usage: node build.mjs <build|watch>");
    process.exit(1);
}

const verb = process.argv[2].toLowerCase();
switch (verb) {
    case 'build':
        build()
            .then(() => {
                ctx.dispose()
                    .then(() => {
                        console.log(`Build done. See ${outPath}`);
                    });
            });
        break;
    case 'watch':
        chokidar.watch('src').on('all', (event, path) => {
            console.log(event, path);
            build()
                .then(() => {
                    console.log('build done');
                });
        });
        break;
    default:
        throw new Error('Invalid verb: ' + verb);
}