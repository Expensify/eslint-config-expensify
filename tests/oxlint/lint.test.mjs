import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';

import {SNAPSHOT_CASES, readRealConfig} from './cases.mjs';
import {
    createFixtureProject, getOxlintEnvironment, packageDirectory, runOxlint,
} from './helpers.mjs';

const oxlintBinary = `${packageDirectory}node_modules/.bin/oxlint`;

for (const name of Object.keys(SNAPSHOT_CASES)) {
    test(`the ${name} config, written as JSON in another folder, loads in oxlint and lints the fixtures`, async () => {
        // Given the config as JSON in a temp project, which is how a repo that writes the built config would use it
        const directory = createFixtureProject(await readRealConfig(name));
        try {
            // When oxlint lints the fixtures
            const {codes, stderr} = runOxlint(directory, oxlintBinary, getOxlintEnvironment());

            // Then the config loads, and rules from oxlint, core, hosted and rulesdir all report
            assert.ok(codes.length > 0, `oxlint did not load the config: ${stderr}`);
            for (const expected of ['eslint(eqeqeq)', 'typescript(dot-notation)', 'hosted(exhaustive-deps)', 'hosted(prefer-default-export)']) {
                assert.ok(codes.includes(expected), `expected ${expected} in ${[...new Set(codes)].join(', ')}`);
            }
            if (name === 'app') {
                assert.ok(codes.includes('rulesdir(no-inline-named-export)'), 'expected a rulesdir report');
            }
        } finally {
            fs.rmSync(directory, {recursive: true, force: true});
        }
    });
}

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
    const directory = createFixtureProject(await readRealConfig('app'), {
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
