/* eslint-disable rulesdir/prefer-underscore-method -- Node-only tooling, so modern syntax and native array methods are fine */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';

import {splitRuleID} from '../hosting.js';
import {ruleMapsOf} from '../rule-entry.js';
import {checkScopedImportSettings} from '../presets.js';
import {
    buildOxlintConfig, getPresetRuleEntry, reactCompilerRuleNames, toEslintRuleID,
} from '../index.js';
import {
    createFixtureProject, getOxlintEnvironment, packageDirectory, runOxlint,
} from './helpers.mjs';

const oxlintBinary = `${packageDirectory}node_modules/.bin/oxlint`;

/**
 * @param {import('oxlint').OxlintConfig} config
 * @param {string} name a rule name as written in the config, like `hosted/exhaustive-deps`
 * @returns {boolean} whether the root or any override sets the rule
 */
const hasRule = (config, name) => ruleMapsOf(config).some(rules => name in rules);

test('nativeRules runs an always-hosted rule with oxlint\'s version, and rejects other IDs', async () => {
    const presets = ['react'];
    const reactVersion = '19.0.0';
    const optionsOf = (config, name) => ruleMapsOf(config).map(rules => rules[name]).find(Boolean);

    const hosted = await buildOxlintConfig({presets, reactVersion});
    const native = await buildOxlintConfig({presets, reactVersion, nativeRules: ['react-hooks/exhaustive-deps']});

    assert.ok(hasRule(hosted, 'hosted/exhaustive-deps') && !hasRule(hosted, 'react/exhaustive-deps'));
    assert.ok(hasRule(native, 'react/exhaustive-deps') && !hasRule(native, 'hosted/exhaustive-deps'));
    assert.deepEqual(optionsOf(native, 'react/exhaustive-deps'), optionsOf(hosted, 'hosted/exhaustive-deps'));

    await assert.rejects(buildOxlintConfig({presets, reactVersion, nativeRules: ['no-console']}), /nativeRules has no-console/);
});

/**
 * @param {string} ruleID
 * @param {unknown} entry
 * @returns {[string, unknown] | undefined} the React Compiler rules under an `rc/` name, and no change for the others
 */
function renameCompilerRules(ruleID, entry) {
    const {prefix, name} = splitRuleID(ruleID);
    return prefix === 'react-hooks' && reactCompilerRuleNames.includes(name) ? [`rc/${name}`, entry] : undefined;
}

test('an override that names a rule differently from how it runs is refused', async () => {
    const build = (rule, options) => buildOxlintConfig({
        presets: ['react'], reactVersion: '19.0.0', overrides: [{files: ['**/*.js'], rules: {[rule]: 'off'}}], ...options,
    });
    const rename = {transformRule: renameCompilerRules, extraRunningNames: ['rc/']};
    const nativeRules = ['react-hooks/exhaustive-deps'];

    // A replayed hosted rule, a rule transformRule renamed, and rules that only rules.json lists (hosted, then core) are refused by their ESLint name
    await assert.rejects(build('react/exhaustive-deps'), /runs as "hosted\/exhaustive-deps"/);
    await assert.rejects(build('react-hooks/set-state-in-effect', rename), /runs as "rc\/set-state-in-effect"/);
    await assert.rejects(build('jsdoc/check-types'), /runs as "hosted\/check-types"/);
    await assert.rejects(build('no-restricted-syntax'), /runs as "core\/no-restricted-syntax"/);

    // Rules oxlint runs itself keep oxlint's name: those in nativeRules, import/export, and the nursery rules with withNursery
    await build('react/exhaustive-deps', {nativeRules});
    await assert.rejects(build('hosted/exhaustive-deps', {nativeRules}), /runs as "react\/exhaustive-deps"/);
    await assert.rejects(build('hosted/export'), /runs as "import\/export"/);
    await build('no-undef', {presets: ['browser'], withNursery: true});

    // A hosted rule that rules.json lacks is refused, unless extraRunningNames lets the repo's own plugin provide it
    await assert.rejects(build('hosted/not-a-rule'), /npm run build:oxlint/);
    await build('hosted/not-a-rule', {extraRunningNames: ['hosted/']});

    // oxlint would refuse to load a config that sets a rule the conversion drops or replaces
    await assert.rejects(build('no-invalid-this'), /this rule is dropped/);
    await assert.rejects(build('rulesdir/prefer-at'), /runs as "unicorn\/prefer-at"/);
});

test('transformRule can rename or drop a rule', async () => {
    const transformRule = (ruleID, entry) => (ruleID === 'no-console' ? null : renameCompilerRules(ruleID, entry));

    const config = await buildOxlintConfig({presets: ['browser', 'react'], transformRule, reactVersion: '19.0.0'});

    assert.ok(hasRule(config, 'rc/immutability'));
    assert.ok(!hasRule(config, 'no-console'));
});

test('plugins replaces the plugin file of this package\'s hosted plugin', async () => {
    const config = await buildOxlintConfig({presets: ['browser'], plugins: {hosted: '/repo/hosted.js'}, reactVersion: '19.0.0'});

    assert.deepEqual(config.jsPlugins.filter(plugin => plugin.name === 'hosted'), [{name: 'hosted', specifier: '/repo/hosted.js'}]);
});

test('a repo can switch on hosted/no-unresolved, which no preset enables', async () => {
    const config = await buildOxlintConfig({
        presets: ['browser', 'typescript'],
        reactVersion: '19.0.0',
        overrides: [{files: ['**/*.ts'], rules: {'hosted/no-unresolved': 'error'}}],
    });

    assert.ok(config.jsPlugins.some(plugin => plugin.name === 'hosted'));
});

test('the React version comes from reactVersion or settings.react.version, and `detect` counts as none', async () => {
    // oxlint refuses the 'detect' that ESLint allows as react.version
    const settings = {react: {version: 'detect', pragma: 'React'}};

    const withVersion = await buildOxlintConfig({presets: ['react'], reactVersion: '19.0.0', settings});

    assert.equal(withVersion.settings.react.version, '19.0.0');
    assert.equal(withVersion.settings.react.pragma, 'React');
    assert.equal((await buildOxlintConfig({presets: ['react'], settings: {react: {version: '18.2.0'}}})).settings.react.version, '18.2.0');

    // Presets without react do not get 'detect' either
    assert.equal(JSON.stringify((await buildOxlintConfig({presets: ['browser'], settings})).settings).includes('detect'), false);
});

test('{preset, files} runs a preset for locations on those files only, in oxlint', async () => {
    const config = await buildOxlintConfig({presets: ['browser', {preset: 'jest', files: ['unit/**']}], reactVersion: '19.0.0'});

    // The jest preset turns no-console off, and the browser preset turns it on. A *.test.js outside the folder is not a jest file anymore.
    const code = 'console.log(1);\n';
    const directory = createFixtureProject(JSON.stringify(config), {'unit/in.js': code, 'other/out.js': code, 'other/out.test.js': code});
    try {
        const {diagnostics, stderr} = runOxlint(directory, oxlintBinary, getOxlintEnvironment());
        const found = diagnostics
            .filter(diagnostic => diagnostic.code === 'eslint(no-console)')
            .map(diagnostic => `${diagnostic.filename} ${diagnostic.code}`)
            .sort();

        assert.ok(diagnostics.length > 0, `oxlint did not load the config: ${stderr}`);
        assert.deepEqual(found, ['other/out.js eslint(no-console)', 'other/out.test.js eslint(no-console)']);
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }
});

test('{preset, files} refuses a preset for file types, and react whose settings oxlint cannot scope', async () => {
    const build = preset => buildOxlintConfig({presets: [preset], reactVersion: '19.0.0'});

    await assert.rejects(build({preset: 'typescript', files: ['src/**']}), /"typescript" preset is for file types \(\*\*\/\*\.ts\), so it cannot be limited to files/);
    await assert.rejects(build({preset: 'react', files: ['src/**']}), /oxlint has no per-file settings/);
});

test('repo options are merged after the presets', async () => {
    const own = {name: 'mine', specifier: '/repo/mine.mjs'};
    const override = {files: ['**/*.ts'], rules: {eqeqeq: 'off'}};

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

    assert.deepEqual([config.ignorePatterns.includes('dist/**'), config.env.myEnv, config.globals.MY_GLOBAL], [true, true, 'readonly']);
    assert.deepEqual(config.settings, {...base.settings, react: {...base.settings.react, linkComponents: ['Link']}, mine: {a: 1}});
    assert.deepEqual(config.jsPlugins, [...base.jsPlugins, own]);
    assert.deepEqual(config.overrides, [...base.overrides, override]);
});

test('a mistyped option, a core/ name in extraRunningNames or an unknown preset is rejected', async () => {
    await assert.rejects(buildOxlintConfig({presets: ['react'], reactVersion: '19.0.0', ignorePattern: []}), /does not know the option ignorePattern/);
    await assert.rejects(buildOxlintConfig({presets: ['browser'], extraRunningNames: ['core/my-rule']}), /extraRunningNames has core\/my-rule/);
    await assert.rejects(buildOxlintConfig({presets: ['reakt']}), /Unknown preset "reakt"/);
});

test('a plugin is loaded only when a rule that is on uses it', async () => {
    const pluginNames = config => config.jsPlugins.map(plugin => plugin.name).filter(name => ['rulesdir', 'core', 'hosted'].includes(name));
    const coreOverride = {files: ['**/*.js'], rules: {'core/no-restricted-syntax': 'error'}};

    assert.equal(pluginNames(await buildOxlintConfig({presets: ['browser', 'typescript']})).includes('rulesdir'), false);
    assert.deepEqual(pluginNames(await buildOxlintConfig({presets: ['prettier'], overrides: [coreOverride]})), ['core']);
});

test('toEslintRuleID maps oxlint names back to ESLint rule IDs', () => {
    assert.equal(toEslintRuleID('typescript(no-explicit-any)'), '@typescript-eslint/no-explicit-any');
    assert.equal(toEslintRuleID('hosted(prefer-default-export)'), 'import/prefer-default-export');
    assert.equal(toEslintRuleID('hosted(exhaustive-deps)'), 'react-hooks/exhaustive-deps');
    assert.equal(toEslintRuleID('core(dot-notation)'), 'dot-notation');
    assert.equal(toEslintRuleID('jsx_a11y(alt-text)'), 'jsx-a11y/alt-text');
    assert.equal(toEslintRuleID('react(rules-of-hooks)'), 'react-hooks/rules-of-hooks');
    assert.equal(toEslintRuleID('react(immutability)'), 'react-hooks/immutability');
    assert.equal(toEslintRuleID('react(jsx-key)'), 'react/jsx-key');
    assert.equal(toEslintRuleID('rc(immutability)', {pluginPrefixes: {rc: 'react-hooks'}}), 'react-hooks/immutability');
    assert.equal(toEslintRuleID('hosted(require-jsdoc)', {hostedRules: {'require-jsdoc': 'jsdoc/require-jsdoc'}}), 'jsdoc/require-jsdoc');
    assert.throws(() => toEslintRuleID('hosted(unknown-rule)'), /no ESLint ID/);
});

test('getPresetRuleEntry returns the setting a preset gives a rule, merged over its blocks, for an override to extend', async () => {
    // naming-convention is on for TS files and off for JS files, and curly is set in two blocks (`multi-line`, then `all`) where the later one wins
    const namingConvention = await getPresetRuleEntry('typescript', '@typescript-eslint/naming-convention');
    const noConsole = await getPresetRuleEntry('browser', 'no-console');
    const curly = await getPresetRuleEntry('browser', 'curly');

    assert.equal(namingConvention[0], 'error');
    assert.ok(namingConvention.slice(1).every(option => option.selector), JSON.stringify(namingConvention));
    assert.deepEqual(noConsole, ['error', {allow: ['debug', 'error']}]);
    assert.deepEqual(curly, ['error', 'all']);

    await assert.rejects(getPresetRuleEntry('typescript', 'not-a-rule'), /"typescript" preset does not turn on not-a-rule/);
});

test('a preset that sets an import/* setting for some files only fails, unless the merge is known to be safe', () => {
    const forAll = {settings: {'import/internal-regex': '^@app/'}};
    const forTypeScript = settings => ({files: ['**/*.ts'], settings});

    // A setting for all files, the known-safe external-module-folders and import/parsers, which oxlint does not have, pass
    checkScopedImportSettings('fake', [forAll, forTypeScript({'import/external-module-folders': ['node_modules', 'node_modules/@types']})]);
    checkScopedImportSettings('fake', [forTypeScript({'import/parsers': {'@typescript-eslint/parser': ['.ts']}})]);

    // Any other import/* setting for some files fails, because oxlint would apply it to every file
    assert.throws(() => checkScopedImportSettings('fake', [forAll, forTypeScript({'import/internal-regex': '^@ts/'})]), /"fake" preset sets import\/internal-regex for \*\*\/\*\.ts only/);
});
