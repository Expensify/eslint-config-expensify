import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {
    createFixtureProject, getOxlintEnvironment, packageDirectory, runOxlint,
} from './helpers.mjs';

// Installs the packed package, with the oxlint versions it is tested with, into an empty project.
test('the packed package builds a config that oxlint loads, from a project that installed it', {timeout: 600_000}, () => {
    // Given the package packed like npm publish would, and installed into an empty project with oxlint
    const workDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'expensify-oxlint-pack-'));
    try {
        const packDirectory = path.join(workDirectory, 'tarball');
        const project = path.join(workDirectory, 'project');
        fs.mkdirSync(packDirectory);
        fs.mkdirSync(project);
        const [{filename}] = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', packDirectory], {cwd: packageDirectory, encoding: 'utf8'}));
        const devDependencies = JSON.parse(fs.readFileSync(path.join(packageDirectory, 'package.json'), 'utf8')).devDependencies;
        fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({name: 'consumer', private: true, type: 'module'}));
        const install = packages => execFileSync('npm', ['install', '--no-audit', '--no-fund', ...packages], {cwd: project, stdio: 'pipe'});
        install([path.join(packDirectory, filename), `oxlint@${devDependencies.oxlint}`, `oxlint-tsgolint@${devDependencies['oxlint-tsgolint']}`]);

        // When the consumer builds the config, with the plugin paths the package exports, and oxlint runs it
        fs.writeFileSync(
            path.join(project, 'build-config.mjs'),
            `import fs from 'node:fs';
import {buildOxlintConfig} from 'eslint-config-expensify/oxlint';

import 'eslint-config-expensify/oxlint/plugins/hosted.mjs';

const config = await buildOxlintConfig({presets: ['browser', 'react', 'expensify', 'typescript', 'scripts', 'jest', 'prettier'], reactVersion: '19.0.0'});
fs.writeFileSync(process.argv[2], JSON.stringify(config));
`,
        );
        const configFile = path.join(project, 'built.json');

        // And without @oxlint/migrate, an optional peer dependency, the build fails and says what to install
        const build = () => execFileSync(process.execPath, ['build-config.mjs', configFile], {cwd: project, stdio: 'pipe'});
        assert.throws(build, error => /Install @oxlint\/migrate 1\.90\.x as a dev dependency/.test(String(error.stderr)));

        // And with it installed, as the README says, the build works
        install([`@oxlint/migrate@${devDependencies['@oxlint/migrate']}`]);
        build();
        const fixtures = createFixtureProject(fs.readFileSync(configFile, 'utf8'));
        try {
            const {codes, stderr} = runOxlint(fixtures, path.join(project, 'node_modules/.bin/oxlint'), getOxlintEnvironment(project));

            // Then the config loads and rules from every plugin report
            assert.ok(codes.length > 0, `oxlint did not load the config: ${stderr}`);
            assert.ok(codes.includes('hosted(exhaustive-deps)') && codes.includes('rulesdir(no-inline-named-export)') && codes.includes('eslint(eqeqeq)'), [...new Set(codes)].join(', '));
        } finally {
            fs.rmSync(fixtures, {recursive: true, force: true});
        }
    } finally {
        fs.rmSync(workDirectory, {recursive: true, force: true});
    }
});
