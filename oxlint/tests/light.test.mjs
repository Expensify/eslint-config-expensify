/* eslint-disable rulesdir/prefer-underscore-method -- Node-only tooling, so native array methods are fine */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {test} from 'node:test';

import {packageDirectory} from './helpers.mjs';

/**
 * Imports a file of this package in a fresh process and lists every module it loaded (ES modules and require).
 * @param {string} file path from the package root
 * @param {string} [afterImport] code to run after the import, with the imported module as `imported`
 * @returns {string[]}
 */
function listLoadedModules(file, afterImport = '') {
    const script = `
        import {createRequire, registerHooks} from 'node:module';
        const urls = new Set();
        registerHooks({resolve(specifier, context, nextResolve) {
            const resolved = nextResolve(specifier, context);
            urls.add(resolved.url);
            return resolved;
        }});
        const imported = await import(${JSON.stringify(new URL(file, new URL('../../', import.meta.url)).href)});
        ${afterImport}
        const cached = Object.keys(createRequire(import.meta.url).cache);
        console.log(JSON.stringify([...urls, ...cached]));
    `;
    return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], {cwd: packageDirectory, encoding: 'utf8'}));
}

for (const file of ['oxlint/utils.js', 'oxlint/index.js']) {
    test(`importing ${file} does not load @oxlint/migrate, globals or eslint-config-prettier`, () => {
        // Given a fresh process, so nothing else has loaded them
        // When only that file is imported
        const loaded = listLoadedModules(file);

        // Then the conversion and its dependencies stay unloaded, which keeps plugin files and config files quick to load
        assert.ok(loaded.some(url => url.endsWith('oxlint/hosting.js')), 'the probe did not see the import');
        const heavy = loaded.filter(url => /@oxlint\/migrate|node_modules\/globals\/|eslint-config-prettier|oxlint\/convert\.js/.test(url));
        assert.deepEqual(heavy, []);
    });
}

test('getPresetRuleEntry does not load @oxlint/migrate', () => {
    // Given a fresh process, so nothing else has loaded it
    // When index.js is imported and a preset's setting is read
    const loaded = listLoadedModules('oxlint/index.js', "await imported.getPresetRuleEntry('browser', 'curly');");

    // Then the presets were loaded, but not the conversion, so a config that only reads a setting needs no @oxlint/migrate
    assert.ok(loaded.some(url => url.endsWith('oxlint/presets.js')), 'the probe did not see the presets load');
    const conversion = loaded.filter(url => /@oxlint\/migrate|oxlint\/convert\.js/.test(url));
    assert.deepEqual(conversion, []);
});
