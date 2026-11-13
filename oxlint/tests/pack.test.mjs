/* eslint-disable es/no-nullish-coalescing-operators, rulesdir/prefer-underscore-method -- Node-only tooling, so modern syntax and native array methods are fine */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {isBuiltin} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {packageDirectory} from './helpers.mjs';

const OXLINT_EXPORTS = ['./oxlint', './oxlint/utils', './oxlint/plugins/hosted', './oxlint/plugins/rulesdir'];

// `import 'name'`, `export ... from 'name'` and `require('name')`, for packages and not for relative files
const IMPORT_PATTERN = /^\s*(?:import|export)\b[^'\n]*?(?:from\s+)?'([^'.][^']*)'|\brequire\('([^'.][^']*)'\)/gm;

test('the packed package ships what its exports need and no tests, and imports only what it depends on', () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'expensify-oxlint-pack-'));
    try {
        const [{filename, files}] = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', work], {cwd: packageDirectory, encoding: 'utf8'}));
        const {exports, dependencies, peerDependencies} = JSON.parse(fs.readFileSync(path.join(packageDirectory, 'package.json'), 'utf8'));
        const shipped = files.map(file => file.path);
        execFileSync('tar', ['-xzf', path.join(work, filename), '-C', work]);
        const unpacked = path.join(work, 'package');

        assert.deepEqual(shipped.filter(file => file.startsWith('oxlint/tests')), [], 'tests are published');
        assert.deepEqual(OXLINT_EXPORTS.filter(key => !(key in exports)), [], 'an oxlint export is missing');
        const targets = Object.values(exports).flatMap(entry => (typeof entry === 'string' ? [entry] : Object.values(entry))).map(target => target.slice(2));
        assert.deepEqual(targets.filter(target => !shipped.includes(target)), [], 'an exports target is not published');

        // The copy below links every package of this checkout, so only this check can tell that a package the shipped code imports is not declared. typescript comes with typescript-eslint.
        const declared = [...Object.keys(dependencies), ...Object.keys(peerDependencies), 'typescript'];
        const imported = shipped
            .filter(file => file.endsWith('.js') && !file.includes('/tests/'))
            .flatMap(file => [...fs.readFileSync(path.join(unpacked, file), 'utf8').matchAll(IMPORT_PATTERN)].map(match => match[1] ?? match[2]));
        const undeclared = imported.filter(name => !isBuiltin(name) && !declared.some(dependency => name === dependency || name.startsWith(`${dependency}/`)));
        assert.deepEqual([...new Set(undeclared)], [], 'shipped code imports packages that are not dependencies');

        // @oxlint/migrate is an optional peer dependency, so it is linked only after the build has said what to install
        const modules = path.join(unpacked, 'node_modules');
        const link = name => fs.symlinkSync(path.join(packageDirectory, 'node_modules', name), path.join(modules, name));
        fs.mkdirSync(modules);
        for (const name of fs.readdirSync(path.join(packageDirectory, 'node_modules')).filter(entry => !['.bin', '@oxlint', 'react'].includes(entry))) {
            link(name);
        }

        // The react of the working directory must not win over the one where the package is installed
        for (const [directory, version] of [[unpacked, '19.0.0'], [work, '0.0.0-working-directory']]) {
            fs.mkdirSync(path.join(directory, 'node_modules/react'), {recursive: true});
            fs.writeFileSync(path.join(directory, 'node_modules/react/package.json'), JSON.stringify({name: 'react', version}));
        }
        const exportNames = Object.keys(exports).map(key => `eslint-config-expensify${key.slice(1)}`);
        fs.writeFileSync(
            path.join(unpacked, 'check.mjs'),
            `import {buildOxlintConfig} from 'eslint-config-expensify/oxlint';

for (const name of ${JSON.stringify(exportNames)}) {
    await import(name);
}
const config = await buildOxlintConfig({presets: ['browser', 'react', 'expensify', 'typescript', 'scripts', 'jest', 'prettier']});
process.stdout.write(config.settings.react.version);
`,
        );
        const run = () => execFileSync(process.execPath, [path.join(unpacked, 'check.mjs')], {cwd: work, stdio: 'pipe', encoding: 'utf8'});

        assert.throws(run, error => /npm install --save-dev "@oxlint\/migrate@>=1\.90\.0 <2"/.test(String(error.stderr)));
        link('@oxlint');
        assert.equal(run(), '19.0.0');
    } finally {
        fs.rmSync(work, {recursive: true, force: true});
    }
});
