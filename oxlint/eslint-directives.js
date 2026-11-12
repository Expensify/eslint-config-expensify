/* eslint-disable es/no-optional-chaining, es/no-nullish-coalescing-operators, rulesdir/prefer-underscore-method -- Node-only tooling, so modern syntax and native array methods are fine */
/**
 * oxlint runs some ESLint rules as JS plugins under a new name. For example,
 * `@typescript-eslint/naming-convention` becomes `hosted/naming-convention`. oxlint does not know the
 * two are the same rule, so an existing `eslint-disable-next-line @typescript-eslint/naming-convention`
 * comment would not hide its report. The wrappers here read those comments and drop what ESLint would hide.
 *
 * This file only exists for repos that still have `eslint-disable` comments. Once they all use oxlint-style comments
 * (`oxlint-disable-next-line hosted/naming-convention`), it can be removed in a later release, along with the `core/` and
 * `hosted/` handling that depends on it.
 */

const JUSTIFICATION = /\s-{2,}\s/;
const KINDS = ['eslint-disable-next-line', 'eslint-disable-line', 'eslint-disable', 'eslint-enable'];
const ALL_RULES = ' all';

// The last file whose comments were parsed. Only one is kept, so a long-running process like an editor does not hold
// the text of every file it lints.
let lastFile = null;

/**
 * Turns a comment like `eslint-disable-next-line rule-a, rule-b -- reason` into its kind and the rules
 * it names. A directive that names no rule applies to every rule.
 * @param {{type: 'Line' | 'Block', value: string, loc?: {start: {line: number, column: number}, end: {line: number, column: number}}}} comment
 * @returns {{kind: string, ruleIds: string[]} | null} null when the comment is not a directive
 */
function parseComment(comment) {
    const text = String(comment.value ?? '').trim();
    const kind = KINDS.find(candidate => text === candidate || (text.startsWith(candidate) && /^\s/.test(text.slice(candidate.length))));
    if (!kind) {
        return null;
    }
    const body = text.slice(kind.length).split(JUSTIFICATION)[0];
    const ruleIds = body
        .split(',')
        .map(id => id.trim())
        .filter(Boolean);
    return {kind, ruleIds: ruleIds.length ? ruleIds : [ALL_RULES]};
}

/**
 * Collects a file's disable comments in a form that is quick to check for each report. A
 * `-line`/`-next-line` comment becomes the line it covers. `eslint-disable`/`eslint-enable` comments
 * stay in source order, because the last one before a report decides.
 * @param {Array<Parameters<typeof parseComment>[0]>} comments
 * @returns {{lines: Map<string, Set<number>>, blocks: Array<{line: number, column: number, ruleId: string, disable: boolean}>}}
 */
function parseDirectives(comments) {
    const lines = new Map();
    const blocks = [];

    for (const comment of comments) {
        const parsed = parseComment(comment);
        const start = comment.loc?.start?.line;
        const end = comment.loc?.end?.line;
        if (!parsed || start == null || end == null) {
            continue;
        }

        // ESLint reads `eslint-disable` and `eslint-enable` only from block comments.
        const isBlockKind = parsed.kind === 'eslint-disable' || parsed.kind === 'eslint-enable';
        if (isBlockKind && comment.type !== 'Block') {
            continue;
        }
        for (const ruleId of parsed.ruleIds) {
            if (parsed.kind === 'eslint-disable-next-line' || parsed.kind === 'eslint-disable-line') {
                // ESLint ignores a multi-line `-line` directive but applies a multi-line `-next-line`
                // to the line after the comment ends.
                if (parsed.kind === 'eslint-disable-line' && start !== end) {
                    continue;
                }
                if (!lines.has(ruleId)) {
                    lines.set(ruleId, new Set());
                }
                lines.get(ruleId).add(parsed.kind === 'eslint-disable-line' ? start : end + 1);
            } else {
                blocks.push({
                    line: start, column: comment.loc.start.column ?? 0, ruleId, disable: parsed.kind === 'eslint-disable',
                });
            }
        }
    }

    return {lines, blocks};
}

/**
 * Every wrapped rule checks the same file in turn, so its comments are parsed once and kept until another file comes.
 * The file's text is kept with them, so an editor that lints the same file again after an edit gets its new comments.
 * @param {string | undefined} filename
 * @param {{text?: string, getAllComments: () => Array<Parameters<typeof parseComment>[0]>}} sourceCode
 * @returns {ReturnType<typeof parseDirectives>}
 */
function directivesFor(filename, sourceCode) {
    const key = filename ?? '<unknown>';
    if (lastFile && lastFile.key === key && lastFile.text !== undefined && lastFile.text === sourceCode.text) {
        return lastFile.directives;
    }
    const directives = parseDirectives(sourceCode.getAllComments());
    lastFile = {key, text: sourceCode.text, directives};
    return directives;
}

/**
 * Tells whether ESLint would hide a report of `eslintRuleId` at `position`. As in ESLint, the last
 * `eslint-disable`/`eslint-enable` before the report, by line and then column, that names the rule
 * (or no rule) wins.
 * @param {ReturnType<typeof parseDirectives>} directives
 * @param {string} eslintRuleId
 * @param {{line: number, column: number} | null} position
 * @returns {boolean}
 */
function isSuppressed(directives, eslintRuleId, position) {
    if (position == null) {
        return false;
    }
    const {line, column} = position;
    if (directives.lines.get(eslintRuleId)?.has(line) || directives.lines.get(ALL_RULES)?.has(line)) {
        return true;
    }
    let disabled = false;
    for (const block of directives.blocks) {
        const isAfterReport = block.line > line || (block.line === line && block.column > column);
        if (isAfterReport || (block.ruleId !== ALL_RULES && block.ruleId !== eslintRuleId)) {
            continue;
        }
        disabled = block.disable;
    }
    return disabled;
}

/**
 * Finds the line and column a report points at, to check it against the disable comments. Rules pass
 * either a descriptor with `loc` or `node`, or a node in the legacy `report(node, message)` form.
 * @param {unknown[]} args
 * @returns {{line: number, column: number} | null}
 */
function reportPosition(args) {
    const first = args[0];
    const candidates = [first?.loc?.start, first?.loc, first?.node?.loc?.start, first?.node?.loc];
    const point = candidates.find(candidate => typeof candidate?.line === 'number');
    return point ? {line: point.line, column: typeof point.column === 'number' ? point.column : 0} : null;
}

/**
 * Makes an oxlint JS plugin rule respect `eslint-disable` comments written for the ESLint rule it
 * copies. Without it, `// eslint-disable-next-line react-hooks/exhaustive-deps` would not hide the
 * oxlint copy's report, because oxlint calls that copy `hosted/exhaustive-deps`.
 * @param {import('eslint').Rule.RuleModule} rule
 * @param {string} eslintRuleId the ID ESLint reports this rule under, like `react-hooks/exhaustive-deps`
 * @returns {import('eslint').Rule.RuleModule}
 */
function withEslintDirectiveIDs(rule, eslintRuleId) {
    return {
        ...rule,
        create(context) {
            const filteredContext = Object.create(context, {
                report: {
                    // Keeps every argument: ESLint also accepts the legacy `report(node, message)` form.
                    value(...args) {
                        const position = reportPosition(args);
                        if (position != null) {
                            const sourceCode = context.sourceCode ?? context.getSourceCode();
                            const filename = context.filename ?? context.getFilename();
                            if (isSuppressed(directivesFor(filename, sourceCode), eslintRuleId, position)) {
                                return;
                            }
                        }
                        return context.report(...args);
                    },
                },
            });
            return rule.create(filteredContext);
        },
    };
}

/**
 * withEslintDirectiveIDs for a whole plugin at once. `toEslintId` gives the ESLint name of each rule,
 * like `naming-convention` to `@typescript-eslint/naming-convention`.
 * @param {Record<string, import('eslint').Rule.RuleModule>} rules
 * @param {(name: string) => string} toEslintId maps an oxlint rule name to its ESLint ID
 * @returns {Record<string, import('eslint').Rule.RuleModule>}
 */
function withEslintDirectiveIDsFor(rules, toEslintId) {
    return Object.fromEntries(Object.entries(rules).map(([name, rule]) => [name, withEslintDirectiveIDs(rule, toEslintId(name))]));
}

export {withEslintDirectiveIDs, withEslintDirectiveIDsFor};
