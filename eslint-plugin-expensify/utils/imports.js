/**
 * Adds a named import to the import statement or creates a new import statement if it doesn't exist.
 *
 * @param {Object} context - The ESLint rule context.
 * @param {Object} fixer - The ESLint fixer object.
 * @param {ASTNode} importNode - The import statement node.
 * @param {string} importName - The name of the import.
 * @param {string} importPath - The path of the import.
 * @param {boolean} [importAsType=false] - Whether the import should be treated as a type import.
 * @returns {Array} An array of fixes to be applied by the fixer.
 */
function addNamedImport(context, fixer, importNode, importName, importPath, importAsType = false) {
  const fixes = [];
  
  if (importNode) {
      const alreadyImported = importNode.specifiers.some(
          specifier => specifier.imported.name === importName
      );

      if(!alreadyImported) {
          const lastSpecifier = importNode.specifiers[importNode.specifiers.length - 1];

          // Add ValueOf to existing type-fest import
          fixes.push(fixer.insertTextAfter(lastSpecifier, `, ${importName}`));
      }
  } else {
      // Add import if it doesn't exist
      fixes.push(
          fixer.insertTextBefore(
              context.getSourceCode().ast.body[0],
              `import ${importAsType ? "type " : ""}{${importName}} from '${importPath}';\n`
          )
      );
  }

  return fixes;
}

module.exports = {
  addNamedImport
};
