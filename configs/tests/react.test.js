import {ESLint} from 'eslint';
import reactYouMightNotNeedAnEffect from 'eslint-plugin-react-you-might-not-need-an-effect';
import _ from 'underscore';
import reactConfig from '../public/react.js';

describe('React unnecessary-effect configuration', () => {
    const eslint = new ESLint({overrideConfigFile: true, overrideConfig: reactConfig});

    test('enables every unnecessary-effect rule as an error without adding browser globals', async () => {
        // Given a consumer of the shared React config.
        const config = await eslint.calculateConfigForFile('Component.js');

        // When inspecting the resolved plugin rules.
        const rules = _.keys(reactYouMightNotNeedAnEffect.configs.strict.rules);

        // Then all rules are errors and native consumers do not gain browser globals.
        for (const rule of rules) {
            expect(config.rules[rule]).toEqual([2]);
        }
        expect(config.languageOptions.globals || {}).not.toHaveProperty('window');
    });

    test('reports derived state through the exported React config', async () => {
        // Given a component that redundantly copies a prop into local state.
        const source = `
            import {useEffect, useState} from 'react';
            function Component({name}) {
                const [label, setLabel] = useState('');
                useEffect(() => { setLabel(name.toUpperCase()); }, [name]);
                return <span>{label}</span>;
            }
        `;

        // When linting with the public React config.
        const [result] = await eslint.lintText(source, {filePath: 'Component.js'});

        // Then the plugin is loaded and its derived-state rule blocks the pattern.
        expect(result.messages).toEqual(expect.arrayContaining([
            expect.objectContaining({ruleId: 'react-you-might-not-need-an-effect/no-derived-state', severity: 2}),
        ]));
    });

    test('allows effects that synchronize with an external system', async () => {
        // Given a component synchronizing the browser title with a prop.
        const source = `
            import {useEffect} from 'react';
            function Component({title}) {
                useEffect(() => { document.title = title; }, [title]);
                return null;
            }
        `;

        // When linting with the public React config.
        const [result] = await eslint.lintText(source, {filePath: 'Component.js'});

        // Then a necessary synchronization effect is not flagged by the new plugin.
        expect(_.filter(result.messages, message => message.ruleId && message.ruleId.startsWith('react-you-might-not-need-an-effect/'))).toEqual([]);
    });
});
