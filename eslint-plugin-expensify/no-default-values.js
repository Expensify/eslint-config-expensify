module.exports = {
    name: 'no-default-values',
    meta: {
        type: 'problem',
        docs: {
            description: 'Enforce boolean conditions in React conditional rendering',
            recommended: 'error',
        },
        schema: [],
        messages: {
            // eslint-disable-next-line max-len
            disallowedNumberDefault: 'Default the number ID to `CONST.DEFAULT_NUMBER_ID` instead. See: https://github.com/Expensify/App/blob/main/contributingGuides/STYLE.md#default-value-for-inexistent-IDs',
            // eslint-disable-next-line max-len
            disallowedStringDefault: 'Do not default string IDs to any value. See: https://github.com/Expensify/App/blob/main/contributingGuides/STYLE.md#default-value-for-inexistent-IDs',
        },
    },
    create(context) {
        function createPatternRegex(pattern) {
            return new RegExp(pattern.replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1'), 'g');
        }

        const sourceCode = context.getSourceCode();
        const text = sourceCode.text; // This gets all the text in the file

        const disallowedNumberDefaults = [
            ' ?? -1',
            ' || -1',
            ' : -1',
        ];

        const disallowedStringDefaults = [
            " ?? '-1'",
            "ID ?? ''",
            "id ?? ''",
            "ID ?? '0'",
            "id ?? '0'",
            " || '-1'",
            "ID || ''",
            "id || ''",
            "ID || '0'",
            "id || '0'",
            " : '-1'",
            " : '0'",
        ];

        disallowedNumberDefaults.forEach((pattern) => {
            const regex = createPatternRegex(pattern);
            let match;
            while ((match = regex.exec(text)) !== null) {
                const index = match.index;

                const defaultStr = match[0];
                const defaultStrPosition = sourceCode.getLocFromIndex(index);

                context.report({
                    messageId: 'disallowedNumberDefault',
                    loc: {
                        start: {line: defaultStrPosition.line, column: defaultStrPosition.column + defaultStr.indexOf(' ')},
                        end: {line: defaultStrPosition.line, column: defaultStrPosition.column + defaultStr.length},
                    },
                });
            }
        });

        disallowedStringDefaults.forEach((pattern) => {
            const regex = createPatternRegex(pattern);
            let match;
            while ((match = regex.exec(text)) !== null) {
                const index = match.index;

                const defaultStr = match[0];
                const defaultStrPosition = sourceCode.getLocFromIndex(index);

                context.report({
                    messageId: 'disallowedStringDefault',
                    loc: {
                        start: {line: defaultStrPosition.line, column: defaultStrPosition.column + defaultStr.indexOf(' ')},
                        end: {line: defaultStrPosition.line, column: defaultStrPosition.column + defaultStr.length},
                    },
                });
            }
        });

        return {};
    },
};
