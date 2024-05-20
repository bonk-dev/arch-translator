import * as esbuild from 'esbuild'
import * as fs from "node:fs";
import * as chokidar from 'chokidar';

const tmpPath = 'build/arch-translator.js';
const outPath = 'build/arch-translator.user.js';
const ctx = await esbuild.context({
    entryPoints: ['src/index.js'],
    bundle: true,
    outfile: tmpPath
});

async function build() {
    await ctx.rebuild();

    console.log('Prepending userscript header');

    const bundle = fs.readFileSync(tmpPath);
    const header = fs.readFileSync('src/uscript-header.txt');
    const bundleHandle = fs.openSync(outPath, 'w');

    fs.writeSync(bundleHandle, header, 0, header.length, 0);
    fs.writeSync(bundleHandle, bundle, 0, bundle.length, header.length);

    fs.closeSync(bundleHandle);
}

const watcher = chokidar.watch('src').on('all', (event, path) => {
    console.log(event, path);
    build()
        .then(() => {
            console.log('build done');
        });
});
