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
const TRANSPARENT_EXPRESSIONS = new Set(['TSAsExpression', 'TSTypeAssertion', 'TSNonNullExpression', 'TSSatisfiesExpression', 'ChainExpression', 'ParenthesizedExpression']);

const meta = {
    type: 'suggestion',
    docs: {
        description: 'Prefer dependency-aware component and hook body ordering (experimental; no automatic reordering)',
    },
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
    if (node.body.type !== 'BlockStatement' || node.async || node.generator) {
        return false;
    }
    let parent = node.parent;
    let wrapped = node;
    while (parent.type === 'CallExpression' && ['memo', 'forwardRef'].includes(getCallName(parent, aliases)) && parent.arguments[0] === wrapped) {
        wrapped = parent;
        parent = parent.parent;
    }
    const id = (parent.type === 'VariableDeclarator' ? parent.id : null) || node.id;
    if (!id && parent.type === 'ExportDefaultDeclaration'
        && node.body.body.some(statement => statement.type === 'ReturnStatement' && statement.argument
            && ['JSXElement', 'JSXFragment'].includes(statement.argument.type))) {
        return true;
    }
    if (!id || id.type !== 'Identifier' || !/^(?:[A-Z]|use[A-Z0-9])/.test(id.name)) {
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
 * @param {Set<String>} inputs
 * @returns {Object|null}
 */
function classify(statement, aliases, inputs) {
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
    return {group: init.type === 'Identifier' && inputs.has(init.name) ? 0 : 3, hook: false};
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
    return variables.some(variable => variable.references.some(({identifier}) => identifier.range[0] >= statement.range[0] && identifier.range[1] <= statement.range[1]));
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
        const inputs = new Set(node.params.filter(param => param.type === 'Identifier').map(param => param.name));
        const classified = statements.map(statement => classify(statement, aliases, inputs));
        const variables = new Map();
        function declarations(statement) {
            if (!variables.has(statement)) {
                variables.set(statement, sourceCode.getDeclaredVariables(statement));
            }
            return variables.get(statement);
        }

        for (let index = 1; index < statements.length; index++) {
            const current = classified[index];
            if (!current) {
                continue;
            }
            const previous = classified[index - 1];
            if (!previous || previous.group <= current.group || (previous.hook && current.hook)) {
                continue;
            }
            if ((!current.hook && containsHook(statements[index], sourceCode.visitorKeys, aliases))
                || (!previous.hook && containsHook(statements[index - 1], sourceCode.visitorKeys, aliases))) {
                continue;
            }
            if (referencesStatement(declarations(statements[index - 1]), statements[index])
                || referencesStatement(declarations(statements[index]), statements[index - 1])) {
                continue;
            }
            context.report({
                node: statements[index],
                messageId: 'order',
                data: {group: GROUPS[current.group], previous: GROUPS[previous.group]},
            });

            // One adjacent movement at a time avoids incompatible advice around interleaved hook anchors.
            return;
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
                    if (imported === 'use' || /^use[A-Z0-9]/.test(imported) || imported === 'memo' || imported === 'forwardRef') {
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
