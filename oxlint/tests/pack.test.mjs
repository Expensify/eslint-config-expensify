import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {
    createFixtureProject, getOxlintEnvironment, packageDirectory, runOxlint,
} from './helpers.mjs';

test('the packed package builds a config that oxlint loads, from a project that installed it', {timeout: 600_000}, () => {
    // Given the package packed like npm publish would, and installed into an empty project with oxlint
    const workDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'expensify-oxlint-pack-'));
    try {
        const packDirectory = path.join(workDirectory, 'tarball');
        const project = path.join(workDirectory, 'project');
        fs.mkdirSync(packDirectory);
        fs.mkdirSync(project);
        const [{filename}] = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', packDirectory], {cwd: packageDirectory, encoding: 'utf8'}));

        // The same oxlint versions this checkout has installed
        const installedVersion = name => JSON.parse(fs.readFileSync(path.join(packageDirectory, 'node_modules', name, 'package.json'), 'utf8')).version;
        fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({name: 'consumer', private: true, type: 'module'}));
        const install = packages => execFileSync('npm', ['install', '--no-audit', '--no-fund', ...packages], {cwd: project, stdio: 'pipe'});
        install([path.join(packDirectory, filename), 'react@19.0.0', `oxlint@${installedVersion('oxlint')}`, `oxlint-tsgolint@${installedVersion('oxlint-tsgolint')}`]);

        // When the consumer builds the config from another directory, as an editor may, with the plugin paths the package
        // exports, and oxlint runs it
        fs.writeFileSync(
            path.join(project, 'build-config.mjs'),
            `import fs from 'node:fs';
import {buildOxlintConfig} from 'eslint-config-expensify/oxlint';

import 'eslint-config-expensify/oxlint/plugins/hosted';

const config = await buildOxlintConfig({presets: ['browser', 'react', 'expensify', 'typescript', 'scripts', 'jest', 'prettier']});
fs.writeFileSync(process.argv[2], JSON.stringify(config));
`,
        );
        const configFile = path.join(project, 'built.json');

        // And another react in the working directory the build runs from, which must not win over the project's own
        fs.mkdirSync(path.join(workDirectory, 'node_modules/react'), {recursive: true});
        fs.writeFileSync(path.join(workDirectory, 'node_modules/react/package.json'), JSON.stringify({name: 'react', version: '0.0.0-working-directory'}));

        // And without @oxlint/migrate, an optional peer dependency, the build fails and says what to install
        const build = () => execFileSync(process.execPath, [path.join(project, 'build-config.mjs'), configFile], {cwd: workDirectory, stdio: 'pipe'});
        assert.throws(build, error => /npm install --save-dev "@oxlint\/migrate@>=1\.90\.0 <2"/.test(String(error.stderr)));

        // And with it installed, as the README says, the build works
        install([`@oxlint/migrate@${installedVersion('@oxlint/migrate')}`, `oxc-parser@${installedVersion('oxc-parser')}`]);
        build();

        // Then react is found from where the package is installed, not from the working directory
        assert.equal(JSON.parse(fs.readFileSync(configFile, 'utf8')).settings.react.version, '19.0.0');

        // A file that breaks one rule of each kind: ESLint's own, hosted and rulesdir
        const probe = [
            'import {useEffect} from \'react\';',
            'const value = {};',
            'export function f() {',
            '    useEffect(() => { console.log(value.a); }, [value.b]);',
            '    return value.a == 1;',
            '}',
            '',
        ].join('\n');
        const fixtures = createFixtureProject(fs.readFileSync(configFile, 'utf8'), {'probe.js': probe});
        try {
            const {codes, stderr} = runOxlint(fixtures, path.join(project, 'node_modules/.bin/oxlint'), getOxlintEnvironment(project));

            // And the config loads and rules from every plugin report
            assert.ok(codes.length > 0, `oxlint did not load the config: ${stderr}`);
            assert.ok(codes.includes('hosted(exhaustive-deps)') && codes.includes('rulesdir(no-inline-named-export)') && codes.includes('eslint(eqeqeq)'), [...new Set(codes)].join(', '));
        } finally {
            fs.rmSync(fixtures, {recursive: true, force: true});
        }
    } finally {
        fs.rmSync(workDirectory, {recursive: true, force: true});
    }
});
