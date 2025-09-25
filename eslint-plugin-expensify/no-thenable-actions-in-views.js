import _ from 'underscore';
import lodashGet from 'lodash/get.js';
import path from 'path';
import {isReactViewFile} from './utils/index.js';
import CONST from './CONST.js';

const message = CONST.MESSAGE.NO_THENABLE_ACTIONS_IN_VIEWS;

function create(context) {
    const actionsNamespaces = [];
    return {
        // Using import declaration to create a map of all the imports for this file and which ones are "actions"
        ImportDeclaration(node) {
            const pathName = path.resolve(lodashGet(node, 'source.value'));
            if (!pathName || !pathName.includes('/actions/')) {
                return;
            }

            actionsNamespaces.push(_.last(pathName.split('/')));
        },
        MemberExpression(node) {
            if (!isReactViewFile(context.getFilename())) {
                return;
            }

            if (lodashGet(node, 'property.name') !== 'then') {
                return;
            }

            const actionModuleName = lodashGet(node, 'object.callee.object.name');
            if (!_.includes(actionsNamespaces, actionModuleName)) {
                return;
            }

            const actionMethodName = lodashGet(node, 'object.callee.property.name');
            context.report({
                node,
                message,
                data: {
                    method: `${actionModuleName}.${actionMethodName}()`,
                },
            });
        },
    };
}

// eslint-disable-next-line import/prefer-default-export
export {create};
