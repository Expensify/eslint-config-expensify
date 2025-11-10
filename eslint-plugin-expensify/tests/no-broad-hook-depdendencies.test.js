import { RuleTester } from "eslint";
import * as rule from "../no-broad-hook-dependencies.js";
import CONST from "../CONST.js";

const message = CONST.MESSAGE.NO_BROAD_HOOK_DEPENDENCIES;

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

ruleTester.run("no-broad-hook-dependencies", rule, {
  valid: [
    // useEffect with specific property dependency
    {
      code: `
                useEffect(() => {
                    console.log(transactionItem.isAmountColumnWide);
                }, [transactionItem.isAmountColumnWide]);
            `,
    },
    // Multiple specific properties from same object
    {
      code: `
                useEffect(() => {
                    console.log(obj.propA, obj.propB);
                }, [obj.propA, obj.propB]);
            `,
    },
    // Nested property access
    {
      code: `
                useEffect(() => {
                    console.log(user.profile.name);
                }, [user.profile.name]);
            `,
    },
    // Empty dependency array
    {
      code: `
                useEffect(() => {
                    console.log('mounted');
                }, []);
            `,
    },
    // Object used directly (not accessing properties)
    {
      code: `
                useEffect(() => {
                    doSomething(obj);
                }, [obj]);
            `,
    },
    // Destructured variable used
    {
      code: `
                useEffect(() => {
                    const { isWide } = transactionItem;
                    console.log(isWide);
                }, [transactionItem]);
            `,
    },
    // Computed property access
    {
      code: `
                useEffect(() => {
                    console.log(obj['computed']);
                }, [obj]);
            `,
    },
    // Method calls are valid - depend on object, not the method
    {
      code: `
                useCallback(() => {
                    const filtered = selectedMembers.filter((id) => id > 0);
                    setSelectedMembers([]);
                }, [selectedMembers, setSelectedMembers]);
            `,
    },
  ],
  invalid: [
    // useEffect with entire object when only property is used
    {
      code: `
                useEffect(() => {
                    console.log(transactionItem.isAmountColumnWide);
                }, [transactionItem]);
            `,
      errors: [
        {
          message,
        },
      ],
    },
    // Multiple properties accessed but whole object in deps
    {
      code: `
                useEffect(() => {
                    console.log(obj.propA, obj.propB);
                }, [obj]);
            `,
      errors: [
        {
          message,
        },
      ],
    },
    // Nested property accessed but root object in deps
    {
      code: `
                useEffect(() => {
                    console.log(user.profile.name);
                }, [user]);
            `,
      errors: [
        {
          message,
        },
      ],
    },
    // Multiple independent objects with property access
    {
      code: `
                useEffect(() => {
                    console.log(obj1.prop, obj2.prop);
                }, [obj1, obj2]);
            `,
      errors: [{ message }, { message }],
    },
  ],
});
