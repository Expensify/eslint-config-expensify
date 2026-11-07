/* eslint-disable no-console -- This offline CLI writes its report to stdout. */
/* eslint-disable rulesdir/prefer-underscore-method -- This report formatter uses native collections. */
import {parseArgs} from 'node:util';
import {analyzeFiles, loadEngines} from './analyze.mjs';

const LIMITATIONS = [
    'Only App\'s installed OXC React Compiler is used for analysis.',
    'The report finds source patterns whose emitted construction remains unguarded; it does not expose compiler scope-pruning reasons.',
    'A finding is a review candidate, not proof that a movement is legal or improves caching. No autofix is provided.',
    'The narrow pattern requires a unique named function, imported direct hook, native cache-runtime import added by OXC, and later direct method call.',
    'No finding does not imply optimal caching.',
    'Compiler inputs are explicit files using App shared compiler options; bundler preprocessing and build file exclusions are not reproduced.',
];

function displayLocation(loc) {
    return `${loc.line}:${loc.column + 1}`;
}

function humanReport(report) {
    const lines = [
        'OXC memoization candidates (report-only)',
        `Versions: ${JSON.stringify(report.versions)}`,
        `App compiler config: ${report.configPath}`,
    ];
    for (const file of report.files) {
        lines.push(`\n${file.filename}`);
        lines.push(`  OXC: ${file.status}`);
        if (file.failure) {
            lines.push(`  Failure: ${file.failure}`);
        }
        for (const diagnostic of file.diagnostics) {
            lines.push(`  Diagnostic: ${diagnostic.message}`);
        }
        for (const finding of file.findings) {
            lines.push(`  ${displayLocation(finding.value.location)} ${finding.function}: ${finding.value.name} is unguarded in OXC output;`);
            lines.push(`    Hook: ${finding.hook.name} @ ${displayLocation(finding.hook.location)};`);
            lines.push(`    Later work: ${finding.continuation.operation} @ ${displayLocation(finding.continuation.location)}.`);
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
        schemaVersion: 2,
        versions: engines.versions,
        configPath: engines.configPath,
        compilerOptions: engines.config(),
        limitations: LIMITATIONS,
        files: analyzeFiles(positionals, engines),
    };
    console.log(values.json ? JSON.stringify(report, null, 2) : humanReport(report));
    if (report.files.some(file => file.status === 'failed' || file.status === 'diagnostics')) {
        process.exitCode = 1;
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
