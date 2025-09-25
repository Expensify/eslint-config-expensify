import {ESLintUtils} from '@typescript-eslint/utils';
import lodashGet from 'lodash/get.js';
import {isInTestFile} from './utils/index.js';
import {isString} from './utils/typeUtil.js';
import CONST from './CONST.js';

const message = CONST.MESSAGE.PREFER_LOCALE_COMPARE_FROM_CONTEXT;

function isLocaleCompareMethod(node) {
    return lodashGet(node, 'callee.type') === 'MemberExpression'
        && lodashGet(node, 'callee.property.name') === 'localeCompare';
}

const name = 'prefer-locale-compare-from-context';

const meta = {
    type: 'problem',
    docs: {
        description: message,
    },
};

function create(context) {
    const parserServices = ESLintUtils.getParserServices(context);
    const typeChecker = parserServices.program.getTypeChecker();

    function isUsingIncorrectLocaleCompareMethod(node) {
        if (!isLocaleCompareMethod(node)) {
            return false;
        }

        const objectNode = node.callee.object;
        if (!objectNode) {
            return false;
        }

        const objectTsNode = parserServices.esTreeNodeToTSNodeMap.get(objectNode);
        const objectType = typeChecker.getTypeAtLocation(objectTsNode);
        return isString(objectType);
    }

    return {
        CallExpression(node) {
            if (isInTestFile(context.filename)) {
                return;
            }

            if (!isUsingIncorrectLocaleCompareMethod(node)) {
                return;
            }

            context.report({
                node,
                message,
            });
        },
    };
}

export {name, meta, create};
