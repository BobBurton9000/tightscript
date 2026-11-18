# Tightscript

Tightscript is a strict pass/fail policy gate for TypeScript projects. This README is for project maintainers who need to install it, select the source files to check, and run the policy gate. Tightscript checks the `.ts` and `.tsx` files selected by `tightscript.config.json` and exits non-zero for policy violations, configuration errors, or incomplete evaluation.

## Quick start

Tightscript requires Node.js 24.x or 26.x and uses the consuming project's TypeScript version (>=5.9 and <7).

```sh
npm install --save-dev tightscript typescript
npx tightscript init
```

`init` creates `tightscript.config.json` with patterns for all `.ts` and `.tsx` files under the current directory. It will not replace an existing configuration. Review the generated scope and narrow it to authored source before the first check if the project contains dependency or generated TypeScript; the default patterns can match those files too.

For example, then run:

```sh
npx tightscript
```

Add a script so the check is easy to run locally and in CI:

```json
{
  "scripts": {
    "check:tightscript": "tightscript"
  }
}
```

Then run `npm run check:tightscript`.

## Select the source files

The configuration accepts only a non-empty `include` array of positive patterns, evaluated relative to the directory where Tightscript is invoked:

```json
{
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

Choose patterns that include all authored TypeScript you intend to check and do not include dependencies or generated output. Patterns are positive-only, so choose source roots that leave those directories out. Tightscript does not support rule switches, exclusions, per-file exceptions, or suppression directives.

## Write code that passes

Tightscript enforces fixed rules for file structure, declarations, types, exports, comments, and source style. The full practical guide is [Writing TypeScript that passes Tightscript](docs/writing-code-that-passes-tightscript.md). It explains the rules, gives compliant examples, and links to the detailed policy pages in `bin/`.

A Tightscript `PASS` means its configured checks completed without a finding. It is not a replacement for the project's TypeScript type-check, tests, build, or framework tooling; run those checks separately.

## Contribute to Tightscript

Install the development dependencies and run the test suite:

```sh
npm ci
npm test
```
