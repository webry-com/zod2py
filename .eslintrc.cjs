/* eslint-env node */
require("@rushstack/eslint-patch/modern-module-resolution")

/** @type {import("eslint/lib/cli-engine/cli-engine")} */
module.exports = {
  root: true,
  extends: [
    "eslint:recommended",
    "prettier",
  ],
  parserOptions: {
    ecmaVersion: "latest",
  },
  rules: {
    "no-debugger": "warn",
  },
}
