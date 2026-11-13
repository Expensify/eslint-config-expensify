/* eslint-disable rulesdir/prefer-underscore-method -- Node-only tooling, so native array methods are fine */
/** The React Compiler rules of eslint-plugin-react-hooks (v7): every rule of the installed plugin except the two classic ones. */
import {getPluginRules} from './hosting.js';

const CLASSIC_REACT_HOOKS_RULES = new Set(['rules-of-hooks', 'exhaustive-deps']);
const reactCompilerRuleNames = Object.keys(getPluginRules('react-hooks')).filter(name => !CLASSIC_REACT_HOOKS_RULES.has(name));

export {CLASSIC_REACT_HOOKS_RULES, reactCompilerRuleNames};
