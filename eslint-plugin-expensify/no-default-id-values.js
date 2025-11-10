function createPatternRegex(pattern) {
    return new RegExp(pattern.replaceAll(/([.?*+^$[\]\\(){}|-])/g, '\\$1'), 'g');
}

function searchForPatternsAndReport(context, sourceCode, soureCodeStr, pattern, messageId) {
    const regex = createPatternRegex(pattern);
    let match = regex.exec(soureCodeStr);
    while (match !== null) {
        const index = match.index;

        const defaultStr = match[0];
        const defaultStrPosition = sourceCode.getLocFromIndex(index);

        context.report({
            messageId,
            loc: {
                start: {line: defaultStrPosition.line, column: defaultStrPosition.column + defaultStr.indexOf(' ')},
                end: {line: defaultStrPosition.line, column: defaultStrPosition.column + defaultStr.length},
            },
        });

        match = regex.exec(soureCodeStr);
    }
}

const name = 'no-default-id-values';

const meta = {
    type: 'problem',
    docs: {
        description: 'Restricts use of default number/string IDs in the project.',
        recommended: 'error',
    },
    schema: [],
    messages: {
        // eslint-disable-next-line max-len
        disallowedNumberDefault: 'Default the number ID to `CONST.DEFAULT_NUMBER_ID` instead. See: https://github.com/Expensify/App/blob/main/contributingGuides/STYLE.md#default-value-for-inexistent-IDs',
        disallowedStringDefault: 'Do not default string IDs to any value. See: https://github.com/Expensify/App/blob/main/contributingGuides/STYLE.md#default-value-for-inexistent-IDs',
    },
};

function create(context) {
    const sourceCode = context.getSourceCode();
    const soureCodeStr = sourceCode.text; // This gets all the text in the file

    const disallowedNumberDefaults = [
        'ID ?? -1',
        'id ?? -1',
        'ID ?? 0',
        'id ?? 0',
        'ID || -1',
        'id || -1',
        'ID || 0',
        'id || 0',
        'ID : -1',
        'id : -1',
        'ID : 0',
        'id : 0',
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
        'CONST.DEFAULT_NUMBER_ID}`',
    ];

    for (const pattern of disallowedNumberDefaults) {
        searchForPatternsAndReport(context, sourceCode, soureCodeStr, pattern, 'disallowedNumberDefault');
    }

    for (const pattern of disallowedStringDefaults) {
        searchForPatternsAndReport(context, sourceCode, soureCodeStr, pattern, 'disallowedStringDefault');
    }

    return {};
}

export {name, meta, create};
