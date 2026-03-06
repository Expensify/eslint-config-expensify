import { RuleTester } from "eslint";
import * as rule from "../context-provider-split-values.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

ruleTester.run("context-provider-split-values", rule, {
  valid: [
    // ─── Data-only contexts ─────────────────────────────────────────────
    {
      code: `
        function MyProvider({children}) {
            const isLoading = true;
            const count = 5;
            const value = { isLoading, count };
            return (
                <MyContext.Provider value={value}>
                    {children}
                </MyContext.Provider>
            );
        }
      `,
    },
    {
      code: `
        function MyProvider({children}) {
            return (
                <MyContext.Provider value={{ count: 5, name: 'test' }}>
                    {children}
                </MyContext.Provider>
            );
        }
      `,
    },
    {
      code: `
        function DataProvider({children}) {
            const items = [1, 2, 3];
            const config = { theme: 'dark' };
            const value = { items, config };
            return (
                <DataContext.Provider value={value}>
                    {children}
                </DataContext.Provider>
            );
        }
      `,
    },

    // ─── Data-only via useState state variables (index 0) ───────────────
    {
      code: `
        function MyProvider({children}) {
            const [count, setCount] = useState(0);
            const [name, setName] = useState('');
            const value = { count, name };
            return (
                <MyContext.Provider value={value}>
                    {children}
                </MyContext.Provider>
            );
        }
      `,
    },

    // ─── Functions-only contexts ────────────────────────────────────────
    {
      code: `
        function MyProvider({children}) {
            const handleClick = () => {};
            const onSubmit = () => {};
            const value = { handleClick, onSubmit };
            return (
                <MyContext.Provider value={value}>
                    {children}
                </MyContext.Provider>
            );
        }
      `,
    },
    {
      code: `
        function MyProvider({children}) {
            return (
                <MyContext.Provider value={{ onClick: () => {}, onHover: () => {} }}>
                    {children}
                </MyContext.Provider>
            );
        }
      `,
    },

    // ─── Functions-only via useState setters (index 1) ──────────────────
    {
      code: `
        function MyProvider({children}) {
            const [count, setCount] = useState(0);
            const [name, setName] = useState('');
            const value = { setCount, setName };
            return (
                <MyActionsContext.Provider value={value}>
                    {children}
                </MyActionsContext.Provider>
            );
        }
      `,
    },

    // ─── Functions-only via useCallback ─────────────────────────────────
    {
      code: `
        function MyProvider({children}) {
            const handleClick = useCallback(() => {}, []);
            const onSubmit = useCallback(() => {}, []);
            const value = { handleClick, onSubmit };
            return (
                <MyContext.Provider value={value}>
                    {children}
                </MyContext.Provider>
            );
        }
      `,
    },

    // ─── Functions-only via useMemo returning a function ────────────────
    {
      code: `
        function MyProvider({children}) {
            const translate = useMemo(() => (key) => translations[key], []);
            const format = useMemo(() => (n) => n.toFixed(2), []);
            const value = { translate, format };
            return (
                <MyContext.Provider value={value}>
                    {children}
                </MyContext.Provider>
            );
        }
      `,
    },

    // ─── Functions-only via function declarations ───────────────────────
    {
      code: `
        function MyProvider({children}) {
            function handleClick() {}
            function onSubmit() {}
            const value = { handleClick, onSubmit };
            return (
                <MyContext.Provider value={value}>
                    {children}
                </MyContext.Provider>
            );
        }
      `,
    },

    // ─── Properly split state and actions ───────────────────────────────
    {
      code: `
        function SearchProvider({children}) {
            const [query, setQuery] = useState('');
            const [results, setResults] = useState([]);
            const handleSearch = useCallback(() => {}, []);

            const stateValue = { query, results };
            const actionsValue = { setQuery, handleSearch };

            return (
                <SearchStateContext.Provider value={stateValue}>
                    <SearchActionsContext.Provider value={actionsValue}>
                        {children}
                    </SearchActionsContext.Provider>
                </SearchStateContext.Provider>
            );
        }
      `,
    },

    // ─── Non-context JSX elements (not checked) ────────────────────────
    {
      code: `
        function MyComponent({children}) {
            return (
                <SomeComponent value={{ mixed: true, handler: () => {} }} />
            );
        }
      `,
    },
    {
      code: `
        function MyComponent({children}) {
            return <div value={{ data: 1, fn: () => {} }}>{children}</div>;
        }
      `,
    },

    // ─── Single non-object value (cannot mix) ───────────────────────────
    {
      code: `
        function MyProvider({children}) {
            const theme = 'dark';
            return (
                <ThemeContext.Provider value={theme}>
                    {children}
                </ThemeContext.Provider>
            );
        }
      `,
    },

    // ─── Context value wrapped in useMemo returning data-only object ────
    {
      code: `
        function MyProvider({children}) {
            const [count, setCount] = useState(0);
            const [name, setName] = useState('');
            const value = useMemo(() => ({ count, name }), [count, name]);
            return (
                <MyContext.Provider value={value}>
                    {children}
                </MyContext.Provider>
            );
        }
      `,
    },

    // ─── Context value from useMemo returning functions-only object ─────
    {
      code: `
        function MyProvider({children}) {
            const handleClick = useCallback(() => {}, []);
            const onSubmit = useCallback(() => {}, []);
            const value = useMemo(() => ({ handleClick, onSubmit }), [handleClick, onSubmit]);
            return (
                <MyContext.Provider value={value}>
                    {children}
                </MyContext.Provider>
            );
        }
      `,
    },

    // ─── React 19 shorthand <Context value={...}> with data-only ────────
    {
      code: `
        function MyProvider({children}) {
            const [count, setCount] = useState(0);
            const value = { count };
            return (
                <MyStateContext value={value}>
                    {children}
                </MyStateContext>
            );
        }
      `,
    },

    // ─── MemberExpression values with function-like names (actions-only) ─
    {
      code: `
        function MyProvider({children}) {
            const value = {
                setSplash: ref.current.setSplashScreenState,
                handleNav: utils.handleNavigation,
            };
            return (
                <MyContext.Provider value={value}>
                    {children}
                </MyContext.Provider>
            );
        }
      `,
    },

    // ─── Context without "Context" in name (not checked) ────────────────
    {
      code: `
        function MyProvider({children}) {
            return (
                <Theme.Provider value={{ data: 1, fn: () => {} }}>
                    {children}
                </Theme.Provider>
            );
        }
      `,
    },

    // ─── Empty value object ─────────────────────────────────────────────
    {
      code: `
        function MyProvider({children}) {
            return (
                <MyContext.Provider value={{}}>
                    {children}
                </MyContext.Provider>
            );
        }
      `,
    },

    // ─── React.useState setter ──────────────────────────────────────────
    {
      code: `
        function MyProvider({children}) {
            const [count, setCount] = React.useState(0);
            const value = { setCount };
            return (
                <MyContext.Provider value={value}>
                    {children}
                </MyContext.Provider>
            );
        }
      `,
    },

    // ─── Functions from custom hook destructuring (unresolvable) ─────────
    {
      code: `
        function ActionSheetProvider({children}) {
            const {currentState, transition, transitionWorklet, reset} = useWorkletStateMachine(config);
            const actionsValue = useMemo(() => ({
                transitionActionSheetState: transition,
                transitionActionSheetStateWorklet: transitionWorklet,
                resetStateMachine: reset,
            }), [reset, transition, transitionWorklet]);
            return (
                <ActionSheetActionsContext.Provider value={actionsValue}>
                    {children}
                </ActionSheetActionsContext.Provider>
            );
        }
      `,
    },

    // ─── Data with ConditionalExpression values ─────────────────────────
    {
      code: `
        function ScreenWrapper({children, includePaddingTop, includeSafeAreaPaddingBottom}) {
            const [didScreenTransitionEnd, setDidScreenTransitionEnd] = useState(false);
            const isSafeAreaTopPaddingApplied = includePaddingTop;
            const value = useMemo(
                () => ({
                    didScreenTransitionEnd,
                    isSafeAreaTopPaddingApplied,
                    isSafeAreaBottomPaddingApplied: isEdgeToEdge ? false : includeSafeAreaPaddingBottom,
                }),
                [didScreenTransitionEnd, isSafeAreaTopPaddingApplied, includeSafeAreaPaddingBottom]
            );
            return (
                <ScreenWrapperStatusContext.Provider value={value}>
                    {children}
                </ScreenWrapperStatusContext.Provider>
            );
        }
      `,
    },

    // ─── Data with function-like property names (addSafeAreaPadding is boolean!) ─
    {
      code: `
        function ScreenWrapper({children}) {
            const value = useMemo(() => {
                return {
                    addSafeAreaPadding: condition ? (x ?? true) : !y,
                    showOnSmallScreens: false,
                    showOnWideScreens: false,
                    originalValues: newOriginalValues,
                };
            }, []);
            return (
                <ScreenWrapperOfflineIndicatorContext.Provider value={value}>
                    {children}
                </ScreenWrapperOfflineIndicatorContext.Provider>
            );
        }
      `,
    },

    // ─── MemberExpression values from an object (video.play etc.) ────────
    {
      code: `
        function PlaybackProvider({children}) {
            const updateURL = useCallback(() => {}, []);
            const share = useCallback(() => {}, []);
            const [currentURL, setCurrentURL] = useState(null);
            const value = {
                updateURL,
                share,
                setCurrentURL,
                playVideo: video.play,
                pauseVideo: video.pause,
                replayVideo: video.replay,
                stopVideo: video.stop,
                checkIfPlaying: video.isPlaying,
                resetData: video.resetPlayerData,
                updateStatus,
            };
            return (
                <ContextActions.Provider value={value}>
                    {children}
                </ContextActions.Provider>
            );
        }
      `,
    },
  ],

  invalid: [
    // ─── Inline mixed: literal data + arrow function ────────────────────
    {
      code: `
        function MyProvider({children}) {
            return (
                <MyContext.Provider value={{ data: 'test', handler: () => {} }}>
                    {children}
                </MyContext.Provider>
            );
        }
      `,
      errors: [
        {
          messageId: "contextMixesDataAndFunctions",
          data: { contextName: "MyContext.Provider" },
        },
      ],
    },

    // ─── Mixed shorthand: data variable + function variable ─────────────
    {
      code: `
        function MyProvider({children}) {
            const isLoading = true;
            const handleClick = () => {};
            const value = { isLoading, handleClick };
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
          data: { contextName: "MyContext.Provider" },
        },
      ],
    },

    // ─── Mixed useState: state (index 0) + setter (index 1) ────────────
    {
      code: `
        function TravelCVVProvider({children}) {
            const [cvv, setCvv] = useState(null);
            const [isLoading, setIsLoading] = useState(false);
            const value = { cvv, isLoading, setCvv, setIsLoading };
            return (
                <TravelCVVContext.Provider value={value}>
                    {children}
                </TravelCVVContext.Provider>
            );
        }
      `,
      errors: [
        {
          messageId: "contextMixesDataAndFunctions",
          data: { contextName: "TravelCVVContext.Provider" },
        },
      ],
    },

    // ─── Mixed with useCallback ─────────────────────────────────────────
    {
      code: `
        function MyProvider({children}) {
            const count = 5;
            const handleClick = useCallback(() => {}, []);
            const value = { count, handleClick };
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
          data: { contextName: "MyContext.Provider" },
        },
      ],
    },

    // ─── Mixed with useMemo returning function ──────────────────────────
    {
      code: `
        function LocaleProvider({children}) {
            const [locale, setLocale] = useState('en');
            const translate = useMemo(() => (key) => translations[key], []);
            const value = { translate, preferredLocale: locale };
            return (
                <LocaleContext.Provider value={value}>
                    {children}
                </LocaleContext.Provider>
            );
        }
      `,
      errors: [
        {
          messageId: "contextMixesDataAndFunctions",
          data: { contextName: "LocaleContext.Provider" },
        },
      ],
    },

    // ─── Mixed via spread ───────────────────────────────────────────────
    {
      code: `
        function MyProvider({children}) {
            const actions = { openRouter: () => {}, closeRouter: () => {} };
            const state = { isLoading: true };
            const value = { ...actions, ...state };
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
          data: { contextName: "MyContext.Provider" },
        },
      ],
    },

    // ─── React 19 shorthand <XContext value={...}> with mixed ───────────
    {
      code: `
        function MyProvider({children}) {
            const [query, setQuery] = useState('');
            const value = { query, setQuery };
            return (
                <SearchContext value={value}>
                    {children}
                </SearchContext>
            );
        }
      `,
      errors: [
        {
          messageId: "contextMixesDataAndFunctions",
          data: { contextName: "SearchContext" },
        },
      ],
    },

    // ─── useMemo wrapping a mixed value object ──────────────────────────
    {
      code: `
        function MyProvider({children}) {
            const [locale, setLocale] = useState('en');
            const translate = useMemo(() => (key) => key, []);
            const value = useMemo(
                () => ({ translate, preferredLocale: locale }),
                [translate, locale]
            );
            return (
                <LocaleContext.Provider value={value}>
                    {children}
                </LocaleContext.Provider>
            );
        }
      `,
      errors: [
        {
          messageId: "contextMixesDataAndFunctions",
          data: { contextName: "LocaleContext.Provider" },
        },
      ],
    },

    // ─── Mixed with function declaration ────────────────────────────────
    {
      code: `
        function ThemeProvider({children}) {
            function toggleTheme() {}
            return (
                <ThemeContext.Provider value={{ theme: 'dark', toggleTheme }}>
                    {children}
                </ThemeContext.Provider>
            );
        }
      `,
      errors: [
        {
          messageId: "contextMixesDataAndFunctions",
          data: { contextName: "ThemeContext.Provider" },
        },
      ],
    },

    // ─── Mixed: inline function expression + inline literal ─────────────
    {
      code: `
        function SearchProvider({children}) {
            return (
                <SearchContext.Provider value={{ query: '', setQuery: () => {} }}>
                    {children}
                </SearchContext.Provider>
            );
        }
      `,
      errors: [
        {
          messageId: "contextMixesDataAndFunctions",
          data: { contextName: "SearchContext.Provider" },
        },
      ],
    },
  ],
});
