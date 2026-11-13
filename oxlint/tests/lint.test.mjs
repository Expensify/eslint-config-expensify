/* eslint-disable rulesdir/prefer-underscore-method -- Node-only tooling */
import assert from 'node:assert/strict';
import {test} from 'node:test';

import {ALL_PRESETS, buildConfigInProject, lintProject} from './helpers.mjs';

test('the config of all the exported presets loads in oxlint', async () => {
    const config = await buildConfigInProject({presets: ALL_PRESETS});
    const {loaded, status, stderr} = await lintProject(config, {'index.js': 'export default 1;\n'});

    assert.ok(loaded, `oxlint did not load the config: ${stderr}`);
    assert.ok(status === 0 || status === 1, `oxlint exited with ${status}: ${stderr}`);
});

test('eslint-disable comments with ESLint rule IDs silence hosted and core rules', async () => {
    const code = comment => `import {useEffect} from 'react';
const value = {};
export function f() {
    ${comment('react-hooks/exhaustive-deps')}
    useEffect(() => { console.log(value.a); }, [value.b]);
    ${comment('dot-notation')}
    return value['a'];
}
`;
    const config = await buildConfigInProject({presets: ['browser', 'react', 'expensify', 'typescript']});
    const {diagnostics, stderr} = await lintProject(config, {
        'silenced.js': code(rule => `// eslint-disable-next-line ${rule}`),
        'loud.js': code(() => '// no directive'),
    });
    const codesIn = name => diagnostics.filter(diagnostic => diagnostic.filename.endsWith(name)).map(diagnostic => diagnostic.code);

    // The file without comments reports both rules, so the test can fail
    assert.ok(diagnostics.length > 0, `oxlint did not load the config: ${stderr}`);
    assert.ok(codesIn('loud.js').includes('hosted(exhaustive-deps)'), codesIn('loud.js').join(', '));
    assert.ok(codesIn('loud.js').includes('core(dot-notation)'), codesIn('loud.js').join(', '));
    assert.deepEqual(codesIn('silenced.js').filter(silencedCode => /exhaustive-deps|dot-notation/.test(silencedCode)), []);
});

test('a repo override can turn off a typescript/ rule, or a React Compiler rule by its react-hooks/ name, for its file only', async () => {
    // The repo lists no plugins for these rules, and oxlint treats react-hooks/ as react/
    const config = await buildConfigInProject({
        presets: ['browser', 'react', 'typescript'],
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
    const {diagnostics, stderr} = await lintProject(config, {
        'loud.ts': tsCode, 'quiet.ts': tsCode, 'loud.jsx': jsxCode, 'quiet.jsx': jsxCode,
    });
    const found = diagnostics
        .filter(diagnostic => /\((dot-notation|set-state-in-effect)\)$/.test(diagnostic.code))
        .map(diagnostic => `${diagnostic.filename} ${diagnostic.code}`)
        .sort();

    assert.ok(diagnostics.length > 0, `oxlint did not load the config: ${stderr}`);
    assert.deepEqual(found, ['loud.jsx react(set-state-in-effect)', 'loud.ts typescript(dot-notation)']);
});

test('an override naming a rule its plugin lacks is left to oxlint, which rejects the config', async () => {
    const config = await buildConfigInProject({
        presets: ['browser'], overrides: [{files: ['**/*.js'], rules: {'hosted/no-such-rule': 'error'}}],
    });
    const {loaded, stderr} = await lintProject(config, {'index.js': 'export default 1;\n'});

    assert.equal(loaded, false);
    assert.match(stderr, /Rule 'no-such-rule' not found in plugin 'hosted'/);
});

// A name that `export *` and a named re-export both give (import/export), a missing named import (import/named), and a valid import,
// in JS and in TS. Both rules read the imported modules to report.
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

test('import/export and import/named run as oxlint\'s own rules', async () => {
    const {diagnostics, stderr} = await lintProject(await buildConfigInProject({presets: ['browser']}), IMPORT_GRAPH_FILES);

    assert.ok(diagnostics.length > 0, `oxlint did not load the config: ${stderr}`);
    assert.deepEqual(importGraphFindings(diagnostics), [
        'missing-from-js.js:1 import(named)',
        'missing-from-ts.js:1 import(named)',
        'mixed.js:1 import(export)',
        'mixed.ts:1 import(export)',
    ]);
});
