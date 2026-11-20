# Writing TypeScript that passes Tightscript

This guide is for engineers writing `.ts` and `.tsx` source files in a Tightscript-checked project. Use it to choose source files correctly, write code within the fixed policy, and interpret a clean result. **Tightscript has no rule-disable or per-file exception configuration:** change the code to meet the policy, and use only the narrow React and Next.js exceptions described below.

## At a glance

- Run `npx tightscript` from the project directory after configuring the intended source scope.
- Keep files small, name exported classes and interfaces after their files, and keep non-DTO instance state private.
- Use named types, method-only interfaces, inline local exports, and early returns; do not use `let`, type aliases, unions, `else`, or standalone callable exports outside supported framework cases.
- Keep comments to a single valid `@see` Markdown link and extract eligible repeated string literals into a named constant.
- A `PASS` verifies Tightscript's policies, not the project's full type-check, tests, or build.

## 1. Check the intended source files

Tightscript requires a `tightscript.config.json` in the current working directory. Run `npx tightscript init` to create the default configuration:

```json
{
  "include": ["**/*.ts", "**/*.tsx"]
}
```

The include patterns are evaluated relative to the directory where the command runs. They are the only source-selection setting; the configuration must contain a non-empty array of positive patterns. The generated default is broad: discovery walks the current directory recursively and does not apply `.gitignore` or automatically skip dependency and generated directories. Replace it with positive patterns for authored source before running if those directories contain TypeScript files. For example, a project that keeps authored source under `src/` can use:

```json
{
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

Select the authored TypeScript you intend to enforce, and leave dependencies and generated output outside the scope. Do not add `exclude`, negated patterns, rule settings, per-file exceptions, or suppression comments. `init` refuses to overwrite an existing configuration, so edit that file directly when changing the source scope.

A valid include array that matches no files currently produces a clean result. Check that the patterns really select the files you intend; otherwise a `PASS` may not cover your source.

## 2. Keep declarations and files small

Tightscript applies these file-level rules:

- A file contains no more than **600 effective lines**. Import-only lines do not count; blank lines, comments, and all other lines do.
- A file contains at most one class declaration, class expression, or interface declaration in total.
- An exported named class or interface has the same name as its file basename, including case. `index.ts` and `index.tsx` are exempt from this name match.
- Class instance properties and accessors are private, including constructor parameter properties, unless the class meets the narrow DTO definition. JavaScript `#private` members count as private; static members are outside this rule.

For example, `src/Invoice.ts` can contain this class:

```ts
export class Invoice {
  private readonly totalAmount: number;

  constructor(
    amount: number,
    taxRate: number,
  ) {
    this.totalAmount = amount * taxRate;
  }

  total(): number {
    return this.totalAmount;
  }
}
```

The exported class matches the file name, the file contains one class, and its instance state is private. The two constructor parameters each have their own line, with the parentheses on separate lines.

A DTO is only a class whose instance properties are public constructor parameter properties, with no other non-static instance properties or accessors and no methods. A constructor is allowed. Any declared method, including a static method, removes the DTO exception; static properties and accessors are outside the private instance-state rule. Prefer private state unless the class intentionally has exactly this data-transfer shape.

## 3. Use named types and method-only interfaces

Write types within these boundaries:

- **Do not declare type aliases.** Tightscript reports every `type` alias declaration.
- **Do not use union syntax.** Every union type is prohibited, in every type position.
- **Use interfaces for methods only.** Interface data properties, function-valued properties, index signatures, call signatures, and construct signatures are prohibited. An interface also cannot acquire call or construct signatures through inheritance or extend `CallableFunction`.
- **Use named object structures in function contracts.** Function parameter and return annotations cannot contain anonymous object type literals. Use a named class or interface instead. Because interfaces cannot declare data properties, use a class when the named structure represents data.
- **Do not put a top-level intersection type in a property or function-parameter annotation.** Intersections in other contexts are not prohibited by this rule, but unions remain prohibited everywhere.

A method-only interface is valid, for example in `src/InvoiceWriter.ts`:

```ts
export interface InvoiceWriter {
  save(invoiceId: string): void;
}
```

When a function consumes or returns a data structure, name that structure rather than writing an anonymous object annotation. For example, use a class such as `Invoice` in the previous section instead of an annotation like `{ total: number }`.

## 4. Export named capabilities, not standalone functions or objects

Tightscript's export rules are intentionally restrictive:

- A standalone function or other callable value cannot be exported directly, through a named re-export, or through `export *`, unless that exact export qualifies for a supported React or Next.js exception. Type-only exports are not callable-value exports.
- Export local values where they are declared. Write `export const API_VERSION = "v1";`, not a local declaration followed by `export { API_VERSION }`.
- Do not export a `const` initialized with an object literal, class instance, or `Object.freeze({ ... })`. The same restriction applies when the binding is the target of a default export or one of those expressions is default-exported directly.
- Do not import a value solely to re-export it unchanged. Tightscript also rejects exported object or spread wrappers that contain only imported values and add no behaviour. A source-module re-export is outside this specific pass-through rule, but it remains subject to the callable-export rule.

Exported scalar constants and named classes or interfaces are not prohibited by these rules. For values that need behaviour, export a named class with methods rather than an object-shaped constant or an exported standalone function.

## 5. Follow the source-style rules

- **Do not use `let`.** This includes ordinary declarations and bindings in `for`, `for...of`, and `for...in` statements. Use `const` for bindings in compliant examples.
- **Do not write `else` or `else if`.** Use guard clauses and early returns to make branches explicit.
- **Do not start function or method names with lowercase `get`.** This includes function-valued variables and object properties or methods. Choose a name such as `readAccount` or `lookupAccount` instead. The supported Pages Router exception is limited to exact Next.js export bindings.
- **Put multi-parameter signatures on multiple lines.** For every function-like declaration, expression, type, or signature with two or more parameters, put each parameter on its own line, with the opening and closing parentheses on lines separate from the parameters. This rule applies to signatures and function definitions, not call expressions.

The `Invoice` example follows the multi-parameter layout rule. A call to its constructor may remain on one line; the policy concerns the declaration's parameter list, not the call.

## 6. Keep comments and repeated strings compliant

### Comments must be one `@see` link

Every comment in a selected source file must contain only one `@see` Markdown link, with no additional prose. The target path is relative to the source file and must resolve to a tracked Markdown file inside the repository. If the link includes a heading fragment, that heading must exist using GitHub-compatible anchor generation.

A comment has this form:

```ts
// @see [Relevant project rule](../docs/engineering-guide.md#relevant-heading)
```

The path and heading above are illustrative: replace them with a real tracked file and heading in your project. Do not add `TODO` prose, ordinary explanatory comments, `eslint-disable`, `@ts-ignore`, or other suppression directives. Suppression directives are violations and do not hide other findings.

### Extract eligible repeated literals

When the same eligible string value of at least three Unicode code points occurs at least three times across the selected files, replace every occurrence with one named constant. The count is global across the selected source set, not per file. Single- and double-quoted strings and template literals without substitutions count equally by their resulting value.

Module specifiers, `require()` arguments, property or method keys, TypeScript literal types, enum members, and strings directly compared with a `typeof` expression are excluded. The only additional exception is a bare top-level `use client` string-literal directive in the directive prologue of a selected `.ts` or `.tsx` file when the project has a resolved supported Next.js version; ordinary occurrences remain countable. No other literal exemptions apply. See the [detailed repeated-string policy](../bin/repeated-strings.md#nextjs-client-directive-exemption-req-001). Use a shared constant instead of repeating an eligible message or key in three or more places.

## 7. Use framework exceptions only when they are proven

React and Next.js support does not disable the general export or style policy:

- A React component export qualifies only when the consuming TypeScript checker accepts it as a JSX component and the callable implementation is local to the same file. An imported component or re-export does not qualify. React-only eligibility does not apply in a Next.js project context.
- The current Next.js table supports **16.x** only, with specific router, file-role, and export-name combinations. The callable implementation must be local to the file, and the checker must establish callability. Unsupported versions, roles, or names do not qualify; unresolved context fails closed.
- The lowercase `get` exception is narrower still: it applies only to exact local Pages Router exports in documented slots, such as `getStaticProps`, `getStaticPaths`, and `getServerSideProps`, when the resolved Next.js context and file role qualify.
- Every unrelated Tightscript rule continues to apply, including imported-value pass-throughs, inline local exports, type restrictions, comments, and file structure.

Do not rely on a filename, directory, JSX extension, or framework intention alone to obtain an exception. See the [React and Next.js compatibility contract](../bin/framework-compatibility.md) for the complete supported table and conditions.

## 8. Fix findings and run the other project checks

Run Tightscript from the project directory:

```sh
npx tightscript
```

A finding identifies the file, line, column, and requirement ID, for example `[REQ-009]` for a `let` declaration. Fix the source and rerun the command; policy settings and suppression comments cannot waive findings. Configuration, parse, or required semantic-analysis errors also fail the command instead of producing a misleading pass.

Tightscript uses the project's `tsconfig.json` options where available, but it is not a replacement for a full TypeScript type-check, test suite, production build, or framework-specific validation. Run those project checks separately.

## Final checklist

Before treating a check as useful evidence, confirm that:

- [ ] `tightscript.config.json` exists and includes all intended authored `.ts` and `.tsx` files.
- [ ] There are no `let` declarations, type aliases, union types, `else` branches, or unsupported lowercase `get` names.
- [ ] Files obey the declaration-count, basename, line-count, and class-state rules.
- [ ] Interfaces declare methods only; function contracts use named structures.
- [ ] Exports are inline where applicable and do not expose prohibited callable, object-shaped, or imported pass-through values.
- [ ] Every comment is one valid `@see` link, and eligible repeated strings use a shared constant.
- [ ] `npx tightscript` reports `PASS`, and separate type-check, test, build, and framework checks have also run.

## Detailed policy references

The `bin/` documents hold the detailed requirements and edge cases:

- [Configuration](../bin/configuration.md) and [source scope](../bin/source-scope.md)
- [File structure](../bin/file-structure.md) and [class instance state](../bin/class-state.md)
- [Exports](../bin/exports.md) and [imported values](../bin/imported-values.md)
- [Interfaces](../bin/interfaces.md), [type annotations](../bin/type-annotations.md), and [type syntax](../bin/type-syntax.md)
- [Syntax style](../bin/syntax-style.md), [comments and links](../bin/comment-policy.md), and [repeated strings](../bin/repeated-strings.md)
- [Diagnostics and command outcomes](../bin/diagnostics.md) and [framework compatibility](../bin/framework-compatibility.md)
