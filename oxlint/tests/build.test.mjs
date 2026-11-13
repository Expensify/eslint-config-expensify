/* eslint-disable rulesdir/prefer-underscore-method -- Node-only tooling, so modern syntax and native array methods are fine */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

import {convertPresets} from '../convert.js';
import {splitRuleID} from '../hosting.js';
import {mergeRuleEntries, ruleMapsOf} from '../rule-entry.js';
import {checkScopedImportSettings} from '../presets.js';
import {
    buildOxlintConfig, getPresetRuleEntry, hostRule, reactCompilerRuleNames, toEslintRuleID,
} from '../index.js';
import {
    createFixtureProject, getOxlintEnvironment, packageDirectory, runOxlint,
} from './helpers.mjs';

const oxlintBinary = `${packageDirectory}node_modules/.bin/oxlint`;

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

    // And an ID that is not always hosted throws
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

test('an override names a rule as it runs: hosted and core rules by their plugin name, native rules by their own', async () => {
    // Given overrides that set one rule off, built with the options a case needs
    const build = (rule, options) => buildOxlintConfig({
        presets: ['react'], reactVersion: '19.0.0', overrides: [{files: ['**/*.js'], rules: {[rule]: 'off'}}], ...options,
    });

    // When the oxlint or ESLint name of a rule that runs hosted or core is used, then it fails with the name to use
    await assert.rejects(build('react/exhaustive-deps'), /runs as "hosted\/exhaustive-deps"/);
    await assert.rejects(build('jsdoc/check-types'), /runs as "hosted\/check-types"/);
    await assert.rejects(build('no-restricted-syntax'), /runs as "core\/no-restricted-syntax"/);

    // And a hosted name no plugin has fails, unless the repo's own plugin provides it
    await assert.rejects(build('hosted/not-a-rule'), /npm run build:oxlint/);
    await build('hosted/not-a-rule', {extraRunningNames: ['hosted/']});

    // And with nativeRules the native name passes and the hosted one is refused
    const nativeRules = ['react-hooks/exhaustive-deps'];
    await build('react/exhaustive-deps', {nativeRules});
    await assert.rejects(build('hosted/exhaustive-deps', {nativeRules}), /runs as "react\/exhaustive-deps"/);

    // And import/export, which oxlint runs itself, is named as oxlint does, and with withNursery so are the nursery rules
    await build('import/export', {presets: ['browser']});
    await assert.rejects(build('hosted/export', {presets: ['browser']}), /runs as "import\/export"/);
    await build('no-undef', {presets: ['browser'], withNursery: true});
    await assert.rejects(build('no-undef', {presets: ['browser']}), /runs as "core\/no-undef"/);
});

test('an override that names a dropped rule or a stand-in rule is rejected', async () => {
    // Given overrides that name rules the conversion drops or replaces, which oxlint would refuse to load
    const build = rule => buildOxlintConfig({presets: ['react'], reactVersion: '19.0.0', overrides: [{files: ['**/*.js'], rules: {[rule]: 'off'}}]});

    // When the config is built, then each one fails and says why
    await assert.rejects(build('no-invalid-this'), /"no-invalid-this", but this rule is dropped/);
    await assert.rejects(build('rulesdir/prefer-at'), /"rulesdir\/prefer-at", but this rule runs as "unicorn\/prefer-at"/);

    // And the name a stand-in runs as, and a rule that is neither dropped nor replaced, still pass
    await build('unicorn/prefer-at');
    await build('rulesdir/no-negated-variables');
});

test('an override that names a rule transformRule renamed is rejected, and the new name works', async () => {
    // Given the React Compiler rules renamed to `rc/`, which the repo's own plugin provides
    const build = rule => buildOxlintConfig({
        presets: ['react'], reactVersion: '19.0.0', transformRule: renameCompilerRules, extraRunningNames: ['rc/'], overrides: [{files: ['**/*.js'], rules: {[rule]: 'off'}}],
    });

    // When an override names the rule by an ESLint name, then it fails with the name the rule runs as
    await assert.rejects(build('react-hooks/set-state-in-effect'), /runs as "rc\/set-state-in-effect"/);
    await assert.rejects(build('react/set-state-in-effect'), /runs as "rc\/set-state-in-effect"/);

    // And the new name works
    await build('rc/set-state-in-effect');
});

test('transformRule can rename or drop a rule', async () => {
    // Given a transformRule that sends compiler rules to `rc/` and drops no-console
    const transformRule = (ruleID, entry) => (ruleID === 'no-console' ? null : renameCompilerRules(ruleID, entry));

    // When the config is built
    const config = await buildOxlintConfig({presets: ['browser', 'react'], transformRule, reactVersion: '19.0.0'});

    // Then compiler rules are written under the new name and no-console is gone
    assert.ok(hasRule(config, 'rc/immutability'));
    assert.ok(!hasRule(config, 'no-console'));
});

test('plugins replaces the plugin file of this package\'s hosted plugin', async () => {
    // Given a repo with its own hosted plugin file
    // When the config is built with it as plugins.hosted
    const config = await buildOxlintConfig({presets: ['browser'], plugins: {hosted: '/repo/hosted.js'}, reactVersion: '19.0.0'});

    // Then the repo's file is the one the config lists
    assert.deepEqual(config.jsPlugins.filter(plugin => plugin.name === 'hosted'), [{name: 'hosted', specifier: '/repo/hosted.js'}]);
});

test('an unknown react-hooks rule fails the conversion', async () => {
    // Given a preset block with a react-hooks rule that is neither a compiler rule nor classic
    const blocks = [{rules: {'react-hooks/made-up-rule': 'error'}}];

    // When it is converted, then the error names the rule instead of running a rule nobody checked
    await assert.rejects(convertPresets(blocks), /react-hooks\/made-up-rule is set by a preset, but the installed eslint-plugin-react-hooks has no such rule/);
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

test('hostRule names the rule a plugin does not have', () => {
    // When a rule that the plugin lacks is hosted, then the error names it
    assert.throws(() => hostRule('storybook/missing', {'default-exports': {meta: {}, create: () => ({})}}), /no rule named "missing"/);
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

test('a rules.json that lacks a rule the conversion needs fails with the build:oxlint hint', async () => {
    // Given a rule written under a core/ name that generated/rules.json does not list, like a stale file would be
    const transformRule = ruleID => (ruleID === 'no-console' ? ['core/not-in-rules-json', 'error'] : undefined);

    // When the config is built, then it fails and says how to refresh the file
    await assert.rejects(buildOxlintConfig({presets: ['browser'], transformRule}), /core\/not-in-rules-json, which generated\/rules.json does not list\. Run npm run build:oxlint/);
});

test('the React version comes from reactVersion or settings.react.version, `detect` counts as none, and a missing one asks for reactVersion', async () => {
    // Given a repo that copied ESLint's `react.version: 'detect'`, which oxlint refuses
    const settings = {react: {version: 'detect', pragma: 'React'}};

    // When the react preset is built with a React version
    const withVersion = await buildOxlintConfig({presets: ['react'], reactVersion: '19.0.0', settings});

    // Then the version is the one given, and the other react settings stay
    assert.equal(withVersion.settings.react.version, '19.0.0');
    assert.equal(withVersion.settings.react.pragma, 'React');

    // And presets without react do not get 'detect' either
    assert.equal(JSON.stringify((await buildOxlintConfig({presets: ['browser'], settings})).settings).includes('detect'), false);

    // And where react cannot be resolved, a version in settings is used and any other way of asking for one needs reactVersion
    await inEmptyDirectory(async () => {
        const config = await buildOxlintConfig({presets: ['react'], settings: {react: {version: '18.2.0'}}});
        assert.equal(config.settings.react.version, '18.2.0');

        // buildOxlintConfig also looks for react from where this package sits, so a checkout inside a project with react
        // finds it and cannot fail here. CI checks out the package on its own.
        if (!canResolveReactFromPackage()) {
            await assert.rejects(buildOxlintConfig({presets: ['react']}), /pass `reactVersion`/);
            await assert.rejects(buildOxlintConfig({presets: ['react'], settings}), /pass `reactVersion`/);
            await buildOxlintConfig({presets: ['expensify']});
        }
    });

    // And with react installed next to this package, 'detect' reads its version
    if (canResolveReactFromPackage()) {
        const detected = await buildOxlintConfig({presets: ['react'], settings: {react: {version: 'detect'}}});
        assert.equal(detected.settings.react.version, createRequire(import.meta.url)('react/package.json').version);
    }
});

test('{preset, files} runs the preset on the files only, by file type, in oxlint', async () => {
    // Given browser and typescript limited to a folder, and typescript also to the TS files of two other places: by a name
    // with `**` in it, which ESLint and oxlint both match like `*`, and by a name with braces
    const config = await buildOxlintConfig({
        presets: [{preset: 'browser', files: ['src/**']}, {preset: 'typescript', files: ['src/**', 'lib/**.ts', 'tools/*.{js,ts}']}],
        reactVersion: '19.0.0',
    });

    // And files with code that breaks one rule of each: a console call, `any`, and a variable only used as a type
    const tsCode = 'const value = 1;\nexport type Value = typeof value;\nexport const anything: any = 1;\nconsole.log(anything);\n';
    const directory = createFixtureProject(JSON.stringify(config), Object.fromEntries(
        ['src/in.ts', 'src/in.js', 'lib/in.ts', 'lib/in.js', 'tools/in.ts', 'other/out.ts', 'other/out.js'].map(file => [file, file.endsWith('.ts') ? tsCode : 'console.log(1);\n']),
    ));
    try {
        // When oxlint lints them
        const {diagnostics, stderr} = runOxlint(directory, oxlintBinary, getOxlintEnvironment());
        const found = diagnostics
            .filter(diagnostic => /\((no-console|no-explicit-any|no-unused-vars)\)$/.test(diagnostic.code))
            .map(diagnostic => `${diagnostic.filename} ${diagnostic.code}`)
            .sort();

        // Then the rules run only in the folders, and only on the file types of each preset block
        assert.ok(diagnostics.length > 0, `oxlint did not load the config: ${stderr}`);
        assert.deepEqual(found, [
            'lib/in.ts eslint(no-unused-vars)',
            'lib/in.ts typescript(no-explicit-any)',
            'src/in.js eslint(no-console)',
            'src/in.ts eslint(no-console)',
            'src/in.ts eslint(no-unused-vars)',
            'src/in.ts typescript(no-explicit-any)',
            'tools/in.ts eslint(no-unused-vars)',
            'tools/in.ts typescript(no-explicit-any)',
        ]);
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }
});

test('{preset, files} refuses files whose file type it cannot tell', async () => {
    // Given the typescript preset limited by globs that match TS and JS files alike
    // When the config is built, then it fails and names the glob
    await assert.rejects(buildOxlintConfig({presets: [{preset: 'typescript', files: ['src/*']}], reactVersion: '19.0.0'}), /Got src\/\*\./);
    await assert.rejects(buildOxlintConfig({presets: [{preset: 'typescript', files: ['src/index.*']}], reactVersion: '19.0.0'}), /Got src\/index\.\*\./);
});

test('{preset, files} refuses the react preset, whose settings oxlint cannot scope to files', async () => {
    // When the react preset is limited to files, then the error names its settings instead of passing on a @oxlint/migrate warning
    await assert.rejects(
        buildOxlintConfig({presets: [{preset: 'react', files: ['src/**']}], reactVersion: '19.0.0'}),
        /The "react" preset sets react, propWrapperFunctions for all files, so it cannot be limited to files: oxlint has no per-file settings/,
    );
});

test('{preset, files} refuses files that leave the preset nothing to lint', async () => {
    // Given the typescript preset limited to a file that none of its blocks is for
    // When the config is built, then it fails instead of building a config without the preset
    await assert.rejects(buildOxlintConfig({presets: [{preset: 'typescript', files: ['README.md']}], reactVersion: '19.0.0'}), /"typescript" preset applies to none of README\.md/);
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

test('buildOxlintConfig rejects unknown options', async () => {
    await assert.rejects(buildOxlintConfig({presets: ['react'], reactVersion: '19.0.0', ignorePattern: []}), /does not know the option ignorePattern/);
});

test('extraRunningNames cannot hold core/ names', async () => {
    // Given a repo that lists a core/ rule as its own
    // When the config is built, then it is refused, because the core plugin cannot be replaced
    await assert.rejects(buildOxlintConfig({presets: ['browser'], extraRunningNames: ['core/my-rule']}), /extraRunningNames has core\/my-rule/);
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

test('a plugin is loaded only when a rule that is on uses it', async () => {
    // Given presets that turn rulesdir rules off, or turn only rules off, which oxlint rejects when its plugin is not loaded
    const pluginNames = config => config.jsPlugins.map(plugin => plugin.name).filter(name => ['rulesdir', 'core', 'hosted'].includes(name));

    // When the configs are built, and one with a core/ rule that the repo turns on
    const rulesdirOff = await buildOxlintConfig({presets: ['browser', 'typescript']});
    const prettierOnly = await buildOxlintConfig({presets: ['prettier']});
    const withCore = await buildOxlintConfig({presets: ['prettier'], overrides: [{files: ['**/*.js'], rules: {'core/no-restricted-syntax': 'error'}}]});

    // Then a plugin is listed only for the rules that are on and use it
    assert.equal(pluginNames(rulesdirOff).includes('rulesdir'), false);
    assert.deepEqual(pluginNames(prettierOnly), []);
    assert.deepEqual(pluginNames(withCore), ['core']);
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
