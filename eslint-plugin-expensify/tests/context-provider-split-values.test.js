import { RuleTester } from "eslint";
import * as rule from "../context-provider-split-values.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: {
        jsx: true
      }
    }
  }
});

ruleTester.run("context-provider-split-values", rule, {
  valid: [
    {
      // Valid: State context with only data values
      code: `
                function MyContextProvider({children}) {
                    const isLoading = true;
                    const count = 5;
                    const stateContextValue = { isLoading, count };
                    return (
                        <MyStateContext.Provider value={stateContextValue}>
                            {children}
                        </MyStateContext.Provider>
                    );
                }
            `
    },
    {
      // Valid: Actions context with only functions
      code: `
                function MyContextProvider({children}) {
                    const handleClick = () => {};
                    const onSubmit = () => {};
                    const actionsContextValue = { handleClick, onSubmit };
                    return (
                        <MyActionsContext.Provider value={actionsContextValue}>
                            {children}
                        </MyActionsContext.Provider>
                    );
                }
            `
    },
    {
      // Valid: Both contexts properly split
      code: `
                function SearchRouterContextProvider({children}) {
                    const isSearchRouterDisplayed = true;
                    const openSearchRouter = () => {};
                    const closeSearchRouter = () => {};

                    const stateContextValue = { isSearchRouterDisplayed };
                    const actionsContextValue = { openSearchRouter, closeSearchRouter };

                    return (
                        <SearchRouterStateContext.Provider value={stateContextValue}>
                            <SearchRouterActionsContext.Provider value={actionsContextValue}>
                                {children}
                            </SearchRouterActionsContext.Provider>
                        </SearchRouterStateContext.Provider>
                    );
                }
            `
    },
    {
      // Valid: State context with inline object containing only data
      code: `
                function MyContextProvider({children}) {
                    return (
                        <MyStateContext.Provider value={{ count: 5, name: 'test' }}>
                            {children}
                        </MyStateContext.Provider>
                    );
                }
            `
    },
    {
      // Valid: Actions context with inline object containing only functions
      code: `
                function MyContextProvider({children}) {
                    return (
                        <MyActionsContext.Provider value={{ onClick: () => {}, onHover: () => {} }}>
                            {children}
                        </MyActionsContext.Provider>
                    );
                }
            `
    },
    {
      // Valid: State context with object and array data
      code: `
                function DataStateContextProvider({children}) {
                    const items = [1, 2, 3];
                    const config = { theme: 'dark' };
                    const stateValue = { items, config };
                    return (
                        <DataStateContext.Provider value={stateValue}>
                            {children}
                        </DataStateContext.Provider>
                    );
                }
            `
    },
    {
      // Valid: Non-context JSX elements are not checked
      code: `
                function MyComponent({children}) {
                    return (
                        <div>
                            <SomeComponent value={{ mixed: true, handler: () => {} }} />
                            {children}
                        </div>
                    );
                }
            `
    }
  ],
  invalid: [
    {
      // Invalid: State context contains a function
      code: `
                function MyContextProvider({children}) {
                    const handleClick = () => {};
                    const stateContextValue = { handleClick };
                    return (
                        <MyStateContext.Provider value={stateContextValue}>
                            {children}
                        </MyStateContext.Provider>
                    );
                }
            `,
      errors: [
        {
          messageId: "stateContextHasFunction",
          data: {
            contextName: "MyStateContext.Provider",
            properties: "handleClick"
          }
        }
      ]
    },
    {
      // Invalid: State context with inline function
      code: `
                function MyContextProvider({children}) {
                    return (
                        <MyStateContext.Provider value={{ onClick: () => {} }}>
                            {children}
                        </MyStateContext.Provider>
                    );
                }
            `,
      errors: [
        {
          messageId: "stateContextHasFunction",
          data: {
            contextName: "MyStateContext.Provider",
            properties: "onClick"
          }
        }
      ]
    },
    {
      // Invalid: Actions context contains a non-function value
      code: `
                function MyContextProvider({children}) {
                    const isLoading = true;
                    const actionsContextValue = { isLoading };
                    return (
                        <MyActionsContext.Provider value={actionsContextValue}>
                            {children}
                        </MyActionsContext.Provider>
                    );
                }
            `,
      errors: [
        {
          messageId: "actionsContextHasNonFunction",
          data: {
            contextName: "MyActionsContext.Provider",
            properties: "isLoading"
          }
        }
      ]
    },
    {
      // Invalid: Actions context with inline non-function value
      code: `
                function MyContextProvider({children}) {
                    return (
                        <MyActionsContext.Provider value={{ count: 5 }}>
                            {children}
                        </MyActionsContext.Provider>
                    );
                }
            `,
      errors: [
        {
          messageId: "actionsContextHasNonFunction",
          data: {
            contextName: "MyActionsContext.Provider",
            properties: "count"
          }
        }
      ]
    },
    {
      // Invalid: State context with multiple functions
      code: `
                function MyContextProvider({children}) {
                    const handleClick = () => {};
                    const onSubmit = () => {};
                    const stateContextValue = { handleClick, onSubmit };
                    return (
                        <MyStateContext.Provider value={stateContextValue}>
                            {children}
                        </MyStateContext.Provider>
                    );
                }
            `,
      errors: [
        {
          messageId: "stateContextHasFunction",
          data: {
            contextName: "MyStateContext.Provider",
            properties: "handleClick, onSubmit"
          }
        }
      ]
    },
    {
      // Invalid: Actions context with multiple non-function values
      code: `
                function MyContextProvider({children}) {
                    const count = 5;
                    const name = 'test';
                    const actionsContextValue = { count, name };
                    return (
                        <MyActionsContext.Provider value={actionsContextValue}>
                            {children}
                        </MyActionsContext.Provider>
                    );
                }
            `,
      errors: [
        {
          messageId: "actionsContextHasNonFunction",
          data: {
            contextName: "MyActionsContext.Provider",
            properties: "count, name"
          }
        }
      ]
    },
    {
      // Invalid: Mixed content in State context (function among data)
      code: `
                function MyContextProvider({children}) {
                    const isLoading = true;
                    const handleClick = () => {};
                    const stateContextValue = { isLoading, handleClick };
                    return (
                        <MyStateContext.Provider value={stateContextValue}>
                            {children}
                        </MyStateContext.Provider>
                    );
                }
            `,
      errors: [
        {
          messageId: "stateContextHasFunction",
          data: {
            contextName: "MyStateContext.Provider",
            properties: "handleClick"
          }
        }
      ]
    },
    {
      // Invalid: Mixed content in Actions context (data among functions)
      code: `
                function MyContextProvider({children}) {
                    const handleClick = () => {};
                    const count = 5;
                    const actionsContextValue = { handleClick, count };
                    return (
                        <MyActionsContext.Provider value={actionsContextValue}>
                            {children}
                        </MyActionsContext.Provider>
                    );
                }
            `,
      errors: [
        {
          messageId: "actionsContextHasNonFunction",
          data: {
            contextName: "MyActionsContext.Provider",
            properties: "count"
          }
        }
      ]
    },
    {
      // Invalid: Generic context (not State or Actions) must be split
      code: `
                function MyContextProvider({children}) {
                    const value = { data: 'test', handler: () => {} };
                    return (
                        <MyContext.Provider value={value}>
                            {children}
                        </MyContext.Provider>
                    );
                }
            `,
      errors: [
        {
          messageId: "contextMustBeSplit",
          data: {
            contextName: "MyContext.Provider"
          }
        }
      ]
    },
    {
      // Invalid: SearchContext (not split into State/Actions)
      code: `
                function SearchContextProvider({children}) {
                    const searchContext = { query: '', setQuery: () => {} };
                    return (
                        <SearchContext.Provider value={searchContext}>
                            {children}
                        </SearchContext.Provider>
                    );
                }
            `,
      errors: [
        {
          messageId: "contextMustBeSplit",
          data: {
            contextName: "SearchContext.Provider"
          }
        }
      ]
    },
    {
      // Invalid: ThemeContext (generic context without State/Actions naming)
      code: `
                function ThemeProvider({children}) {
                    return (
                        <ThemeContext.Provider value={{ theme: 'dark', toggle: () => {} }}>
                            {children}
                        </ThemeContext.Provider>
                    );
                }
            `,
      errors: [
        {
          messageId: "contextMustBeSplit",
          data: {
            contextName: "ThemeContext.Provider"
          }
        }
      ]
    },
    {
      // Invalid: State context with spread that includes functions
      code: `
                function MyContextProvider({children}) {
                    const actionsContextValue = {
                        openSearchRouter: () => {},
                        closeSearchRouter: () => {},
                    };
                    const stateContextValue = { isLoading: true };
                    const context = { ...actionsContextValue, ...stateContextValue };
                    return (
                        <MyStateContext.Provider value={context}>
                            {children}
                        </MyStateContext.Provider>
                    );
                }
            `,
      errors: [
        {
          messageId: "stateContextHasFunction",
          data: {
            contextName: "MyStateContext.Provider",
            properties: "openSearchRouter, closeSearchRouter"
          }
        }
      ]
    },
    {
      // Invalid: Actions context with spread that includes non-functions
      code: `
                function MyContextProvider({children}) {
                    const stateContextValue = { isLoading: true, count: 5 };
                    const actionsContextValue = { handleClick: () => {} };
                    const context = { ...stateContextValue, ...actionsContextValue };
                    return (
                        <MyActionsContext.Provider value={context}>
                            {children}
                        </MyActionsContext.Provider>
                    );
                }
            `,
      errors: [
        {
          messageId: "actionsContextHasNonFunction",
          data: {
            contextName: "MyActionsContext.Provider",
            properties: "isLoading, count"
          }
        }
      ]
    }
  ]
});
