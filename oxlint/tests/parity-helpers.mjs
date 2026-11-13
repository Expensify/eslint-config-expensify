/* eslint-disable es/no-optional-chaining, es/no-nullish-coalescing-operators, rulesdir/prefer-underscore-method -- Node-only tooling */
/* eslint-disable no-await-in-loop -- Node-only tooling, and these loops read one file at a time */
/** Helpers for the parity test: the rules ESLint and oxlint run on a file, both as `[severity, ...options]` by rule. */
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {ESLint} from 'eslint';
import {builtinRules} from 'eslint/use-at-your-own-risk';
import prettierConfig from 'eslint-config-prettier';

import {toEslintRuleID} from '../rule-names.js';
import {EXPORTED_PRESETS, packageDirectory} from './helpers.mjs';

// Covers each file type the presets tell apart, where they scope rules, and a root file name next to the same name in a folder (oxlint matches a glob without a slash at every depth)
const SAMPLE_FILES = [
    'a.js', 'a.jsx', 'a.mjs', 'a.cjs', 'a.ts', 'a.tsx', 'a.mts', 'a.d.ts',
    'a.test.js', 'a.test.ts', 'tests/x.js', 'tests/x.ts', 'src/x.ts', 'src/__mocks__/x.js',
    'scripts/x.js', 'server/x.js', '.github/x.js', 'jest.config.js', 'jestSetup.js', 'nested/jestSetup.js',
];

const SEVERITIES = {
    0: 'off', 1: 'warn', 2: 'error', off: 'off', warn: 'warn', error: 'error', allow: 'off', deny: 'error',
};

/**
 * @param {unknown} setting a rule setting, like `'error'`, `2` or `['deny', {...}]`
 * @returns {unknown[]} the setting as `[severity, ...options]`, with the severity as `error`, `warn` or `off`
 */
function normalizeEntry(setting) {
    const [severity, ...options] = Array.isArray(setting) ? setting : [setting];
    if (!(severity in SEVERITIES)) {
        throw new Error(`Unknown severity ${JSON.stringify(severity)} in ${JSON.stringify(setting)}`);
    }
    return [SEVERITIES[severity], ...options];
}

/**
 * Loads the presets as a repo's ESLint config lists them.
 * @param {string[]} presets names of files in configs/public, and `prettier`
 * @returns {Promise<Array<Record<string, any>>>} the ESLint flat config blocks
 */
async function loadESLintBlocks(presets) {
    const lists = await Promise.all(presets.map(async name => (name === 'prettier' ? [prettierConfig] : (await import(`../../configs/public/${name}.js`)).default)));
    return lists.flat();
}

/**
 * Resolves the rules ESLint runs on each file. calculateConfigForFile fills in default options, so it only tells which blocks
 * apply (each gets a tagged settings key). The rules are merged from those blocks as written: a later setting replaces an
 * earlier one, except a bare severity, which keeps the earlier options.
 * @param {string[]} presets
 * @returns {Promise<Map<string, Map<string, unknown[]>>>} for each file ESLint lints, the rules that are on by ESLint rule ID
 */
async function resolveESLintRules(presets) {
    const blocks = await loadESLintBlocks(presets);

    // Some presets use a plugin that another preset registers (typescript uses import), so a first block registers the plugins of every preset
    const allPlugins = Object.assign({}, ...(await loadESLintBlocks(EXPORTED_PRESETS)).map(block => block.plugins));
    const tagOf = index => `parityBlock${index}`;
    const eslint = new ESLint({
        cwd: packageDirectory,
        overrideConfigFile: true,
        overrideConfig: [{plugins: allPlugins}, ...blocks.map((block, index) => ({...block, settings: {...block.settings, [tagOf(index)]: true}}))],
    });
    const resolvedByFile = new Map();
    for (const file of SAMPLE_FILES) {
        const config = await eslint.calculateConfigForFile(path.join(packageDirectory, file));
        if (!config) {
            continue;
        }
        const merged = new Map();
        for (const [index, block] of blocks.entries()) {
            if (!config.settings?.[tagOf(index)]) {
                continue;
            }
            for (const [ruleID, setting] of Object.entries(block.rules ?? {})) {
                const entry = normalizeEntry(setting);
                const earlier = merged.get(ruleID);
                merged.set(ruleID, entry.length === 1 && earlier ? [entry[0], ...earlier.slice(1)] : entry);
            }
        }
        resolvedByFile.set(file, new Map([...merged].filter(([, entry]) => entry[0] !== 'off')));
    }
    return resolvedByFile;
}

/**
 * Asks oxlint which of the sample files a list of `files` globs applies to. Each file breaks one of two probe rules that only an override with those globs turns on.
 * @returns {{getMatches: (globs: string[] | null, ignorePatterns?: string[]) => Set<string>, remove: () => void}} `getMatches` returns
 * the files the globs match, or for `null` the files oxlint lints at all. `remove` deletes the temp project.
 */
function createFileMatcher() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'expensify-oxlint-parity-'));
    for (const file of SAMPLE_FILES) {
        fs.mkdirSync(path.dirname(path.join(directory, file)), {recursive: true});

        // Statements are a syntax error in a declaration file, so it breaks the other rule.
        fs.writeFileSync(path.join(directory, file), file.endsWith('.d.ts') ? 'export declare const value: any;\n' : 'debugger;\n');
    }
    const probeRules = {'no-debugger': 'error', 'typescript/no-explicit-any': 'error'};
    const cache = new Map();
    return {
        getMatches(globs, ignorePatterns = []) {
            const key = JSON.stringify([globs, ignorePatterns]);
            if (!cache.has(key)) {
                const config = {
                    plugins: ['typescript'],
                    categories: {correctness: 'off'},
                    ignorePatterns,
                    rules: globs ? {'no-debugger': 'off', 'typescript/no-explicit-any': 'off'} : probeRules,
                    overrides: globs ? [{files: globs, rules: probeRules}] : [],
                };
                fs.writeFileSync(path.join(directory, 'probe.json'), JSON.stringify(config));
                const result = spawnSync(`${packageDirectory}node_modules/.bin/oxlint`, ['-c', 'probe.json', '--format=json', ...SAMPLE_FILES], {
                    cwd: directory, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
                });
                let diagnostics;
                try {
                    diagnostics = JSON.parse(result.stdout).diagnostics;
                } catch {
                    throw new Error(`oxlint did not lint the probe files for ${key}: ${result.error ?? result.stderr}${result.stdout}`);
                }
                cache.set(key, new Set(diagnostics.filter(({code}) => /no-debugger|no-explicit-any/.test(code)).map(({filename}) => filename)));
            }
            return cache.get(key);
        },
        remove: () => fs.rmSync(directory, {recursive: true, force: true}),
    };
}

/**
 * Resolves the rules oxlint runs on each file: the root rules, then each override whose `files` apply (see createFileMatcher), in order.
 * A later entry replaces an earlier one completely, also a bare severity.
 * @param {import('oxlint').OxlintConfig} config
 * @param {ReturnType<typeof createFileMatcher>} matcher
 * @returns {Map<string, Map<string, unknown[]>>} for each file oxlint lints, the rules that are on by the name oxlint runs them under (like `core/dot-notation`)
 */
function resolveOxlintRules(config, matcher) {
    const linted = matcher.getMatches(null, config.ignorePatterns);
    const resolvedByFile = new Map();
    for (const file of SAMPLE_FILES) {
        if (!linted.has(file)) {
            continue;
        }
        const rules = new Map();
        const apply = (ruleSettings) => {
            for (const [name, setting] of Object.entries(ruleSettings ?? {})) {
                // oxlint's aliases for a plugin, so two names of one rule are one key
                rules.set(name.replace(/^eslint\//, '').replace(/^import-x\//, 'import/').replace(/^react-hooks\//, 'react/'), normalizeEntry(setting));
            }
        };
        apply(config.rules);
        for (const override of config.overrides ?? []) {
            if (matcher.getMatches(override.files, config.ignorePatterns).has(file)) {
                apply(override.rules);
            }
        }
        resolvedByFile.set(file, new Map([...rules].filter(([, entry]) => entry[0] !== 'off')));
    }
    return resolvedByFile;
}

/**
 * @param {string} name the name oxlint runs a rule under, like `core/dot-notation`
 * @returns {string} the ESLint rule ID, using the package's own mapping (toEslintRuleID)
 */
function toESLintID(name) {
    const slash = name.lastIndexOf('/');
    if (slash === -1) {
        return name;
    }
    return toEslintRuleID(`${name.slice(0, slash)}(${name.slice(slash + 1)})`);
}

/**
 * typescript-eslint extends some core rules (`dot-notation`, ...). The typescript preset turns the core rule off and the
 * typescript-eslint one on for TypeScript files, and oxlint runs them under either name. Both are one key.
 * @param {string} ruleID an ESLint rule ID
 * @returns {string} the ID of the core rule when `ruleID` is the typescript-eslint extension of one, else `ruleID`
 */
function toComparisonKey(ruleID) {
    const name = ruleID.replace(/^@typescript-eslint\//, '');
    return name !== ruleID && builtinRules.has(name) ? name : ruleID;
}

export {
    createFileMatcher, resolveESLintRules, resolveOxlintRules, toComparisonKey, toESLintID,
};
