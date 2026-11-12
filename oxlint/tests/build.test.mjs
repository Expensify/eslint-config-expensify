/* eslint-disable es/no-optional-chaining, es/no-nullish-coalescing-operators, rulesdir/prefer-underscore-method -- Node-only tooling, so modern syntax and native array methods are fine */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

import {convertPresets} from '../convert.js';
import {splitRuleID} from '../hosting.js';
import {isOff, mergeRuleEntries, ruleMapsOf} from '../rule-entry.js';
import {checkScopedImportSettings} from '../presets.js';
import {
    alwaysHostedRuleIDs, buildOxlintConfig, getPresetRuleEntry, hostRule, reactCompilerRuleNames, toEslintRuleID,
} from '../index.js';

/**
 * Runs `callback` with an empty temp folder as the working directory, so `react` cannot be resolved from it. Node also
 * looks for `node_modules` in the folders above, so this fails up front when one of them has a node_modules/react.
 * @param {() => Promise<void>} callback
 */
async function inEmptyDirectory(callback) {
    const cwd = process.cwd();
    const emptyDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'expensify-oxlint-empty-'));
    assert.throws(
        () => createRequire(path.join(emptyDirectory, 'index.js')).resolve('react'),
        `react resolves from ${emptyDirectory}, so this test cannot check what happens without it. Set TMPDIR to a folder with no node_modules/react above it.`,
    );
    process.chdir(emptyDirectory);
    try {
        await callback();
    } finally {
        process.chdir(cwd);
        fs.rmSync(emptyDirectory, {recursive: true, force: true});
    }
}

/** @returns {boolean} whether `react` resolves from this checkout, the second place buildOxlintConfig looks */
function canResolveReactFromPackage() {
    try {
        createRequire(fileURLToPath(import.meta.url)).resolve('react');
        return true;
    } catch {
        return false;
    }
}

/**
 * @param {import('oxlint').OxlintConfig} config
 * @param {string} name a rule name as written in the config, like `hosted/exhaustive-deps`
 * @returns {boolean} whether the root or any override sets the rule
 */
const hasRule = (config, name) => ruleMapsOf(config).some(rules => name in rules);

test('React Compiler rules are kept as @oxlint/migrate writes them by default, and rules-of-hooks stays', async () => {
    // Given the react preset, which turns on React Compiler rules
    // When the config is built without a transformRule
    const config = await buildOxlintConfig({presets: ['react'], reactVersion: '19.0.0'});

    // Then the compiler rules are there under the native `react/` name, except the checks oxlint does not implement
    assert.ok(reactCompilerRuleNames.length > 10);
    assert.ok(hasRule(config, 'react/immutability') && hasRule(config, 'react/purity'));
    assert.ok(!hasRule(config, 'hosted/gating') && !hasRule(config, 'react/gating') && !hasRule(config, 'react/config'));
    assert.ok(hasRule(config, 'react/rules-of-hooks'));
    assert.ok(hasRule(config, 'hosted/exhaustive-deps'));
});

test('nativeRules runs an always-hosted rule with oxlint\'s version, and rejects other IDs', async () => {
    // Given the react preset, whose exhaustive-deps options are the ones both versions must get
    const presets = ['react'];
    const reactVersion = '19.0.0';
    const optionsOf = (config, name) => ruleMapsOf(config).map(rules => rules[name]).find(Boolean);

    // When the config is built with and without nativeRules
    const hosted = await buildOxlintConfig({presets, reactVersion});
    const native = await buildOxlintConfig({presets, reactVersion, nativeRules: ['react-hooks/exhaustive-deps']});

    // Then the default hosts it, and the opt-in runs the native rule with the same options and no hosted copy
    assert.ok(hasRule(hosted, 'hosted/exhaustive-deps') && !hasRule(hosted, 'react/exhaustive-deps'));
    assert.ok(hasRule(native, 'react/exhaustive-deps') && !hasRule(native, 'hosted/exhaustive-deps'));
    assert.deepEqual(optionsOf(native, 'react/exhaustive-deps'), optionsOf(hosted, 'hosted/exhaustive-deps'));

    // And an overrides entry may use the native name, while an ID that is not always hosted throws
    await buildOxlintConfig({
        presets, reactVersion, nativeRules: ['react-hooks/exhaustive-deps'], overrides: [{files: ['**/*.js'], rules: {'react/exhaustive-deps': 'off'}}],
    });
    await assert.rejects(buildOxlintConfig({presets, reactVersion, nativeRules: ['no-console']}), /nativeRules has no-console/);
});

test('with nativeRules, the native name of a rule is accepted and its hosted/ name is refused', async () => {
    // Given every always-hosted rule run natively
    const nativeRules = ['import/prefer-default-export', 'react/function-component-definition', 'react/jsx-no-constructed-context-values', 'react-hooks/exhaustive-deps'];
    const build = rule => buildOxlintConfig({
        presets: ['react'], reactVersion: '19.0.0', nativeRules, overrides: [{files: ['**/*.js'], rules: {[rule]: 'off'}}],
    });

    // When an override names each rule as oxlint does, then it is accepted
    for (const rule of [...nativeRules, 'react/exhaustive-deps']) {
        await build(rule);
    }

    // And the hosted/ name, which would do nothing, is refused with the name to use
    await assert.rejects(build('hosted/prefer-default-export'), /runs as "import\/prefer-default-export"/);
    await assert.rejects(build('hosted/exhaustive-deps'), /runs as "react\/exhaustive-deps"/);
});

for (const withNursery of [false, true]) {
    test(`import/export is written as oxlint's own rule, with its plugin and files${withNursery ? ', with withNursery' : ''}`, async () => {
        // Given blocks that set import/export, with options and for some files only, and no other import rule
        const blocks = [{rules: {'import/export': ['warn']}}, {files: ['**/*.ts'], rules: {'import/export': ['error']}}];

        // When they are converted
        const {config} = await convertPresets(blocks, {withNursery});

        // Then the rule keeps its name, severity and files, and the import plugin is listed
        assert.deepEqual(config.rules, {'import/export': ['warn']});
        assert.deepEqual(config.overrides, [{files: ['**/*.ts'], rules: {'import/export': ['error']}}]);
        assert.ok(config.plugins.includes('import'));
    });
}

test('import/export is not always hosted, so an override names it as oxlint does', async () => {
    // Given overrides that name import/export natively and as a hosted rule
    const build = (rule, withNursery, nativeRules) => buildOxlintConfig({
        presets: ['browser'], reactVersion: '19.0.0', withNursery, nativeRules, overrides: [{files: ['**/*.js'], rules: {[rule]: 'off'}}],
    });

    // When the config is built, then the native name passes in both modes and the hosted name is refused with the name to use
    for (const withNursery of [false, true]) {
        await build('import/export', withNursery);
        await assert.rejects(build('hosted/export', withNursery), /"hosted\/export", but this rule runs as "import\/export"/);
    }

    // And it is not in alwaysHostedRuleIDs, so nativeRules refuses it
    assert.equal(alwaysHostedRuleIDs.includes('import/export'), false);
    await assert.rejects(build('import/export', false, ['import/export']), /nativeRules has import\/export/);
});

test('transformRule can rename or drop a rule', async () => {
    // Given a transformRule that sends compiler rules to `rc/` and drops no-console
    const transformRule = (ruleID, entry) => {
        const {prefix, name} = splitRuleID(ruleID);
        if (prefix === 'react-hooks' && reactCompilerRuleNames.includes(name)) {
            return [`rc/${name}`, entry];
        }
        return ruleID === 'no-console' ? null : undefined;
    };

    // When the config is built
    const config = await buildOxlintConfig({presets: ['browser', 'react'], transformRule, reactVersion: '19.0.0'});

    // Then compiler rules are written under the new name and no-console is gone
    assert.ok(hasRule(config, 'rc/immutability'));
    assert.ok(!hasRule(config, 'no-console'));
});

test('an unknown react-hooks rule fails the conversion', async () => {
    // Given a preset block with a react-hooks rule that is neither a compiler rule nor classic
    const blocks = [{rules: {'react-hooks/made-up-rule': 'error'}}];

    // When it is converted, then the error names the rule instead of running a rule nobody checked
    await assert.rejects(convertPresets(blocks), /react-hooks\/made-up-rule is set by a preset, but the installed eslint-plugin-react-hooks has no such rule/);
});

test('buildOxlintConfig points at the plugin files with absolute paths, and plugins can be replaced', async () => {
    // Given a repo with its own hosted plugin file
    // When the config is built with it as plugins.hosted
    const config = await buildOxlintConfig({presets: ['browser', 'react', 'expensify'], plugins: {hosted: '/repo/hosted.js'}, reactVersion: '19.0.0'});

    // Then every plugin of the package has an absolute path and the repo's replaces `hosted`
    const specifiers = Object.fromEntries(config.jsPlugins.map(plugin => [plugin.name, plugin.specifier]));
    assert.equal(specifiers.hosted, '/repo/hosted.js');
    assert.ok(specifiers.core.startsWith('/') && specifiers.core.endsWith('oxlint/plugins/core.js'));
    assert.ok(specifiers.rulesdir.startsWith('/') && specifiers.rulesdir.endsWith('oxlint/plugins/rulesdir.js'));
});

test('overrides that use the wrong name for a hosted or core rule are rejected', async () => {
    // Given overrides that set a rule by oxlint's name while it runs hosted, core, or under a name no plugin has
    const build = (rule, extraRunningNames) => buildOxlintConfig({
        presets: ['react'], reactVersion: '19.0.0', overrides: [{files: ['**/*.js'], rules: {[rule]: 'off'}}], extraRunningNames,
    });

    // When the config is built, then each one fails with the name to use
    await assert.rejects(build('import/prefer-default-export'), /Use that name instead/);
    await assert.rejects(build('no-restricted-syntax'), /runs as "core\/no-restricted-syntax"/);
    await assert.rejects(build('react/exhaustive-deps'), /runs as "hosted\/exhaustive-deps"/);
    await assert.rejects(build('hosted/not-a-rule'), /npm run build:oxlint/);

    // And the repo's own rules pass when they are named in extraRunningNames
    await build('hosted/not-a-rule', ['hosted/not-a-rule']);
    await build('rc/immutability', ['rc/']);
});

test('overrides that name a dropped rule or a rule replaced by a stand-in are rejected', async () => {
    // Given overrides that name rules the conversion drops or replaces, which oxlint would refuse to load
    const build = (rule, extraRunningNames) => buildOxlintConfig({
        presets: ['react'], reactVersion: '19.0.0', overrides: [{files: ['**/*.js'], rules: {[rule]: 'off'}}], extraRunningNames,
    });

    // When the config is built, then each one fails and says why
    await assert.rejects(build('no-invalid-this'), /"no-invalid-this", but this rule is dropped \(calls sourceCode.*oxlint would refuse to load the config.*oxlint\/tables\.js/s);
    await assert.rejects(build('react/jsx-uses-vars'), /"react\/jsx-uses-vars", but this rule is dropped/);
    await assert.rejects(build('react-hooks/gating'), /"react-hooks\/gating", but this rule is dropped/);
    await assert.rejects(build('react/gating'), /"react\/gating", but this rule is dropped/);
    await assert.rejects(build('rulesdir/prefer-at'), /"rulesdir\/prefer-at", but this rule runs as "unicorn\/prefer-at"\. oxlint would refuse to load the config/);

    // And the name a stand-in runs as, and rules a repo's own plugin provides, still pass
    await build('unicorn/prefer-at');
    await build('rulesdir/no-negated-variables');
    await build('no-invalid-this', ['no-invalid-this']);
    await build('rulesdir/prefer-at', ['rulesdir/']);
});

test('overrides that name a rule transformRule renamed are rejected, and the new name works', async () => {
    // Given the React Compiler rules renamed to `rc/`, which the repo's own plugin provides
    const transformRule = (ruleID, entry) => {
        const {prefix, name} = splitRuleID(ruleID);
        return prefix === 'react-hooks' && reactCompilerRuleNames.includes(name) ? [`rc/${name}`, entry] : undefined;
    };
    const build = rule => buildOxlintConfig({
        presets: ['react'], reactVersion: '19.0.0', transformRule, extraRunningNames: ['rc/'], overrides: [{files: ['**/*.js'], rules: {[rule]: 'off'}}],
    });

    // When an override names the rule by an ESLint name, then it fails with the name the rule runs as
    await assert.rejects(build('react-hooks/set-state-in-effect'), /"react-hooks\/set-state-in-effect", but this rule runs as "rc\/set-state-in-effect"/);
    await assert.rejects(build('react/set-state-in-effect'), /"react\/set-state-in-effect", but this rule runs as "rc\/set-state-in-effect"/);

    // And the new name works
    await build('rc/set-state-in-effect');
});

test('buildOxlintConfig needs a React version when the react preset is used and react cannot be resolved', async (t) => {
    // buildOxlintConfig also looks for react from where this package sits, so a checkout inside a project with react
    // finds it and this case cannot happen there. CI checks out the package on its own.
    if (canResolveReactFromPackage()) {
        t.skip('react resolves from this checkout\'s location');
        return;
    }

    // Given an empty working directory where react cannot be resolved
    await inEmptyDirectory(async () => {
        // When the react preset is built without reactVersion, then the error asks for `reactVersion`
        await assert.rejects(buildOxlintConfig({presets: ['react']}), /pass `reactVersion`/);

        // And presets without react do not need one
        await buildOxlintConfig({presets: ['expensify']});
    });
});

test('settings.react.version is accepted as the React version', async () => {
    // Given an empty working directory, where react cannot be resolved
    await inEmptyDirectory(async () => {
        // When the react preset is built with the version only in settings
        const config = await buildOxlintConfig({presets: ['react'], settings: {react: {version: '18.2.0'}}});

        // Then it is used
        assert.equal(config.settings.react.version, '18.2.0');
    });
});

test('settings.react.version "detect" is not written to the config', async () => {
    // Given a repo that copied ESLint's `react.version: 'detect'`, which oxlint refuses
    const settings = {react: {version: 'detect', pragma: 'React'}};

    // When the react preset is built with a React version
    const withVersion = await buildOxlintConfig({presets: ['react'], reactVersion: '19.0.0', settings});

    // Then the version is the one given, and the other react settings stay
    assert.equal(withVersion.settings.react.version, '19.0.0');
    assert.equal(withVersion.settings.react.pragma, 'React');

    // And presets without react do not get 'detect' either
    assert.equal(JSON.stringify((await buildOxlintConfig({presets: ['browser'], settings})).settings).includes('detect'), false);
});

test('settings.react.version "detect" looks up the installed React, like no version', async () => {
    // When the react preset is built with 'detect' and no reactVersion
    const build = () => buildOxlintConfig({presets: ['react'], settings: {react: {version: 'detect'}}});

    // Then the installed React version is used, or the build asks for `reactVersion` when react cannot be found
    if (canResolveReactFromPackage()) {
        assert.equal((await build()).settings.react.version, createRequire(import.meta.url)('react/package.json').version);
        return;
    }
    await inEmptyDirectory(async () => {
        await assert.rejects(build(), /pass `reactVersion`/);
    });
});

test('withNursery is an option, off by default', async () => {
    // Given the same presets
    // When they are built with and without nursery rules
    const without = await buildOxlintConfig({presets: ['browser'], reactVersion: '19.0.0'});
    const withNursery = await buildOxlintConfig({presets: ['browser'], withNursery: true, reactVersion: '19.0.0'});

    // Then a nursery rule runs as core/ from ESLint's code by default, and natively with the option
    assert.ok(hasRule(without, 'core/no-undef') && !hasRule(without, 'no-undef'));
    assert.ok(hasRule(withNursery, 'no-undef') && !hasRule(withNursery, 'core/no-undef'));
});

test('{preset, files} keeps each block of the preset on its own file types inside files', async () => {
    // Given the typescript preset, whose blocks are for TS files and for JS files, limited to a folder and two files
    const config = await buildOxlintConfig({presets: [{preset: 'typescript', files: ['src/**', 'setup.ts', 'setup.js']}], reactVersion: '19.0.0'});

    // When the overrides are sorted by whether they turn a typescript/ rule on
    const turnsTypeScriptRuleOn = override => Object.entries(override.rules ?? {}).some(([rule, entry]) => rule.startsWith('typescript/') && !isOff(entry));
    const typeScriptOverrides = config.overrides.filter(turnsTypeScriptRuleOn);
    const jsOverrides = config.overrides.filter(override => override.files.includes('./setup.js'));

    // Then the TS blocks apply to TS files in the folder and the root setup.ts only, and the JS block to JS files and setup.js
    assert.ok(typeScriptOverrides.length > 0);
    for (const {files} of typeScriptOverrides) {
        assert.deepEqual(files.filter(file => !/^(src\/\*\*\/\*\.[cm]?tsx?|\.\/setup\.ts)$/.test(file)), [], JSON.stringify(files));
        assert.ok(files.includes('src/**/*.ts') && files.includes('./setup.ts'), JSON.stringify(files));
    }
    assert.ok(jsOverrides.length > 0);
    for (const {files} of jsOverrides) {
        assert.deepEqual(files.filter(file => !/^(src\/\*\*\/\*\.[cm]?jsx?|\.\/setup\.js)$/.test(file)), [], JSON.stringify(files));
    }
});

test('{preset, files} keeps the globs of files that pick a type the block has', async () => {
    // Given the typescript preset limited by globs that name file types, as an ESLint `files` list often does
    const config = await buildOxlintConfig({presets: [{preset: 'typescript', files: ['src/**/*.{js,ts}', 'lib/*.tsx', 'tests/**/*.test.js']}], reactVersion: '19.0.0'});

    // When the files of the overrides are collected
    const filesLists = new Set(config.overrides.map(override => JSON.stringify(override.files)));

    // Then each TS block keeps the TS part of them and each JS block the JS part, as ESLint's `extends` would match them
    assert.deepEqual([...filesLists].sort(), [JSON.stringify(['src/**/*.js', 'tests/**/*.test.js']), JSON.stringify(['src/**/*.ts', 'lib/*.tsx'])].sort());
});

test('{preset, files} keeps wildcard file names that end with a type the block has', async () => {
    // Given the typescript preset limited by file names with wildcards and a known extension
    const files = ['src/foo-*.ts', 'src/*.test.ts', 'src/foo-*.d.ts', 'src/foo-*.tsx', 'lib/bar-*.js'];
    const config = await buildOxlintConfig({presets: [{preset: 'typescript', files}], reactVersion: '19.0.0'});

    // When the files of the overrides are collected
    const filesLists = new Set(config.overrides.map(override => JSON.stringify(override.files)));

    // Then each TS block keeps the TS names, including `.d.ts` and `.tsx`, and each JS block the JS name
    assert.deepEqual([...filesLists].sort(), [JSON.stringify(['lib/bar-*.js']), JSON.stringify(['src/foo-*.ts', 'src/*.test.ts', 'src/foo-*.d.ts', 'src/foo-*.tsx'])].sort());
});

test('{preset, files} refuses files whose file type it cannot tell', async () => {
    // Given the typescript preset limited by globs that match TS and JS files alike
    // When the config is built, then it fails and names the glob
    await assert.rejects(buildOxlintConfig({presets: [{preset: 'typescript', files: ['src/*']}], reactVersion: '19.0.0'}), /Got src\/\*\./);
    await assert.rejects(buildOxlintConfig({presets: [{preset: 'typescript', files: ['src/**/index.*']}], reactVersion: '19.0.0'}), /Got src\/\*\*\/index\.\*\./);
    await assert.rejects(buildOxlintConfig({presets: [{preset: 'typescript', files: ['src/index.*']}], reactVersion: '19.0.0'}), /Got src\/index\.\*\./);
    await assert.rejects(buildOxlintConfig({presets: [{preset: 'typescript', files: ['src/foo*']}], reactVersion: '19.0.0'}), /Got src\/foo\*\./);
    await assert.rejects(buildOxlintConfig({presets: [{preset: 'typescript', files: ['src/*.*']}], reactVersion: '19.0.0'}), /Got src\/\*\.\*\./);
});

test('{preset, files} refuses the react preset, whose settings oxlint cannot scope to files', async () => {
    // When the react preset is limited to files, then the error names its settings instead of passing on a @oxlint/migrate warning
    await assert.rejects(
        buildOxlintConfig({presets: [{preset: 'react', files: ['src/**']}], reactVersion: '19.0.0'}),
        /The "react" preset sets react, propWrapperFunctions for all files, so it cannot be limited to files: oxlint has no per-file settings/,
    );
});

test('{preset, files} reads `**` inside a file name as `*`, as ESLint and oxlint match it', async () => {
    // Given the typescript preset limited by a file name with `**` in it, which both matchers treat as `src/*.{js,ts}`
    const config = await buildOxlintConfig({presets: [{preset: 'typescript', files: ['src/**.{js,ts}']}], reactVersion: '19.0.0'});

    // When the files of the overrides are collected
    const filesLists = new Set(config.overrides.map(override => JSON.stringify(override.files)));

    // Then the TS blocks get the TS name and the JS block the JS name
    assert.deepEqual([...filesLists].sort(), [JSON.stringify(['src/**.js']), JSON.stringify(['src/**.ts'])].sort());
});

test('{preset, files} refuses files that leave the preset nothing to lint', async () => {
    // Given the typescript preset limited to a file that none of its blocks is for
    // When the config is built, then it fails instead of building a config without the preset
    await assert.rejects(buildOxlintConfig({presets: [{preset: 'typescript', files: ['README.md']}], reactVersion: '19.0.0'}), /"typescript" preset applies to none of README\.md/);
});

test('a re-scoped typescript preset still gets the TypeScript no-unused-vars option', async () => {
    // Given the typescript preset limited to a folder
    // When the config is built
    const config = await buildOxlintConfig({presets: [{preset: 'typescript', files: ['src/**']}], reactVersion: '19.0.0'});

    // Then the no-unused-vars entry that wins reports variables only used as types, as typescript-eslint's rule does
    const rule = config.overrides.map(override => override.rules?.['no-unused-vars']).findLast(Boolean);
    assert.equal(rule?.[1]?.reportVarsOnlyUsedAsTypes, true, JSON.stringify(rule));
});

test('rules renamed by transformRule keep the order checks of other rules', async () => {
    // Given a preset where a rule is set for TypeScript files, then for all files
    const rename = (ruleID, entry) => (ruleID === 'react-hooks/immutability' ? ['rc/immutability', entry] : undefined);
    const scopedThenUnscoped = [
        {files: ['**/*.ts'], rules: {'react-hooks/immutability': 'error'}},
        {rules: {'react-hooks/immutability': 'off'}},
    ];

    // When it is converted, then the clash is refused as for any other rule
    await assert.rejects(convertPresets(scopedThenUnscoped, {transformRule: rename}), /unscoped preset block after a scoped one sets rc\/immutability/);

    // Given a preset that sets options for all files, then only a severity for some
    const optionsThenSeverity = [
        {rules: {'react-hooks/immutability': ['error', {strict: true}]}},
        {files: ['**/*.ts'], rules: {'react-hooks/immutability': 'warn'}},
    ];

    // When it is converted
    const {config} = await convertPresets(optionsThenSeverity, {transformRule: rename});

    // Then the later block keeps the options of the earlier one, as in ESLint
    assert.deepEqual(config.rules['rc/immutability'], ['error', {strict: true}]);
    assert.deepEqual(config.overrides.find(override => override.rules['rc/immutability']).rules['rc/immutability'], ['warn', {strict: true}]);
});

test('hostRule hosts a rule of a plugin the package does not list, and eslint-disable comments with its ESLint ID hide its reports', async () => {
    // Given a plugin the package does not list, with a rule that reports on the program node
    const rule = {meta: {}, create: context => ({Program: node => context.report({node, message: 'reported'})})};
    const reportsOf = (hostedRule) => {
        const reports = [];
        const comment = {type: 'Line', value: ' eslint-disable-next-line storybook/default-exports', loc: {start: {line: 1, column: 0}, end: {line: 1, column: 50}}};
        const context = {filename: 'hosted-rule.js', sourceCode: {getAllComments: () => [comment]}, report: report => reports.push(report)};
        hostedRule.create(context).Program({loc: {start: {line: 2, column: 0}, end: {line: 2, column: 5}}});
        return reports;
    };

    // When one of its rules is hosted
    const hosted = hostRule('storybook/default-exports', {'default-exports': rule});

    // Then the comment that names the ESLint ID hides the report, which the raw rule does not do
    assert.equal(reportsOf(rule).length, 1);
    assert.equal(reportsOf(hosted).length, 0);

    // And a missing rule is named in the error
    assert.throws(() => hostRule('storybook/missing', {'default-exports': rule}), /no rule named "missing"/);
});

test('the hosted import parser returns visitorKeys, so eslint-plugin-import caches each module it parses', async () => {
    // Given a hosted import rule that only hands out the parser it was given
    const require = createRequire(import.meta.url);
    let parser;
    hostRule('import/named', {named: {create: (context) => { parser = context.languageOptions.parser; return {}; }}}).create({settings: {}, languageOptions: {}});
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'expensify-oxlint-import-'));
    fs.writeFileSync(path.join(directory, 'shared.js'), 'export const shared = 1;\n');
    let parseCalls = 0;
    const countingParser = {parseForESLint: (...args) => { parseCalls++; return parser.parseForESLint(...args); }};
    const context = {settings: {}, languageOptions: {parser: countingParser}, filename: path.join(directory, 'index.js')};
    const ExportMap = require('eslint-plugin-import/lib/exportMap/builder').default;

    try {
        // When the same imported module is looked up three times
        const lookups = [ExportMap.get('./shared.js', context), ExportMap.get('./shared.js', context), ExportMap.get('./shared.js', context)];

        // Then each lookup reads its exports, and the module is parsed once
        assert.deepEqual(lookups.map(exportMap => [...exportMap.namespace.keys()]), [['shared'], ['shared'], ['shared']]);
        assert.equal(parseCalls, 1);
        assert.deepEqual(parser.parseForESLint('export const a = 1;', {filePath: 'a.js'}).visitorKeys, require('oxc-parser').visitorKeys);
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }
});

test('repo options are merged after the presets', async () => {
    // Given the react preset and a repo that sets every option it can add
    const own = {name: 'mine', specifier: '/repo/mine.mjs'};
    const override = {files: ['**/*.ts'], rules: {eqeqeq: 'off'}};

    // When the config is built, next to one built without the repo's options
    const presets = ['browser', 'react'];
    const base = await buildOxlintConfig({presets, reactVersion: '19.0.0'});
    const config = await buildOxlintConfig({
        presets,
        reactVersion: '19.0.0',
        ignorePatterns: ['dist/**'],
        env: {myEnv: true},
        globals: {MY_GLOBAL: 'readonly'},
        settings: {react: {linkComponents: ['Link']}, mine: {a: 1}},
        jsPlugins: [own],
        overrides: [override],
    });

    // Then the repo's parts come after the presets', and settings merge key by key instead of replacing the preset's
    assert.deepEqual(config.ignorePatterns, [...base.ignorePatterns, 'dist/**']);
    assert.deepEqual(config.env, {...base.env, myEnv: true});
    assert.deepEqual(config.globals, {...base.globals, MY_GLOBAL: 'readonly'});
    assert.deepEqual(config.settings, {...base.settings, react: {...base.settings.react, linkComponents: ['Link']}, mine: {a: 1}});
    assert.equal(config.settings.react.version, '19.0.0');
    assert.deepEqual(config.jsPlugins, [...base.jsPlugins, own]);
    assert.deepEqual(config.overrides, [...base.overrides, override]);
});

test('a rules.json that lacks a rule the conversion needs fails with the build:oxlint hint', async () => {
    // Given a rule written under a core/ name that generated/rules.json does not list, like a stale file would be
    const transformRule = ruleID => (ruleID === 'no-console' ? ['core/not-in-rules-json', 'error'] : undefined);

    // When the config is built, then it fails and says how to refresh the file
    await assert.rejects(buildOxlintConfig({presets: ['browser'], transformRule}), /core\/not-in-rules-json, which generated\/rules.json does not list\. Run npm run build:oxlint/);
});

test('buildOxlintConfig rejects unknown options', async () => {
    await assert.rejects(buildOxlintConfig({presets: ['react'], reactVersion: '19.0.0', ignorePattern: []}), /does not know the option ignorePattern/);
});

test('with withNursery, the names of the rules oxlint runs itself are accepted, and without it they are refused', async () => {
    // Given an override that sets nursery rules by their ESLint names
    const build = (rule, withNursery) => buildOxlintConfig({presets: ['browser'], withNursery, overrides: [{files: ['**/*.js'], rules: {[rule]: 'off'}}]});

    // When the config is built without nursery rules, then the rule runs as core/ and the name is refused
    await assert.rejects(build('no-undef', false), /runs as "core\/no-undef"/);

    // And with nursery rules oxlint runs it itself, so its own name is accepted
    await build('no-undef', true);
    await build('import/named', true);
});

test('re-scoping the browser and node presets builds', async () => {
    // Given presets limited to some files, which changes which rules oxlint skips
    // When the config is built, then it does not ask for npm run build:oxlint
    const browser = await buildOxlintConfig({presets: [{preset: 'browser', files: ['src/**']}], reactVersion: '19.0.0'});
    const node = await buildOxlintConfig({presets: [{preset: 'node', files: ['scripts/**']}], reactVersion: '19.0.0'});

    // And every setting is limited to the files
    for (const [config, folder] of [[browser, 'src/'], [node, 'scripts/']]) {
        assert.ok(config.overrides.length > 0);
        assert.deepEqual(config.overrides.flatMap(override => override.files).filter(file => !file.startsWith(folder)), []);
    }
});

test('extraRunningNames cannot hold core/ names', async () => {
    // Given a repo that lists a core/ rule as its own
    // When the config is built, then it is refused, because the core plugin cannot be replaced
    await assert.rejects(buildOxlintConfig({presets: ['browser'], extraRunningNames: ['core/my-rule']}), /extraRunningNames has core\/my-rule/);
    await assert.rejects(buildOxlintConfig({presets: ['browser'], extraRunningNames: ['core/']}), /extraRunningNames has core\//);
});

test('rules renamed by transformRule still get the option fixes oxlint needs', async () => {
    // Given a preset rule that oxlint's version takes no options for, kept under its own name by transformRule
    const keep = (ruleID, entry) => (ruleID === 'react/jsx-no-undef' ? [ruleID, entry] : undefined);
    const options = ['error', {allowGlobals: true}];

    // When it is converted for all files and for some
    const {config} = await convertPresets([{rules: {'react/jsx-no-undef': options}}, {files: ['**/*.ts'], rules: {'react/jsx-no-undef': options}}], {transformRule: keep});

    // Then oxlint gets the severity only, in the root and in the override
    assert.equal(config.rules['react/jsx-no-undef'], 'error');
    assert.equal(config.overrides.find(override => override.rules['react/jsx-no-undef']).rules['react/jsx-no-undef'], 'error');
});

test('preset entries are checked', async () => {
    await assert.rejects(buildOxlintConfig({presets: [{name: 'jest'}]}), /name or \{preset, files\}/);
    await assert.rejects(buildOxlintConfig({presets: [{preset: 'jest', files: 'tests/**'}]}), /files of the "jest" preset must be a non-empty array of strings/);
    await assert.rejects(buildOxlintConfig({presets: [{preset: 'jest', files: []}]}), /non-empty array of strings/);
    await assert.rejects(buildOxlintConfig({presets: [{preset: 'jest', files: [1]}]}), /non-empty array of strings/);

    // And an unknown name lists the valid ones
    await assert.rejects(buildOxlintConfig({presets: ['reakt']}), /Unknown preset "reakt"\. Use one of: browser, .*react.*prettier/);
});

test('the rulesdir plugin leaves out the rules that need type information', async () => {
    // Given the rules of eslint-plugin-expensify that ask for TypeScript parser services, which oxlint JS plugins lack
    const directory = fileURLToPath(new URL('../../eslint-plugin-expensify/', import.meta.url));
    const needTypes = fs.readdirSync(directory)
        .filter(file => file.endsWith('.js') && fs.readFileSync(path.join(directory, file), 'utf8').includes('getParserServices'))
        .map(file => file.slice(0, -3));

    // When the plugin is loaded
    const {rules} = await import('../plugins/rulesdir.js');

    // Then those rules are not in it, because they would throw on every file, and the others are
    assert.ok(needTypes.length >= 3, needTypes.join(', '));
    assert.deepEqual(needTypes.filter(name => name in rules), []);
    assert.ok('no-inline-named-export' in rules);
});

test('the core and hosted plugins load only when the config uses one of their rules', async () => {
    // Given presets that turn off every rule that runs from ESLint's code
    const pluginNames = config => config.jsPlugins.map(plugin => plugin.name);
    const prettierOnly = await buildOxlintConfig({presets: ['prettier']});

    // When a repo adds a core/ rule, or a hosted/ rule next to its own hosted plugin
    const withCore = await buildOxlintConfig({presets: ['prettier'], overrides: [{files: ['**/*.js'], rules: {'core/no-restricted-syntax': 'error'}}]});
    const withHosted = await buildOxlintConfig({
        presets: ['prettier'], plugins: {hosted: '/repo/hosted.js'}, overrides: [{files: ['**/*.js'], rules: {'hosted/exhaustive-deps': 'error'}}],
    });

    // Then each plugin is there only for the rules that use it
    assert.deepEqual(pluginNames(prettierOnly).filter(name => ['core', 'hosted'].includes(name)), []);
    assert.deepEqual(pluginNames(withCore).filter(name => ['core', 'hosted'].includes(name)), ['core']);
    assert.deepEqual(withHosted.jsPlugins.filter(plugin => ['core', 'hosted'].includes(plugin.name)), [{name: 'hosted', specifier: '/repo/hosted.js'}]);
});

test('a plugin whose rules are only turned off is not loaded, and those off entries are dropped', async () => {
    // Given presets that only turn rulesdir rules off (no expensify preset), and a repo that only turns a core/ rule off
    const rulesdirOff = await buildOxlintConfig({presets: ['browser', 'typescript']});
    const coreOff = await buildOxlintConfig({presets: ['prettier'], overrides: [{files: ['**/*.js'], rules: {'core/no-restricted-syntax': 'off'}}]});

    // When the rule names of each built config are collected
    const ruleNames = config => [config.rules, ...config.overrides.map(override => override.rules ?? {})].flatMap(rules => Object.keys(rules));

    // Then the plugin is not loaded and no rule names it, since oxlint rejects a rule whose plugin is missing
    assert.deepEqual(rulesdirOff.jsPlugins.filter(plugin => plugin.name === 'rulesdir'), []);
    assert.deepEqual(ruleNames(rulesdirOff).filter(rule => rule.startsWith('rulesdir/')), []);
    assert.deepEqual(coreOff.jsPlugins.filter(plugin => plugin.name === 'core'), []);
    assert.deepEqual(ruleNames(coreOff).filter(rule => rule.startsWith('core/')), []);
});

test('toEslintRuleID maps oxlint names back to ESLint rule IDs', () => {
    assert.equal(toEslintRuleID('typescript(no-explicit-any)'), '@typescript-eslint/no-explicit-any');
    assert.equal(toEslintRuleID('hosted(prefer-default-export)'), 'import/prefer-default-export');
    assert.equal(toEslintRuleID('hosted(exhaustive-deps)'), 'react-hooks/exhaustive-deps');
    assert.equal(toEslintRuleID('core(dot-notation)'), 'dot-notation');
    assert.equal(toEslintRuleID('core(no-new-object)'), 'no-new-object');
    assert.equal(toEslintRuleID('jsx_a11y(alt-text)'), 'jsx-a11y/alt-text');
    assert.equal(toEslintRuleID('rc(immutability)', {pluginPrefixes: {rc: 'react-hooks'}}), 'react-hooks/immutability');
    assert.equal(toEslintRuleID('hosted(require-jsdoc)', {hostedRules: {'require-jsdoc': 'jsdoc/require-jsdoc'}}), 'jsdoc/require-jsdoc');
    assert.throws(() => toEslintRuleID('hosted(unknown-rule)'), /no ESLint ID/);
});

test('toEslintRuleID maps the eslint-plugin-react-hooks rules oxlint runs in its react plugin to react-hooks/', () => {
    assert.equal(toEslintRuleID('react(rules-of-hooks)'), 'react-hooks/rules-of-hooks');
    assert.equal(toEslintRuleID('react(exhaustive-deps)'), 'react-hooks/exhaustive-deps');
    assert.equal(toEslintRuleID('react(immutability)'), 'react-hooks/immutability');
    assert.equal(toEslintRuleID('react(set-state-in-effect)'), 'react-hooks/set-state-in-effect');
    assert.equal(toEslintRuleID('react(jsx-key)'), 'react/jsx-key');
    assert.equal(toEslintRuleID('hosted(exhaustive-deps)'), 'react-hooks/exhaustive-deps');
    assert.equal(toEslintRuleID('rc(immutability)', {pluginPrefixes: {rc: 'react-hooks'}}), 'react-hooks/immutability');
});

test('a preset that sets an import/* setting for some files only fails, unless the merge is known to be safe', () => {
    // Given preset blocks with import/* settings, for all files and for some files only
    const forAll = {settings: {'import/internal-regex': '^@app/'}};
    const forTypeScript = settings => ({files: ['**/*.ts'], settings});

    // When they are checked, then a setting for all files, the known-safe external-module-folders and the dropped
    // import/parsers pass
    checkScopedImportSettings('fake', [forAll, forTypeScript({'import/external-module-folders': ['node_modules', 'node_modules/@types']})]);
    checkScopedImportSettings('fake', [forTypeScript({'import/parsers': {'@typescript-eslint/parser': ['.ts']}})]);

    // And any other import/* setting for some files fails, because oxlint would apply it to every file
    assert.throws(() => checkScopedImportSettings('fake', [forAll, forTypeScript({'import/internal-regex': '^@ts/'})]), /"fake" preset sets import\/internal-regex for \*\*\/\*\.ts only/);
});

test('getPresetRuleEntry returns a copy of the setting a preset gives a rule, for an override to extend', async () => {
    // Given a rule the typescript preset turns on for TS files and off for JS files, one the browser preset sets, and one
    // the browser preset sets in two blocks (`multi-line`, then `all`)
    // When their settings are read
    const namingConvention = await getPresetRuleEntry('typescript', '@typescript-eslint/naming-convention');
    const noConsole = await getPresetRuleEntry('browser', 'no-console');
    const curly = await getPresetRuleEntry('browser', 'curly');

    // Then they come back as [severity, ...options], merged over the blocks as ESLint does, so the later block wins
    assert.equal(namingConvention[0], 'error');
    assert.ok(namingConvention.slice(1).every(option => option.selector), JSON.stringify(namingConvention));
    assert.deepEqual(noConsole, ['error', {allow: ['debug', 'error']}]);
    assert.deepEqual(curly, ['error', 'all']);

    // And changing the result leaves the preset as it was
    namingConvention.push({selector: 'objectLiteralProperty', format: null});
    assert.equal((await getPresetRuleEntry('typescript', '@typescript-eslint/naming-convention')).length, namingConvention.length - 1);

    // And a rule the preset does not turn on fails with its name
    await assert.rejects(getPresetRuleEntry('typescript', 'not-a-rule'), /"typescript" preset does not turn on not-a-rule/);
});

test('mergeRuleEntries merges the settings of one rule over blocks as ESLint does', () => {
    // Given settings of one rule in block order (no preset has a severity-only setting after one with options)
    const options = {allow: ['debug']};

    // When they are merged, then a later severity-only setting keeps the earlier options, also across an `off` one
    assert.deepEqual(mergeRuleEntries(['error', ['warn', options], 'error']), ['error', options]);
    assert.deepEqual(mergeRuleEntries([['error', options], 'off', undefined, 1]), [1, options]);

    // And a later setting with options replaces the earlier ones
    assert.deepEqual(mergeRuleEntries([['error', options], ['warn', 'all']]), ['warn', 'all']);

    // And settings that never turn the rule on give undefined
    assert.equal(mergeRuleEntries([['off', options], 0, undefined]), undefined);
    assert.equal(mergeRuleEntries([]), undefined);
});
