/**
 * The React Compiler rules of eslint-plugin-react-hooks (v7): every rule of the plugin except the two classic ones. The
 * plugin builds its rule list from the compiler's own error categories, so a new compiler rule shows up here after a
 * plugin upgrade, and `convertPresets` fails on one it does not know instead of silently running it.
 */
import {getPluginRules} from './hosting.mjs';

const CLASSIC_REACT_HOOKS_RULES = new Set(['rules-of-hooks', 'exhaustive-deps']);
const reactCompilerRuleNames = Object.keys(getPluginRules('react-hooks')).filter(name => !CLASSIC_REACT_HOOKS_RULES.has(name));

export {CLASSIC_REACT_HOOKS_RULES, reactCompilerRuleNames};
