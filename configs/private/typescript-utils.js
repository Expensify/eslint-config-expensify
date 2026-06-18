/**
 * Merge `rules` objects from flat-config arrays exported by our private configs.
 *
 * @param {...Array<object>} configArrays
 * @returns {object}
 */
function mergeConfigRules(...configArrays) {
    return Object.assign(
        {},
        ...configArrays.flatMap((configArray) => configArray
            .filter((entry) => entry.rules)
            .map((entry) => entry.rules)),
    );
}

export default mergeConfigRules;
