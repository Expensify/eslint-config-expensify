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

/** @param {Object} node @returns {String|null} */
function getCallName(node) {
    if (!node || node.type !== 'CallExpression') {
        return null;
    }
    const {callee} = node;
    if (callee.type === 'Identifier') {
        return callee.name;
    }
    if (callee.type === 'MemberExpression' && !callee.computed && callee.object.type === 'Identifier' && callee.object.name === 'React') {
        return callee.property.name;
    }
    return null;
}

/** @param {Object} node @returns {Boolean} */
function isHookCall(node) {
    const callName = getCallName(node);
    return callName === 'use' || /^use[A-Z0-9]/.test(callName || '');
}

/** @param {Object} node @returns {Boolean} */
function isCandidate(node) {
    if (node.body.type !== 'BlockStatement' || node.async || node.generator) {
        return false;
    }
    const id = node.id || (node.parent.type === 'VariableDeclarator' ? node.parent.id : null);
    if (!id || id.type !== 'Identifier' || !/^(?:[A-Z]|use[A-Z0-9])/.test(id.name)) {
        return false;
    }
    for (let parent = node.parent; parent; parent = parent.parent) {
        if (/Function/.test(parent.type)) {
            return false;
        }
    }
    return true;
}

/** @param {Object} statement @returns {Object|null} */
function classify(statement) {
    if (statement.type === 'ReturnStatement') {
        return {group: 6, hook: false};
    }
    if (statement.type === 'FunctionDeclaration') {
        return {group: 4, hook: false};
    }
    if (statement.type === 'ExpressionStatement' && isHookCall(statement.expression)) {
        return {group: HOOK_GROUPS.get(getCallName(statement.expression)) || 0, hook: true};
    }
    if (statement.type !== 'VariableDeclaration' || statement.kind !== 'const' || statement.declarations.length !== 1) {
        return null;
    }
    const {init} = statement.declarations[0];
    if (!init) {
        return null;
    }
    if (isHookCall(init)) {
        return {group: HOOK_GROUPS.get(getCallName(init)) || 0, hook: true};
    }
    if (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression') {
        return {group: 4, hook: false};
    }
    return {group: 3, hook: false};
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

    function check(node) {
        if (!isCandidate(node)) {
            return;
        }
        const statements = node.body.body;
        const classified = statements.map(classify);
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
            if (referencesStatement(declarations(statements[index - 1]), statements[index])
                || referencesStatement(declarations(statements[index]), statements[index - 1])) {
                continue;
            }
            context.report({
                node: statements[index],
                messageId: 'order',
                data: {group: GROUPS[current.group], previous: GROUPS[previous.group]},
            });
        }
    }

    return {
        FunctionDeclaration: check,
        FunctionExpression: check,
        ArrowFunctionExpression: check,
    };
}

export {name, meta, create};
