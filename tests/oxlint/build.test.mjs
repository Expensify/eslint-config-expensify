import assert from 'node:assert/strict';
import {test} from 'node:test';

import {convertPresets, reactCompilerRuleNames} from '../../oxlint/convert.mjs';
import {buildOxlintConfig, toEslintRuleID} from '../../oxlint/index.mjs';

const rulesOf = config => [config.rules, ...config.overrides.map(override => override.rules)];
const hasRule = (config, name) => rulesOf(config).some(rules => rules && name in rules);

test('React Compiler rules are dropped by default, and rules-of-hooks stays', async () => {
    // Given the react preset, which turns on React Compiler rules
    // When the config is built without a transformRule
    const config = await buildOxlintConfig({presets: ['react'], reactVersion: '19.0.0'});

    // Then no compiler rule is left, but the classic hooks rules run
    assert.ok(reactCompilerRuleNames.length > 10);
    assert.ok(reactCompilerRuleNames.every(name => !hasRule(config, `react/${name}`) && !hasRule(config, `react-hooks/${name}`)));
    assert.ok(hasRule(config, 'react/rules-of-hooks'));
    assert.ok(hasRule(config, 'hosted/exhaustive-deps'));
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
