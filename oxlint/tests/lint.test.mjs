/* eslint-disable rulesdir/prefer-underscore-method -- Node-only tooling, so native array methods are fine */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';

import {buildOxlintConfig} from '../index.js';
import {
    ALL_PRESETS, EXPORTED_PRESETS, createFixtureProject, getOxlintEnvironment, packageDirectory, runOxlint,
} from './helpers.mjs';

const oxlintBinary = `${packageDirectory}node_modules/.bin/oxlint`;

/**
 * Lints a small file with a config in the real oxlint and checks that oxlint accepts the config.
 * @param {import('oxlint').OxlintConfig} config
 */
function assertConfigLoads(config) {
    const directory = createFixtureProject(JSON.stringify(config), {'index.js': 'export default 1;\n'});
    try {
        const {loaded, status, stderr} = runOxlint(directory, oxlintBinary, getOxlintEnvironment());

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
    // The same code twice, with and without disable comments in ESLint's IDs: react-hooks/exhaustive-deps runs as hosted/exhaustive-deps and dot-notation as core/dot-notation
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
        const {diagnostics, stderr} = runOxlint(directory, oxlintBinary, getOxlintEnvironment());
        const codesIn = name => diagnostics.filter(diagnostic => diagnostic.filename.endsWith(name)).map(diagnostic => diagnostic.code);

        // The file without comments reports both rules, so the test can fail
        assert.ok(diagnostics.length > 0, `oxlint did not load the config: ${stderr}`);
        assert.ok(codesIn('loud.js').includes('hosted(exhaustive-deps)'), codesIn('loud.js').join(', '));
        assert.ok(codesIn('loud.js').includes('core(dot-notation)'), codesIn('loud.js').join(', '));
        assert.deepEqual(codesIn('silenced.js').filter(silencedCode => /exhaustive-deps|dot-notation/.test(silencedCode)), []);
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }
});

test('a repo override can turn off a typescript/ rule, or a React Compiler rule by its react-hooks/ name, for its file only', async () => {
    // The repo lists no plugins for these rules, and oxlint treats react-hooks/ as react/
    const config = await buildOxlintConfig({
        presets: ['browser', 'react', 'typescript'],
        reactVersion: '19.0.0',
        overrides: [
            {files: ['quiet.ts'], rules: {'typescript/dot-notation': 'off'}},
            {files: ['quiet.jsx'], rules: {'react-hooks/set-state-in-effect': 'off'}},
        ],
    });
    const tsCode = 'const value: Record<string, string> = {};\nexport default value[\'a\'];\n';
    const jsxCode = [
        'import {useEffect, useState} from \'react\';',
        '',
        'export default function Counter({value}) {',
        '    const [count, setCount] = useState(0);',
        '    useEffect(() => { setCount(value); }, [value]);',
        '    return <i>{count}</i>;',
        '}',
        '',
    ].join('\n');
    const directory = createFixtureProject(JSON.stringify(config), {
        'loud.ts': tsCode, 'quiet.ts': tsCode, 'loud.jsx': jsxCode, 'quiet.jsx': jsxCode,
    });
    try {
        const {diagnostics, stderr} = runOxlint(directory, oxlintBinary, getOxlintEnvironment());
        const found = diagnostics
            .filter(diagnostic => /\((dot-notation|set-state-in-effect)\)$/.test(diagnostic.code))
            .map(diagnostic => `${diagnostic.filename} ${diagnostic.code}`)
            .sort();

        assert.ok(diagnostics.length > 0, `oxlint did not load the config: ${stderr}`);
        assert.deepEqual(found, ['loud.jsx react(set-state-in-effect)', 'loud.ts typescript(dot-notation)']);
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }
});

// Modules with a name that `export *` and a named re-export both give (import/export), a missing named import (import/named),
// and a valid import, in JS and in TS. Both rules have to read the imported modules to report them.
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
 * @param {Array<{code: string, filename: string, line?: number}>} diagnostics
 * @returns {string[]} the import/export and import/named findings in IMPORT_GRAPH_FILES, as `file:line code`
 */
const importGraphFindings = diagnostics => diagnostics
    .filter(diagnostic => diagnostic.filename in IMPORT_GRAPH_FILES && /\((export|named)\)$/.test(diagnostic.code))
    .map(diagnostic => `${diagnostic.filename}:${diagnostic.line} ${diagnostic.code}`)
    .sort();

for (const withNursery of [false, true]) {
    test(`import/export and import/named read the imported modules${withNursery ? ' with withNursery' : ''}`, async () => {
        const config = await buildOxlintConfig({presets: ['browser'], withNursery, reactVersion: '19.0.0'});
        const directory = createFixtureProject(JSON.stringify(config), IMPORT_GRAPH_FILES);
        try {
            const {diagnostics, stderr} = runOxlint(directory, oxlintBinary, getOxlintEnvironment());

            assert.ok(diagnostics.length > 0, `oxlint did not load the config: ${stderr}`);

            // import/export runs as oxlint's own rule either way, and import/named only with withNursery
            const namedCode = withNursery ? 'import(named)' : 'hosted(named)';
            assert.deepEqual(importGraphFindings(diagnostics), [
                `missing-from-js.js:1 ${namedCode}`,
                `missing-from-ts.js:1 ${namedCode}`,
                'mixed.js:1 import(export)',
                'mixed.ts:1 import(export)',
            ]);
        } finally {
            fs.rmSync(directory, {recursive: true, force: true});
        }
    });
}
