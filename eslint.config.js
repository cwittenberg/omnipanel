// eslint.config.js
export default [
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        global: "readonly",
        log: "readonly",
        logError: "readonly",
        print: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        console: "readonly"
      }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": "warn",
      "no-dupe-keys": "error",
      "no-const-assign": "error",
      "no-unreachable": "error"
    }
  }
];