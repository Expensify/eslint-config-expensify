/* eslint-disable rulesdir/prefer-underscore-method -- Node-only tooling, so native array methods are fine */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';

import {buildOxlintConfig} from '../index.js';
import {
    createFixtureProject, getOxlintEnvironment, packageDirectory, runOxlint,
} from './helpers.mjs';

const oxlintBinary = `${packageDirectory}node_modules/.bin/oxlint`;

// Every preset the package exports, by file name in configs/public.
const EXPORTED_PRESETS = fs.readdirSync(new URL('../../configs/public/', import.meta.url)).map(file => file.replace(/\.js$/, '')).sort();

// All of them in one list. `formatting` comes before `typescript` because the conversion refuses an unscoped block that
// follows a scoped one for the same rule.
const ALL_PRESETS = ['browser', 'node', 'expensify', 'formatting', 'react', 'react-formatting', 'typescript', 'scripts', 'jest', 'prettier'];

/**
 * Lints a small file with a config in the real oxlint and checks that oxlint accepts the config.
 * @param {import('oxlint').OxlintConfig} config
 */
function assertConfigLoads(config) {
    // Given the config as JSON in a temp project with one file
    const directory = createFixtureProject(JSON.stringify(config), {'index.js': 'export default 1;\n'});
    try {
        // When oxlint lints the file
        const {loaded, status, stderr} = runOxlint(directory, oxlintBinary, getOxlintEnvironment());

        // Then the config loads, with no unknown rule or invalid setting, and the run ends as a lint run does
        assert.ok(loaded, `oxlint did not load the config: ${stderr}`);
        assert.ok(status === 0 || status === 1, `oxlint exited with ${status}: ${stderr}`);
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }
}

for (const name of EXPORTED_PRESETS) {
    test(`the ${name} preset alone builds a config that loads in oxlint`, async () => {
        assertConfigLoads(await buildOxlintConfig({presets: [name], reactVersion: '19.0.0'}));
    });
}

test('the config of all the exported presets loads in oxlint', async () => {
    assertConfigLoads(await buildOxlintConfig({presets: ALL_PRESETS, reactVersion: '19.0.0'}));
});

test('eslint-disable comments with ESLint rule IDs silence hosted and core rules', async () => {
    // Given the same code twice: with disable comments that use ESLint's IDs, and without them. `react-hooks/exhaustive-deps`
    // runs as hosted/exhaustive-deps, and `dot-notation` runs as core/dot-notation (see the converted config).
    const code = comment => `import {useEffect} from 'react';
const value = {};
export function f() {
    ${comment('react-hooks/exhaustive-deps')}
    useEffect(() => { console.log(value.a); }, [value.b]);
    ${comment('dot-notation')}
    return value['a'];
}
`;
    const config = await buildOxlintConfig({presets: ['browser', 'react', 'expensify', 'typescript'], reactVersion: '19.0.0'});
    const directory = createFixtureProject(JSON.stringify(config), {
        'silenced.js': code(rule => `// eslint-disable-next-line ${rule}`),
        'loud.js': code(() => '// no directive'),
    });
    try {
        // When oxlint lints both files
        const {diagnostics, stderr} = runOxlint(directory, oxlintBinary, getOxlintEnvironment());
        const codesIn = name => diagnostics.filter(diagnostic => diagnostic.filename.endsWith(name)).map(diagnostic => diagnostic.code);

        // Then the file without comments reports both rules, so the test can fail, and the one with comments reports neither
        assert.ok(diagnostics.length > 0, `oxlint did not load the config: ${stderr}`);
        assert.ok(codesIn('loud.js').includes('hosted(exhaustive-deps)'), codesIn('loud.js').join(', '));
        assert.ok(codesIn('loud.js').includes('core(dot-notation)'), codesIn('loud.js').join(', '));
        assert.deepEqual(codesIn('silenced.js').filter(silencedCode => /exhaustive-deps|dot-notation/.test(silencedCode)), []);
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }
});

test('without the typescript preset, dot-notation reports once on a JS file', async () => {
    // Given a config built from the browser preset only, and a JS file that breaks dot-notation
    const config = await buildOxlintConfig({presets: ['browser'], reactVersion: '19.0.0'});
    const directory = createFixtureProject(JSON.stringify(config), {'dot.js': 'const value = {};\nexport default value[\'a\'];\n'});
    try {
        // When oxlint lints it
        const {diagnostics, stderr} = runOxlint(directory, oxlintBinary, getOxlintEnvironment());

        // Then ESLint's rule reports it, and the typescript-eslint version does not report it a second time
        assert.ok(diagnostics.length > 0, `oxlint did not load the config: ${stderr}`);
        const codes = diagnostics.filter(diagnostic => diagnostic.filename.endsWith('dot.js') && diagnostic.code.includes('dot-notation')).map(diagnostic => diagnostic.code);
        assert.deepEqual(codes, ['core(dot-notation)']);
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }
});

test('a repo override can turn off a typescript/ rule without listing the typescript plugin', async () => {
    // Given the typescript preset, and a repo override that turns typescript/dot-notation off for a TS file
    const config = await buildOxlintConfig({
        presets: ['browser', 'typescript'],
        reactVersion: '19.0.0',
        overrides: [{files: ['quiet.ts'], rules: {'typescript/dot-notation': 'off'}}],
    });
    const code = 'const value: Record<string, string> = {};\nexport default value[\'a\'];\n';
    const directory = createFixtureProject(JSON.stringify(config), {'loud.ts': code, 'quiet.ts': code});
    try {
        // When oxlint lints both files
        const {diagnostics, stderr} = runOxlint(directory, oxlintBinary, getOxlintEnvironment());
        const dotNotationIn = name => diagnostics.filter(diagnostic => diagnostic.filename.endsWith(name) && diagnostic.code.includes('dot-notation'));

        // Then the preset's rule reports in the other file, and the override silences it in its file
        assert.ok(diagnostics.length > 0, `oxlint did not load the config: ${stderr}`);
        assert.equal(dotNotationIn('loud.ts').length, 1);
        assert.deepEqual(dotNotationIn('quiet.ts'), []);
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }
});

test('a repo override can use the react-hooks/ prefix for a React Compiler rule that oxlint runs as react/', async () => {
    // Given the react preset, and an override that turns react-hooks/set-state-in-effect off for one file
    const config = await buildOxlintConfig({
        presets: ['browser', 'react'],
        reactVersion: '19.0.0',
        overrides: [{files: ['quiet.jsx'], rules: {'react-hooks/set-state-in-effect': 'off'}}],
    });
    const code = [
        'import {useEffect, useState} from \'react\';',
        '',
        'export default function Counter({value}) {',
        '    const [count, setCount] = useState(0);',
        '    useEffect(() => { setCount(value); }, [value]);',
        '    return <i>{count}</i>;',
        '}',
        '',
    ].join('\n');
    const directory = createFixtureProject(JSON.stringify(config), {'loud.jsx': code, 'quiet.jsx': code});
    try {
        // When oxlint lints both files
        const {diagnostics, stderr} = runOxlint(directory, oxlintBinary, getOxlintEnvironment());
        const reportedIn = name => diagnostics.filter(diagnostic => diagnostic.filename.endsWith(name) && diagnostic.code === 'react(set-state-in-effect)');

        // Then the rule reports in the other file, and the override silences it, because oxlint treats react-hooks/ as react/
        assert.ok(diagnostics.length > 0, `oxlint did not load the config: ${stderr}`);
        assert.equal(reportedIn('loud.jsx').length, 1);
        assert.deepEqual(reportedIn('quiet.jsx'), []);
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }
});

test('a preset glob without a slash matches at the root only, as in ESLint', async () => {
    // Given the jest preset, which relaxes no-console for `jestSetup.js`, and that file at the root and in a folder
    const config = await buildOxlintConfig({presets: ['browser', 'jest'], reactVersion: '19.0.0'});
    const code = 'console.log(1);\n';
    const directory = createFixtureProject(JSON.stringify(config), {'jestSetup.js': code, 'nested/jestSetup.js': code});
    try {
        // When oxlint lints both
        const {diagnostics, stderr} = runOxlint(directory, oxlintBinary, getOxlintEnvironment());
        const noConsoleIn = diagnostics.filter(diagnostic => diagnostic.code.endsWith('(no-console)') && diagnostic.filename.endsWith('jestSetup.js')).map(diagnostic => diagnostic.filename);

        // Then only the nested file reports, since ESLint matches `jestSetup.js` against the root file only
        assert.ok(diagnostics.length > 0, `oxlint did not load the config: ${stderr}`);
        assert.deepEqual(noConsoleIn, ['nested/jestSetup.js']);
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }
});

test('no-new-object and no-new-symbol report what ESLint reports, and their eslint-disable comments work', async () => {
    // Given the browser preset, which sets both rules, and code that only some of their oxlint counterparts report
    const config = await buildOxlintConfig({presets: ['browser'], reactVersion: '19.0.0'});
    const directory = createFixtureProject(JSON.stringify(config), {
        'loud.js': 'export const a = new Object();\nexport const b = new Symbol();\nexport const c = Object();\nexport const d = new BigInt(1);\n',
        'quiet.js': '// eslint-disable-next-line no-new-object\nexport const a = new Object();\n// eslint-disable-next-line no-new-symbol\nexport const b = new Symbol();\n',
    });
    try {
        // When oxlint lints both files
        const {diagnostics, stderr} = runOxlint(directory, oxlintBinary, getOxlintEnvironment());
        const codesIn = name => diagnostics.filter(diagnostic => diagnostic.filename === name && /object|symbol|native/i.test(diagnostic.code)).map(diagnostic => diagnostic.code).sort();

        // Then each reports once on its ESLint line (not on `Object()` or `new BigInt(1)`), and the comments silence them
        assert.ok(diagnostics.length > 0, `oxlint did not load the config: ${stderr}`);
        assert.deepEqual(codesIn('loud.js'), ['core(no-new-object)', 'core(no-new-symbol)']);
        assert.deepEqual(codesIn('quiet.js'), []);
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }
});

// Modules that break import/export through a name that `export *` and a named re-export both give, and import/named
// through a missing name, in JS and in TS, and a file that imports correctly. Both rules have to read the imported
// modules to report them.
const IMPORT_GRAPH_FILES = {
    'mixed.ts': 'export * from \'./shared-one\';\nexport {shared} from \'./shared-two\';\n',
    'shared-one.ts': 'export const shared = 1;\n',
    'shared-two.ts': 'export const shared = 2;\n',
    'mixed.js': 'export * from \'./shared-three\';\nexport {shared} from \'./shared-four\';\n',
    'shared-three.js': 'export const shared = 3;\n',
    'shared-four.js': 'export const shared = 4;\n',
    'missing-from-js.js': 'import {missing} from \'./shared-three\';\n\nexport default missing;\n',
    'missing-from-ts.js': 'import {missing} from \'./shared-one\';\n\nexport default missing;\n',
    'valid.js': 'import {shared} from \'./shared-one\';\n\nexport default shared;\n',
};

/**
 * @param {Array<{code: string, filename: string, line?: number, message?: string}>} diagnostics
 * @returns {string[]} the import/export and import/named findings in IMPORT_GRAPH_FILES, as `file:line code message`
 */
const importGraphFindings = diagnostics => diagnostics
    .filter(diagnostic => diagnostic.filename in IMPORT_GRAPH_FILES && /\((export|named)\)$/.test(diagnostic.code))
    .map(diagnostic => `${diagnostic.filename}:${diagnostic.line} ${diagnostic.code} ${diagnostic.message}`)
    .sort();

for (const withNursery of [false, true]) {
    test(`import/export and import/named read the imported modules${withNursery ? ' with withNursery' : ''}`, async () => {
        // Given the browser preset, and modules whose problems only show when the imported modules are read
        const config = await buildOxlintConfig({presets: ['browser'], withNursery, reactVersion: '19.0.0'});
        const directory = createFixtureProject(JSON.stringify(config), IMPORT_GRAPH_FILES);
        try {
            // When oxlint lints them
            const {diagnostics, stderr} = runOxlint(directory, oxlintBinary, getOxlintEnvironment());

            // Then each problem is reported, and the valid import is not. import/export runs as oxlint's own rule either
            // way. import/named does so only with withNursery
            assert.ok(diagnostics.length > 0, `oxlint did not load the config: ${stderr}`);
            const named = withNursery
                ? ['missing-from-js.js:1 import(named) named import "missing" not found', 'missing-from-ts.js:1 import(named) named import "missing" not found']
                : ['missing-from-js.js:1 hosted(named) missing not found in \'./shared-three\'', 'missing-from-ts.js:1 hosted(named) missing not found in \'./shared-one\''];
            assert.deepEqual(importGraphFindings(diagnostics), [
                ...named,
                'mixed.js:1 import(export) Multiple exports of name \'shared\'.',
                'mixed.ts:1 import(export) Multiple exports of name \'shared\'.',
            ].sort());
        } finally {
            fs.rmSync(directory, {recursive: true, force: true});
        }
    });
}

for (const withNursery of [false, true]) {
    test(`import/export runs as oxlint's own rule${withNursery ? ' with withNursery' : ''}`, async () => {
        // Given the browser preset, which turns import/export on, and a project where two exports of one module give a name
        const config = await buildOxlintConfig({presets: ['browser'], withNursery, reactVersion: '19.0.0'});
        const directory = createFixtureProject(JSON.stringify(config), {
            'shared.js': 'export const shared = 1;\n',
            'other.js': 'export const shared = 2;\n',
            'mixed.js': 'export * from \'./shared\';\nexport {shared} from \'./other\';\n',
        });
        try {
            // When oxlint lints it
            const {diagnostics, stderr} = runOxlint(directory, oxlintBinary, getOxlintEnvironment());

            // Then the config sets the native rule with the import plugin and no hosted copy, and oxlint reports the name
            assert.ok(diagnostics.length > 0, `oxlint did not load the config: ${stderr}`);
            assert.equal(config.rules['import/export'], 'error');
            assert.ok(config.plugins.includes('import'));
            assert.equal('hosted/export' in config.rules, false);
            assert.deepEqual(diagnostics.filter(diagnostic => diagnostic.code === 'import(export)').map(diagnostic => diagnostic.filename), ['mixed.js']);
        } finally {
            fs.rmSync(directory, {recursive: true, force: true});
        }
    });
}
