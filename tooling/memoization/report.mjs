/* eslint-disable no-console -- This offline CLI writes its report to stdout. */
/* eslint-disable rulesdir/prefer-underscore-method, es/no-nullish-coalescing-operators -- This dependency-free report formatter runs on Node 24. */
import {parseArgs} from 'node:util';
import {analyzeFiles, loadEngines} from './analyze.mjs';

const LIMITATIONS = [
    'Findings describe Babel 1.0.0 reference IR, not native OXC scope behavior.',
    'OXC validation is file-level compilation evidence, not confirmation of individual Babel findings or useful cache coverage.',
    'A pruned construction scope is a review opportunity, not proof that reordering is legal, beneficial, or possible. No autofix is provided.',
    'Only pruning at FlattenScopesWithHooksOrUseHIR is reported; no finding does not imply optimal memoization.',
    'Candidates require named scoped values, non-hook construction before a hook, and scoped call/store work after it; temporary-only and unsupported construction patterns are omitted.',
    'Compiler inputs are explicit files using App shared compiler options; bundler preprocessing and build file exclusions are not reproduced.',
    'OXC diagnostic labels retain native byte offsets. Babel locations refer to the original source, including TypeScript syntax.',
];

function displayLocation(loc) {
    return loc ? `${loc.start.line}:${loc.start.column + 1}` : 'unknown location';
}

function humanReport(report) {
    const lines = [
        'Memoization opportunities — Babel reference findings / separate OXC validation',
        `Versions: ${JSON.stringify(report.versions)}`,
        `App compiler config: ${report.configPath}`,
    ];
    for (const file of report.files) {
        lines.push(`\n${file.filename}`);
        if (file.failure) {
            lines.push(`  FAILED: ${file.failure}`);
            continue;
        }
        lines.push(`  Babel: ${file.babel.status}; OXC: ${file.oxc.status}; OXC memo-runtime import added: ${file.oxc.memoRuntimeImportAdded ?? 'unknown'}`);
        for (const finding of file.babel.findings) {
            lines.push(`  ${displayLocation(finding.location)} ${finding.function.name}: Babel scope ${finding.scopeId} pruned at ${finding.pass} (${finding.functionCompilation}).`);
            lines.push(`    Implicated scoped values: ${finding.values.map(value => `${value.name} @ ${displayLocation(value.location)}`).join(', ') || '(compiler temporaries only)'}`);
            lines.push(`    Enclosed hooks/use: ${finding.hooks.map(hook => `${hook.name} @ ${displayLocation(hook.location)}`).join(', ')}`);
        }
        for (const engine of ['babel', 'oxc']) {
            if (file[engine].failure) {
                lines.push(`  ${engine} failure: ${file[engine].failure}`);
            }
            for (const diagnostic of file[engine].diagnostics) {
                lines.push(`  ${engine} diagnostic: ${JSON.stringify(diagnostic)}`);
            }
        }
    }
    lines.push('\nLimits:', ...report.limitations.map(limit => `  - ${limit}`));
    return lines.join('\n');
}

try {
    const {values, positionals} = parseArgs({options: {app: {type: 'string'}, json: {type: 'boolean', default: false}}, allowPositionals: true});
    if (!values.app || positionals.length === 0) {
        throw new Error('Usage: node tooling/memoization/report.mjs --app ../App [--json] -- FILE.tsx [FILE.js ...]');
    }
    const engines = loadEngines(values.app);
    const report = {
        schemaVersion: 1,
        versions: engines.versions,
        configPath: engines.configPath,
        compilerOptions: engines.config(),
        locationConvention: 'Original source; lines 1-based, columns 0-based in JSON (1-based in human output).',
        limitations: LIMITATIONS,
        files: analyzeFiles(positionals, engines),
    };
    console.log(values.json ? JSON.stringify(report, null, 2) : humanReport(report));
    if (report.files.some(file => file.failure || ['failed', 'diagnostics'].includes(file.babel.status) || ['failed', 'diagnostics'].includes(file.oxc.status))) {
        process.exitCode = 1;
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
