import assert from 'node:assert/strict';
import {test} from 'node:test';

import {withEslintDirectiveIDs} from '../utils.js';

const RULE_ID = 'react-hooks/exhaustive-deps';
const REPORT_LINE = 5;

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
 * Runs a rule that reports once at line REPORT_LINE, hosted under RULE_ID, over a file with the given comments. Without a `text`,
 * the comment cache never returns another case's comments.
 * @param {Array<ReturnType<typeof comment>>} comments
 * @param {{column?: number, filename?: string, text?: string}} [options]
 * @returns {boolean} whether the report got through
 */
function isReported(comments, {column = 0, filename = 'case.js', text} = {}) {
    const reports = [];
    const rule = {create: context => ({Program: node => context.report({node, message: 'reported'})})};
    const context = {filename, sourceCode: {text, getAllComments: () => comments}, report: report => reports.push(report)};
    withEslintDirectiveIDs(rule, RULE_ID).create(context).Program({loc: {start: {line: REPORT_LINE, column}, end: {line: REPORT_LINE, column: column + 5}}});
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
    assert.equal(isReported([comment('Block', ` eslint-disable-next-line ${RULE_ID} `, REPORT_LINE - 2, {endLine: REPORT_LINE - 1})]), false);
});

test('a comment can name several rules, or none, and may end with a reason', () => {
    const next = value => [comment('Line', ` eslint-disable-next-line ${value}`, REPORT_LINE - 1)];

    assert.equal(isReported(next(`other/rule, ${RULE_ID}`)), false);
    assert.equal(isReported(next('')), false);
    assert.equal(isReported(next(`${RULE_ID} -- the reason, with a comma`)), false);
});

test('when a file changes, its eslint-disable comments are read again', () => {
    const lint = (text, comments) => isReported(comments, {filename: 'edited.js', text});

    // The same file name with its text changed, as when an editor lints a file again after an edit: the comment added by the edit counts
    assert.deepEqual([lint('before', []), lint('after', [comment('Line', ` eslint-disable-next-line ${RULE_ID}`, REPORT_LINE - 1)])], [true, false]);
});
