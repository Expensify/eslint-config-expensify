/**
 * Expensify ESLint plugin - exports all custom rules under the "expensify" namespace.
 * Replaces eslint-plugin-rulesdir for ESLint 10 compatibility.
 */

import * as booleanConditionalRendering from './boolean-conditional-rendering.js';
import * as noAccSpreadInReduce from './no-acc-spread-in-reduce.js';
import * as noApiInViews from './no-api-in-views.js';
import * as noApiSideEffectsMethod from './no-api-side-effects-method.js';
import * as noBetaHandler from './no-beta-handler.js';
import * as noCallActionsFromActions from './no-call-actions-from-actions.js';
import * as noDeepEqualInMemo from './no-deep-equal-in-memo.js';
import * as noDefaultIdValues from './no-default-id-values.js';
import * as noDefaultProps from './no-default-props.js';
import * as noInlineNamedExport from './no-inline-named-export.js';
import * as noInlineUseOnyxSelector from './no-inline-useOnyx-selector.js';
import * as noMultipleApiCalls from './no-multiple-api-calls.js';
import * as noMultipleOnyxInFile from './no-multiple-onyx-in-file.js';
import * as noNegatedVariables from './no-negated-variables.js';
import * as noObjectKeysIncludes from './no-object-keys-includes.js';
import * as noOnyxConnect from './no-onyx-connect.js';
import * as noSetOrMapReturnInUseOnyxSelector from './no-set-or-map-return-in-useOnyx-selector.js';
import * as noThenableActionsInViews from './no-thenable-actions-in-views.js';
import * as noUnstableHookDefaults from './no-unstable-hook-defaults.js';
import * as noUseStateInitializerFunctions from './no-use-state-initializer-functions.js';
import * as noUselessCompose from './no-useless-compose.js';
import * as preferActionsSetData from './prefer-actions-set-data.js';
import * as preferAt from './prefer-at.js';
import * as preferEarlyReturn from './prefer-early-return.js';
import * as preferImportModuleContents from './prefer-import-module-contents.js';
import * as preferLocaleCompareFromContext from './prefer-locale-compare-from-context.js';
import * as preferLocalization from './prefer-localization.js';
import * as preferNarrowHookDependencies from './prefer-narrow-hook-dependencies.js';
import * as preferOnyxConnectInLibs from './prefer-onyx-connect-in-libs.js';
import * as preferShouldUseNarrowLayoutInsteadOfIsSmallScreenWidth from './prefer-shouldUseNarrowLayout-instead-of-isSmallScreenWidth.js';
import * as preferStrMethod from './prefer-str-method.js';
import * as preferTypeFest from './prefer-type-fest.js';
import * as preferUnderscoreMethod from './prefer-underscore-method.js';
import * as provideCanBeMissingInUseOnyx from './provide-canBeMissing-in-useOnyx.js';
import * as useDoubleNegationInsteadOfBoolean from './use-double-negation-instead-of-boolean.js';
import * as usePeriodsForErrorMessages from './use-periods-for-error-messages.js';

function ruleEntry(module) {
    return {
        meta: module.meta || {},
        create: module.create,
    };
}

export default {
    rules: {
        'boolean-conditional-rendering': ruleEntry(booleanConditionalRendering),
        'no-acc-spread-in-reduce': ruleEntry(noAccSpreadInReduce),
        'no-api-in-views': ruleEntry(noApiInViews),
        'no-api-side-effects-method': ruleEntry(noApiSideEffectsMethod),
        'no-beta-handler': ruleEntry(noBetaHandler),
        'no-call-actions-from-actions': ruleEntry(noCallActionsFromActions),
        'no-deep-equal-in-memo': ruleEntry(noDeepEqualInMemo),
        'no-default-id-values': ruleEntry(noDefaultIdValues),
        'no-default-props': ruleEntry(noDefaultProps),
        'no-inline-named-export': ruleEntry(noInlineNamedExport),
        'no-inline-useOnyx-selector': ruleEntry(noInlineUseOnyxSelector),
        'no-multiple-api-calls': ruleEntry(noMultipleApiCalls),
        'no-multiple-onyx-in-file': ruleEntry(noMultipleOnyxInFile),
        'no-negated-variables': ruleEntry(noNegatedVariables),
        'no-object-keys-includes': ruleEntry(noObjectKeysIncludes),
        'no-onyx-connect': ruleEntry(noOnyxConnect),
        'no-set-or-map-return-in-useOnyx-selector': ruleEntry(noSetOrMapReturnInUseOnyxSelector),
        'no-thenable-actions-in-views': ruleEntry(noThenableActionsInViews),
        'no-unstable-hook-defaults': ruleEntry(noUnstableHookDefaults),
        'no-use-state-initializer-functions': ruleEntry(noUseStateInitializerFunctions),
        'no-useless-compose': ruleEntry(noUselessCompose),
        'prefer-actions-set-data': ruleEntry(preferActionsSetData),
        'prefer-at': ruleEntry(preferAt),
        'prefer-early-return': ruleEntry(preferEarlyReturn),
        'prefer-import-module-contents': ruleEntry(preferImportModuleContents),
        'prefer-locale-compare-from-context': ruleEntry(preferLocaleCompareFromContext),
        'prefer-localization': ruleEntry(preferLocalization),
        'prefer-narrow-hook-dependencies': ruleEntry(preferNarrowHookDependencies),
        'prefer-onyx-connect-in-libs': ruleEntry(preferOnyxConnectInLibs),
        'prefer-shouldUseNarrowLayout-instead-of-isSmallScreenWidth': ruleEntry(preferShouldUseNarrowLayoutInsteadOfIsSmallScreenWidth),
        'prefer-str-method': ruleEntry(preferStrMethod),
        'prefer-type-fest': ruleEntry(preferTypeFest),
        'prefer-underscore-method': ruleEntry(preferUnderscoreMethod),
        'provide-canBeMissing-in-useOnyx': ruleEntry(provideCanBeMissingInUseOnyx),
        'use-double-negation-instead-of-boolean': ruleEntry(useDoubleNegationInsteadOfBoolean),
        'use-periods-for-error-messages': ruleEntry(usePeriodsForErrorMessages),
    },
};
