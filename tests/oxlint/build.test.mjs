import assert from 'node:assert/strict';
import os from 'node:os';
import {test} from 'node:test';

import {convertPresets} from '../../oxlint/convert.mjs';
import {
    buildOxlintConfig, hostRule, reactCompilerRuleNames, toEslintRuleID,
} from '../../oxlint/index.mjs';

const rulesOf = config => [config.rules, ...config.overrides.map(override => override.rules)];
const hasRule = (config, name) => rulesOf(config).some(rules => rules && name in rules);

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
    const optionsOf = (config, name) => rulesOf(config).map(rules => rules?.[name]).find(Boolean);

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

test('transformRule can rename or drop a rule', async () => {
    // Given a transformRule that sends compiler rules to `rc/` and drops no-console
    const transformRule = (ruleID, entry) => {
        if (ruleID.startsWith('react-hooks/') && reactCompilerRuleNames.includes(ruleID.slice('react-hooks/'.length))) {
            return [`rc/${ruleID.slice('react-hooks/'.length)}`, entry];
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

    // When it is converted, then it fails loudly instead of running a rule nobody checked
    await assert.rejects(convertPresets(blocks), /not a known React Compiler rule/);
});

test('buildOxlintConfig points at the plugin files with absolute paths, and plugins can be replaced', async () => {
    // Given a repo with its own hosted plugin
    // When the config is built
    const config = await buildOxlintConfig({presets: ['expensify'], plugins: {hosted: '/repo/hosted.mjs'}, reactVersion: '19.0.0'});

    // Then every plugin of the package has an absolute path and the repo's replaces `hosted`
    const specifiers = Object.fromEntries(config.jsPlugins.map(plugin => [plugin.name, plugin.specifier]));
    assert.equal(specifiers.hosted, '/repo/hosted.mjs');
    assert.ok(specifiers.core.startsWith('/') && specifiers.core.endsWith('oxlint/plugins/core.mjs'));
    assert.ok(specifiers.rulesdir.startsWith('/') && specifiers.rulesdir.endsWith('oxlint/plugins/rulesdir.mjs'));
});

test('overrides that use the wrong name for a hosted or core rule are rejected', async () => {
    // Given overrides that set a rule by oxlint's name while it runs hosted, core, or under a name no plugin has
    const build = (rule, extraRunningNames) => buildOxlintConfig({presets: ['react'], overrides: [{files: ['**/*.js'], rules: {[rule]: 'off'}}], extraRunningNames});

    // When the config is built, then each one fails with the name to use
    await assert.rejects(build('import/prefer-default-export'), /Use that name instead/);
    await assert.rejects(build('no-restricted-syntax'), /runs as "core\/no-restricted-syntax"/);
    await assert.rejects(build('react/exhaustive-deps'), /runs as "hosted\/exhaustive-deps"/);
    await assert.rejects(build('hosted/not-a-rule'), /npm run build:oxlint/);

    // And the repo's own rules pass when they are named in extraRunningNames
    await build('hosted/not-a-rule', ['hosted/not-a-rule']);
    await build('rc/immutability', ['rc/']);
});

test('buildOxlintConfig needs a React version when the react preset is used and react cannot be resolved', async () => {
    // Given a working directory without react in it
    const cwd = process.cwd();
    process.chdir(os.tmpdir());
    try {
        // When the react preset is built without reactVersion, then it fails clearly
        await assert.rejects(buildOxlintConfig({presets: ['react']}), /pass `reactVersion`/);

        // And presets without react do not need one
        await buildOxlintConfig({presets: ['expensify']});
    } finally {
        process.chdir(cwd);
    }
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

test('a re-scoped typescript preset still gets the TypeScript no-unused-vars option', async () => {
    // Given the typescript preset limited to a folder, which no TypeScript glob matches
    // When the config is built
    const config = await buildOxlintConfig({presets: [{preset: 'typescript', files: ['src/**']}], reactVersion: '19.0.0'});

    // Then no-unused-vars reports variables only used as types, as typescript-eslint's rule does
    const rule = config.overrides.map(override => override.rules?.['no-unused-vars']).find(Boolean);
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

test('hostRule hosts a rule of a plugin the package does not list, from the rules object it is given', async () => {
    // Given a plugin the package does not list
    const rule = {meta: {}, create: () => ({})};

    // When one of its rules is hosted
    const hosted = hostRule('storybook/default-exports', {'default-exports': rule});

    // Then the ESLint ID wrapper is applied, and a missing rule fails clearly
    assert.equal(typeof hosted.create, 'function');
    assert.throws(() => hostRule('storybook/missing', {'default-exports': rule}), /no rule named "missing"/);
});

test('buildOxlintConfig rejects unknown options and unknown presets', async () => {
    // Given a typo in an option and in a preset name
    // When the config is built, then it fails with a clear message
    await assert.rejects(buildOxlintConfig({presets: ['react'], ignorePattern: []}), /does not know the option ignorePattern/);
    await assert.rejects(buildOxlintConfig({presets: ['reakt']}), /Unknown preset "reakt"/);
});

test('toEslintRuleID maps oxlint names back to ESLint rule IDs', () => {
    // Given oxlint diagnostic codes
    // When they are mapped, then ESLint's IDs come back
    assert.equal(toEslintRuleID('typescript(no-explicit-any)'), '@typescript-eslint/no-explicit-any');
    assert.equal(toEslintRuleID('hosted(prefer-default-export)'), 'import/prefer-default-export');
    assert.equal(toEslintRuleID('hosted(exhaustive-deps)'), 'react-hooks/exhaustive-deps');
    assert.equal(toEslintRuleID('core(dot-notation)'), 'dot-notation');
    assert.equal(toEslintRuleID('eslint(no-object-constructor)'), 'no-new-object');
    assert.equal(toEslintRuleID('jsx_a11y(alt-text)'), 'jsx-a11y/alt-text');
    assert.equal(toEslintRuleID('rc(immutability)', {pluginPrefixes: {rc: 'react-hooks'}}), 'react-hooks/immutability');
    assert.equal(toEslintRuleID('hosted(require-jsdoc)', {hostedRules: {'require-jsdoc': 'jsdoc/require-jsdoc'}}), 'jsdoc/require-jsdoc');
    assert.throws(() => toEslintRuleID('hosted(unknown-rule)'), /no ESLint ID/);
});
