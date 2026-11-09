import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const packageDirectory = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Imports a file of this package in a fresh process and lists every module it loaded (ES modules and require).
 * @param {string} file path from the package root
 * @returns {string[]}
 */
function listLoadedModules(file) {
    const script = `
        import {createRequire, registerHooks} from 'node:module';
        const urls = new Set();
        registerHooks({resolve(specifier, context, nextResolve) {
            const resolved = nextResolve(specifier, context);
            urls.add(resolved.url);
            return resolved;
        }});
        await import(${JSON.stringify(new URL(file, new URL('../../', import.meta.url)).href)});
        const cached = Object.keys(createRequire(import.meta.url).cache);
        console.log(JSON.stringify([...urls, ...cached]));
    `;
    return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], {cwd: packageDirectory, encoding: 'utf8'}));
}

for (const file of ['oxlint/utils.mjs', 'oxlint/index.mjs']) {
    test(`importing ${file} does not load @oxlint/migrate, globals or eslint-config-prettier`, () => {
        // Given a fresh process, so nothing else has loaded them
        // When the file is imported
        const loaded = listLoadedModules(file);

        // Then the conversion and its dependencies stay unloaded, which keeps plugin files and config files quick to load
        assert.ok(loaded.some(url => url.endsWith('oxlint/hosting.mjs')), 'the probe did not see the import');
        const heavy = loaded.filter(url => /@oxlint\/migrate|node_modules\/globals\/|eslint-config-prettier|oxlint\/convert\.mjs/.test(url));
        assert.deepEqual(heavy, []);
    });
}
