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
    },
    {
      // Valid: Actions context with useState setter (setSplashScreenState from [state, setState] = useState())
      code: `
                function SplashScreenContextProvider({children}) {
                    const [splashScreenState, setSplashScreenState] = useState(initialState);
                    const stateValue = { splashScreenState };
                    const actionsValue = { setSplashScreenState };
                    return (
                        <SplashScreenStateContext.Provider value={stateValue}>
                            <SplashScreenActionsContext.Provider value={actionsValue}>
                                {children}
                            </SplashScreenActionsContext.Provider>
                        </SplashScreenStateContext.Provider>
                    );
                }
            `
    },
    {
      // Valid: Actions context with React.useState setter
      code: `
                function MyContextProvider({children}) {
                    const [count, setCount] = React.useState(0);
                    const actionsValue = { setCount };
                    return (
                        <MyActionsContext.Provider value={actionsValue}>
                            {children}
                        </MyActionsContext.Provider>
                    );
                }
            `
    },
    {
      // Valid: Actions context with MemberExpression (setter from object) - property name looks like function
      code: `
                function MyContextProvider({children}) {
                    const setters = { setSplashScreenState: () => {} };
                    const actionsValue = { setSplashScreenState: setters.setSplashScreenState };
                    return (
                        <MyActionsContext.Provider value={actionsValue}>
                            {children}
                        </MyActionsContext.Provider>
                    );
                }
            `
    },
    {
      // Valid: Generic context with only data (no naming convention enforced)
      code: `
                function AttachmentProvider({children}) {
                    const attachment = { id: 1, name: 'file.pdf' };
                    return (
                        <AttachmentContext.Provider value={attachment}>
                            {children}
                        </AttachmentContext.Provider>
                    );
                }
            `
    },
    {
      // Valid: Generic context with only data (object with multiple data props)
      code: `
                function CurrentUserPersonalDetailsProvider({children}) {
                    const userPersonalDetails = { name: 'John', email: 'john@example.com' };
                    return (
                        <CurrentUserPersonalDetailsContext.Provider value={userPersonalDetails}>
                            {children}
                        </CurrentUserPersonalDetailsContext.Provider>
                    );
                }
            `
    },
    {
      // Valid: Generic context with only functions
      code: `
                function MyContextProvider({children}) {
                    const handleClick = () => {};
                    const onSubmit = () => {};
                    const value = { handleClick, onSubmit };
                    return (
                        <MyContext.Provider value={value}>
                            {children}
                        </MyContext.Provider>
                    );
                }
            `
    }
  ],
  invalid: [
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
          messageId: "contextMixesDataAndFunctions",
          data: {
            contextName: "MyStateContext.Provider"
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
          messageId: "contextMixesDataAndFunctions",
          data: {
            contextName: "MyActionsContext.Provider"
          }
        }
      ]
    },
    {
      // Invalid: Generic context (mixed data and functions)
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
          messageId: "contextMixesDataAndFunctions",
          data: {
            contextName: "MyContext.Provider"
          }
        }
      ]
    },
    {
      // Invalid: SearchContext (mixed data and functions)
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
          messageId: "contextMixesDataAndFunctions",
          data: {
            contextName: "SearchContext.Provider"
          }
        }
      ]
    },
    {
      // Invalid: ThemeContext (mixed data and functions)
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
          messageId: "contextMixesDataAndFunctions",
          data: {
            contextName: "ThemeContext.Provider"
          }
        }
      ]
    },
    {
      // Invalid: State context with spread that includes functions (mixed)
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
          messageId: "contextMixesDataAndFunctions",
          data: {
            contextName: "MyStateContext.Provider"
          }
        }
      ]
    },
    {
      // Invalid: Actions context with spread that includes non-functions (mixed)
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
          messageId: "contextMixesDataAndFunctions",
          data: {
            contextName: "MyActionsContext.Provider"
          }
        }
      ]
    }
  ]
});
