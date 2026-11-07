/* eslint-disable rulesdir/prefer-underscore-method */
const name = 'component-body-order';

const GROUPS = ['inputs/context', 'subscriptions', 'state/refs', 'derived values', 'handlers', 'effects', 'render'];
const HOOK_GROUPS = new Map([
    ['useContext', 0],
    ['use', 0],
    ['useOnyx', 1],
    ['useSyncExternalStore', 1],
    ['useState', 2],
    ['useReducer', 2],
    ['useRef', 2],
    ['useMemo', 3],
    ['useCallback', 4],
    ['useEffect', 5],
    ['useLayoutEffect', 5],
    ['useInsertionEffect', 5],
    ['useImperativeHandle', 5],
]);
const TRANSPARENT_EXPRESSIONS = new Set([
    'TSAsExpression',
    'TSTypeAssertion',
    'TSNonNullExpression',
    'TSSatisfiesExpression',
    'TSInstantiationExpression',
    'ChainExpression',
    'ParenthesizedExpression',
]);

const meta = {
    type: 'suggestion',
    docs: {
        description: 'Prefer dependency-aware component and hook body ordering with conservative inert-declaration fixes',
    },
    fixable: 'code',
    schema: [],
    messages: {
        order: 'Consider placing {{group}} before {{previous}}. Preserve hook order and review evaluation order; memoization gains are not guaranteed.',
    },
};

/** @param {Object} node @returns {Object} */
function unwrap(node) {
    let expression = node;
    while (expression && TRANSPARENT_EXPRESSIONS.has(expression.type)) {
        expression = expression.expression;
    }
    return expression;
}

/**
 * @param {Object} node
 * @param {Object} aliases
 * @returns {String|null}
 */
function getCallName(node, aliases) {
    if (!node || node.type !== 'CallExpression') {
        return null;
    }
    const callee = unwrap(node.callee);
    if (callee.type === 'Identifier') {
        return aliases.get(callee.name, callee) || callee.name;
    }
    if (callee.type === 'MemberExpression' && !callee.computed) {
        return callee.property.name;
    }
    if (callee.type === 'MemberExpression' && callee.computed && callee.property.type === 'Literal') {
        return callee.property.value;
    }
    if (callee.type === 'MemberExpression' && callee.computed && callee.property.type === 'TemplateLiteral' && callee.property.expressions.length === 0) {
        return callee.property.quasis[0].value.cooked;
    }
    return null;
}

/**
 * @param {Object} node
 * @param {Object} aliases
 * @returns {Boolean}
 */
function isHookCall(node, aliases) {
    const callName = getCallName(node, aliases);
    return callName === 'use' || /^use[A-Z0-9]/.test(callName || '');
}

/**
 * @param {Object} node
 * @param {Object} aliases
 * @returns {Boolean}
 */
function isCandidate(node, aliases) {
    if (node.async || node.generator) {
        return false;
    }
    let parent = node.parent;
    let wrapped = node;
    while (parent.type === 'CallExpression' && ['memo', 'forwardRef'].includes(getCallName(parent, aliases)) && parent.arguments[0] === wrapped) {
        wrapped = parent;
        parent = parent.parent;
    }
    const id = (parent.type === 'VariableDeclarator' ? parent.id : null) || node.id;
    if (!id && parent.type === 'ExportDefaultDeclaration' && node.body.type === 'BlockStatement'
        && node.body.body.some(statement => statement.type === 'ReturnStatement' && statement.argument
            && ['JSXElement', 'JSXFragment'].includes(statement.argument.type))) {
        return true;
    }
    if (!id || id.type !== 'Identifier' || !/^(?:[A-Z]|use[A-Z0-9])/.test(id.name)) {
        return false;
    }
    if (node.body.type !== 'BlockStatement') {
        return false;
    }
    for (let ancestor = parent; ancestor; ancestor = ancestor.parent) {
        if (/Function/.test(ancestor.type)) {
            return false;
        }
    }
    return true;
}

/**
 * @param {Object} statement
 * @param {Object} aliases
 * @param {Array<Object>} params
 * @returns {Object|null}
 */
function classify(statement, aliases, params) {
    if (statement.type === 'ReturnStatement') {
        return null;
    }
    if (statement.type === 'FunctionDeclaration') {
        return {group: 4, hook: false};
    }
    if (statement.type === 'ExpressionStatement' && isHookCall(unwrap(statement.expression), aliases)) {
        return {group: HOOK_GROUPS.get(getCallName(unwrap(statement.expression), aliases)) || 0, hook: true};
    }
    if (statement.type !== 'VariableDeclaration' || statement.kind !== 'const' || statement.declarations.length !== 1) {
        return null;
    }
    const init = unwrap(statement.declarations[0].init);
    if (!init) {
        return null;
    }
    if (isHookCall(init, aliases)) {
        return {group: HOOK_GROUPS.get(getCallName(init, aliases)) || 0, hook: true};
    }
    if (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression') {
        return {group: 4, hook: false};
    }
    if (init.type === 'JSXElement' || init.type === 'JSXFragment') {
        return {group: 6, hook: false};
    }
    return {group: init.type === 'Identifier' && params.some(param => param.type === 'Identifier' && param.name === init.name) ? 0 : 3, hook: false};
}

/**
 * Only inspect evaluation-time expressions. Callback bodies do not execute when the callback is created.
 * @param {Object} node
 * @param {Object} visitorKeys
 * @param {Object} aliases
 * @returns {Boolean}
 */
function containsHook(node, visitorKeys, aliases) {
    if (!node || /Function/.test(node.type)) {
        return false;
    }
    if (isHookCall(node, aliases)) {
        return true;
    }
    if (node.type === 'CallExpression') {
        const callee = unwrap(node.callee);
        if (/Function/.test(callee.type) || (callee.type === 'MemberExpression' && callee.computed && getCallName(node, aliases) === null)) {
            return true;
        }
    }
    for (const key of visitorKeys[node.type] || []) {
        const child = node[key];
        if (Array.isArray(child) ? child.some(item => containsHook(item, visitorKeys, aliases)) : containsHook(child, visitorKeys, aliases)) {
            return true;
        }
    }
    return false;
}

/**
 * References inside closures count too: moving a captured declaration can expand its lifetime or cross an eager call.
 * @param {Array<Object>} variables
 * @param {Object} statement
 * @returns {Boolean}
 */
function referencesStatement(variables, statement) {
    const [start, end] = statement.range;
    return variables.some(variable => variable.references.some(({identifier}) => identifier.range[0] >= start && identifier.range[1] <= end));
}

/**
 * Primitive-only operations cannot invoke user coercion or throw on BigInt arithmetic.
 * @param {Object} node
 * @returns {Boolean}
 */
function isLiteralComputation(node) {
    const expression = unwrap(node);
    if (!expression) {
        return false;
    }
    if (expression.type === 'Literal') {
        return !expression.regex && !expression.bigint && (expression.value === null || ['string', 'number', 'boolean'].includes(typeof expression.value));
    }
    if (expression.type === 'UnaryExpression') {
        return ['+', '-', '!', '~', 'void', 'typeof'].includes(expression.operator) && isLiteralComputation(expression.argument);
    }
    if (expression.type === 'BinaryExpression' || expression.type === 'LogicalExpression') {
        return !['in', 'instanceof'].includes(expression.operator) && isLiteralComputation(expression.left) && isLiteralComputation(expression.right);
    }
    if (expression.type === 'ConditionalExpression') {
        return isLiteralComputation(expression.test) && isLiteralComputation(expression.consequent) && isLiteralComputation(expression.alternate);
    }
    return expression.type === 'TemplateLiteral' && expression.expressions.every(isLiteralComputation);
}

/**
 * Eval and dynamic scopes can observe bindings without scope-manager references, even through a nested closure.
 * @param {Object} node
 * @param {Object} visitorKeys
 * @returns {Boolean}
 */
function hasDynamicReferences(node, visitorKeys) {
    if (!node) {
        return false;
    }
    if (node.type === 'WithStatement' || (node.type === 'CallExpression' && unwrap(node.callee).name === 'eval')) {
        return true;
    }
    return (visitorKeys[node.type] || []).some((key) => {
        const child = node[key];
        return Array.isArray(child) ? child.some(item => hasDynamicReferences(item, visitorKeys)) : hasDynamicReferences(child, visitorKeys);
    });
}

/**
 * Direct calls do not expose the function object; returns and JSX props hand it off after its render-time construction.
 * Property access, aliases, and call arguments can mutate or expose it to an unknown mutator.
 * @param {Object} identifier
 * @returns {Boolean}
 */
function isSafeFunctionUse(identifier) {
    let expression = identifier;
    while (TRANSPARENT_EXPRESSIONS.has(expression.parent.type)) {
        expression = expression.parent;
    }
    if (expression.parent.type === 'CallExpression' && expression.parent.callee === expression) {
        return true;
    }
    if (expression.parent.type === 'JSXExpressionContainer' && expression.parent.parent.type === 'JSXAttribute') {
        return true;
    }
    while (expression.parent.type === 'ArrayExpression' || expression.parent.type === 'ObjectExpression'
        || (expression.parent.type === 'Property' && expression.parent.value === expression
            && !expression.parent.computed && expression.parent.kind === 'init')
        || TRANSPARENT_EXPRESSIONS.has(expression.parent.type)) {
        expression = expression.parent;
    }
    return expression.parent.type === 'ReturnStatement';
}

/**
 * Only move a binding whose lifetime cannot be observed by an earlier access or an indirectly invoked closure.
 * @param {Object} statement
 * @param {Array<Object>} variables
 * @param {Object} component
 * @param {Object} sourceCode
 * @returns {Boolean}
 */
function isInertDeclaration(statement, variables, component, sourceCode) {
    if (statement.type !== 'VariableDeclaration' || statement.kind !== 'const' || statement.declarations.length !== 1) {
        return false;
    }
    const declaration = statement.declarations[0];
    const init = unwrap(declaration.init);
    const isFunction = init && ['ArrowFunctionExpression', 'FunctionExpression'].includes(init.type);
    if (declaration.id.type !== 'Identifier' || !init
        || (!isFunction && !isLiteralComputation(init))) {
        return false;
    }
    if (init.type === 'FunctionExpression') {
        const selfVariable = init.id && sourceCode.getDeclaredVariables(init)
            .find(variable => variable.name === init.id.name && variable.scope.type === 'function-expression-name');
        const argumentsVariable = sourceCode.getScope(init).set.get('arguments');
        if ((init.id && (!selfVariable || selfVariable.references.length > 0)) || !argumentsVariable || argumentsVariable.references.length > 0) {
            return false;
        }
    }
    const variable = variables[0];
    return variables.length === 1 && variable.scope.type === 'function' && variable.scope.block === component
        && variable.references.every(reference => reference.resolved === variable && reference.from === variable.scope
            && reference.identifier.range[0] >= statement.range[0]
            && (!reference.isWrite() || reference.identifier === declaration.id)
            && (!isFunction || reference.identifier === declaration.id || isSafeFunctionUse(reference.identifier)));
}

/** @param {Object} context @returns {Object} */
function create(context) {
    const {sourceCode} = context;
    const importedNames = new Map();
    const resolvedAliases = new WeakMap();
    const aliases = {
        get(identifierName, identifier) {
            if (!importedNames.has(identifierName)) {
                return null;
            }
            if (!resolvedAliases.has(identifier)) {
                let scope = sourceCode.getScope(identifier);
                while (scope && !scope.set.has(identifierName)) {
                    scope = scope.upper;
                }
                const variable = scope && scope.set.get(identifierName);
                const isImport = variable && variable.defs.some(definition => definition.type === 'ImportBinding');
                resolvedAliases.set(identifier, isImport ? importedNames.get(identifierName) : null);
            }
            return resolvedAliases.get(identifier);
        },
    };

    function check(node) {
        if (!isCandidate(node, aliases)) {
            return;
        }
        const statements = node.body.body;
        if (statements.length < 2) {
            return;
        }
        let variables;
        function declarations(statement) {
            if (!variables) {
                variables = new Map();
            }
            if (!variables.has(statement)) {
                variables.set(statement, sourceCode.getDeclaredVariables(statement));
            }
            return variables.get(statement);
        }

        const canFix = !sourceCode.getAllComments().some(comment => /\beslint\b/.test(comment.value))
            && !hasDynamicReferences(node, sourceCode.visitorKeys);
        const entries = statements.map((statement) => {
            const category = classify(statement, aliases, node.params);
            return {
                statement,
                category,
                hiddenHook: category && !category.hook && containsHook(statement, sourceCode.visitorKeys, aliases),
                inert: canFix && isInertDeclaration(statement, declarations(statement), node, sourceCode),
                comments: sourceCode.getCommentsBefore(statement).length > 0 || sourceCode.getCommentsAfter(statement).length > 0
                    || sourceCode.getCommentsInside(statement).length > 0,
            };
        });
        const ordered = [...entries];
        let warning;
        let fixReport;
        let changed;
        do {
            changed = false;
            for (let index = 1; index < ordered.length; index++) {
                const prior = ordered[index - 1];
                const current = ordered[index];
                if (!current.category || !prior.category || prior.category.group <= current.category.group
                    || (prior.category.hook && current.category.hook) || prior.hiddenHook || current.hiddenHook
                    || referencesStatement(declarations(prior.statement), current.statement)
                    || referencesStatement(declarations(current.statement), prior.statement)) {
                    continue;
                }
                const report = {
                    node: current.statement,
                    messageId: 'order',
                    data: {group: GROUPS[current.category.group], previous: GROUPS[prior.category.group]},
                };
                warning ||= report;
                if (!canFix || prior.comments || current.comments
                    || !(prior.inert || current.inert)
                    || !(prior.inert || prior.category.hook) || !(current.inert || current.category.hook)) {
                    continue;
                }
                fixReport ||= report;
                ordered[index - 1] = current;
                ordered[index] = prior;
                changed = true;
            }

            // Each swap strictly decreases category inversions, including around interleaved fixed hook anchors.
        } while (changed);
        if (fixReport) {
            const first = ordered.findIndex((entry, index) => entry !== entries[index]);
            let last = ordered.length - 1;
            while (ordered[last] === entries[last]) {
                last--;
            }
            let start = statements[first].range[0];
            let replacement = '';
            if (first > 0 && ordered[first].statement.type === 'ExpressionStatement'
                && sourceCode.getLastToken(statements[first - 1]).value !== ';') {
                start = statements[first - 1].range[1];
                replacement = `;${sourceCode.text.slice(start, statements[first].range[0])}`;
            }
            for (let index = first; index <= last; index++) {
                const {statement} = ordered[index];
                const next = ordered[index + 1];
                const changesFollowingBoundary = next && next !== entries[index + 1] && next.statement.type === 'ExpressionStatement';
                replacement += sourceCode.getText(statement);
                if ((ordered[index] !== entries[index] || changesFollowingBoundary) && sourceCode.getLastToken(statement).value !== ';') {
                    replacement += ';';
                }
                if (index < last) {
                    replacement += sourceCode.text.slice(statements[index].range[1], statements[index + 1].range[0]);
                }
            }
            context.report({
                ...fixReport,
                fix: fixer => fixer.replaceTextRange([start, statements[last].range[1]], replacement),
            });
        } else if (warning) {
            context.report(warning);
        }
    }

    return {
        Program(node) {
            for (const statement of node.body) {
                if (statement.type !== 'ImportDeclaration') {
                    continue;
                }
                for (const specifier of statement.specifiers) {
                    if (specifier.type !== 'ImportSpecifier') {
                        continue;
                    }
                    const imported = specifier.imported.name;
                    if (specifier.local.name !== imported
                        && (imported === 'use' || /^use[A-Z0-9]/.test(imported) || imported === 'memo' || imported === 'forwardRef')) {
                        importedNames.set(specifier.local.name, imported);
                    }
                }
            }
        },
        FunctionDeclaration: check,
        FunctionExpression: check,
        ArrowFunctionExpression: check,
    };
}

export {name, meta, create};
