import assert from 'node:assert/strict';
import {test} from 'node:test';

import {withEslintDirectiveIDs} from '../utils.js';

const RULE_ID = 'react-hooks/exhaustive-deps';
const REPORT_LINE = 5;

// Each case uses its own file name and passes no `text`, so the comment cache never returns another case's comments.
let fileNumber = 0;

/**
 * @param {'Line' | 'Block'} type
 * @param {string} value the text of the comment, without the comment markers
 * @param {number} line where the comment starts
 * @param {{endLine?: number, column?: number}} [position]
 */
function comment(type, value, line, {endLine = line, column = 0} = {}) {
    return {type, value, loc: {start: {line, column}, end: {line: endLine, column: column + value.length}}};
}

/**
 * Runs a rule that reports once at line REPORT_LINE, hosted under RULE_ID, over a file with the given comments.
 * @param {Array<ReturnType<typeof comment>>} comments
 * @param {{ruleId?: string, column?: number}} [options]
 * @returns {boolean} whether the report got through
 */
function isReported(comments, {ruleId = RULE_ID, column = 0} = {}) {
    const reports = [];
    const rule = {create: context => ({Program: node => context.report({node, message: 'reported'})})};
    fileNumber += 1;
    const context = {filename: `case-${fileNumber}.js`, sourceCode: {getAllComments: () => comments}, report: report => reports.push(report)};
    withEslintDirectiveIDs(rule, ruleId).create(context).Program({loc: {start: {line: REPORT_LINE, column}, end: {line: REPORT_LINE, column: column + 5}}});
    return reports.length === 1;
}

test('a block eslint-disable hides the rule until an eslint-enable for it, and a line comment is no block directive', () => {
    const disable = (line, options) => comment('Block', ` eslint-disable ${RULE_ID} `, line, options);
    const enable = (line, ruleId = RULE_ID) => comment('Block', ` eslint-enable ${ruleId} `, line);

    assert.equal(isReported([comment('Block', ' eslint-disable ', 1)]), false);
    assert.equal(isReported([comment('Line', ' eslint-disable', 1)]), true);

    assert.equal(isReported([disable(1), enable(2)]), true);
    assert.equal(isReported([disable(1), enable(2, 'other/rule')]), false);

    // On the report's line, a directive after the report's column does not count
    assert.equal(isReported([disable(REPORT_LINE, {column: 20})], {column: 10}), true);
});

test('eslint-disable-next-line hides the line after the comment, and eslint-disable-line the line it is on', () => {
    assert.equal(isReported([comment('Line', ` eslint-disable-next-line ${RULE_ID}`, REPORT_LINE - 1)]), false);
    assert.equal(isReported([comment('Line', ` eslint-disable-line ${RULE_ID}`, REPORT_LINE)]), false);

    // A multi-line next-line applies after the comment ends
    assert.equal(isReported([comment('Block', ` eslint-disable-next-line ${RULE_ID} `, REPORT_LINE - 2, {endLine: REPORT_LINE - 1})]), false);
});

test('a comment can name several rules, or none, and may end with a reason', () => {
    const next = value => [comment('Line', ` eslint-disable-next-line ${value}`, REPORT_LINE - 1)];

    assert.equal(isReported(next(`other/rule, ${RULE_ID}`)), false);
    assert.equal(isReported(next('')), false);
    assert.equal(isReported(next(`${RULE_ID} -- the reason, with a comma`)), false);
});

test('when a file changes, its eslint-disable comments are read again', () => {
    const reports = [];
    const rule = withEslintDirectiveIDs({create: context => ({Program: node => context.report({node, message: 'reported'})})}, RULE_ID);
    const lint = (text, comments) => rule.create({filename: 'edited.js', sourceCode: {text, getAllComments: () => comments}, report: report => reports.push(report)})
        .Program({loc: {start: {line: REPORT_LINE, column: 0}, end: {line: REPORT_LINE, column: 5}}});

    // The same file name twice, with its text changed in between, as when an editor lints a file again after an edit
    lint('before', []);
    lint('after', [comment('Line', ` eslint-disable-next-line ${RULE_ID}`, REPORT_LINE - 1)]);

    // Only the first version reports, so the comment added by the edit counts
    assert.equal(reports.length, 1);
});
