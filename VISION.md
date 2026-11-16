# Tightscript Vision

## What Tightscript should be

Tightscript is a strict, opinionated pass/fail gate for TypeScript projects. Its purpose is to make it harder for unsafe, opaque, or needlessly complicated code—including AI-generated code—to pass review unnoticed.

The intended user experience is one command that checks the project and either passes or fails. The policy belongs to Tightscript, not to a project-local collection of rule settings. Users should not be able to select individual rules, configure their thresholds, add per-file exceptions, or suppress violations in source comments. The implementation may use existing tools such as the TypeScript compiler and a lint engine; choosing those tools is not settled here.

The checker should also support useful embedded documentation, but source comments are allowed only in the form of `@see` comments linking to Markdown files tracked in the repository. For example: `// @see [Configuration guide](../docs/guide.md#configuration)`. The comment must contain only the `@see` link, without additional prose. Link paths are relative to the source file and must resolve inside the repository to a git-tracked Markdown file. If a link has a heading fragment, that heading must exist in the target document. Tightscript must validate these links as part of its check; this is a built-in policy, not a per-project exception mechanism.

The gate only provides enforcement when it actually runs. A project’s CI should run it as a required check; protecting CI and the checker itself is outside the lint rules below.

## Candidate requirements from the existing Bob rules

These are plain-language translations of the 19 rules currently exported by `eslint-plugin-bob-style`. Defaults are called out where the existing rule has configurable options. The current plugin’s configurability is not a proposal for Tightscript to expose those options.

### Modules and exports

1. **Name files after their exported declarations.** An exported, named class or interface must have the same name as its file’s basename. A file named `index` is exempt. The current rule applies to `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, and `.cjs` files.

2. **Keep each file focused.** A file may contain at most 500 effective lines by default. Lines occupied only by import declarations do not count; other lines, including blank and comment-only lines, do. The existing rule allows its limit to be configured, but Tightscript’s limit would need to be fixed by policy.

3. **Put at most one class or interface in a file.** Count class declarations, class expressions, and interface declarations across the file. No more than one may appear in a file.

4. **Export behavior through classes, not standalone callables.** Do not directly export standalone functions or callable values; encapsulate behavior in a class and export the class instead. This also applies to named re-exports and `export *` when TypeScript type information can establish that the exported value is callable. Type-only exports are not callable-value exports.

5. **Do not pass imports straight through as exports.** Do not import a value only to re-export it unchanged, or to export a trivial object/spread wrapper made only from such values. Import it where it is needed, or add real local behavior before exporting it. The existing rule does not treat every source re-export form as a passthrough.

6. **Declare local exports inline.** Prefer `export class Model {}` to a separate local `export { Model }` list. The current rule skips re-exports that name a source module.

7. **Do not export constant object-shaped values.** Do not directly export a `const` initialized with an object literal, a class instance (`new ...`), or `Object.freeze({ ... })`; likewise, do not default-export those expressions. Use a class or enum for this kind of exported value.

### Classes and interfaces

8. **Keep class instance state private.** Class instance properties and accessors, including abstract properties, must be private. Constructor parameter properties must also be private. JavaScript `#private` members count as private. The existing rule does not check static members.

9. **Keep interfaces method-only.** An interface may declare methods, but not data properties, index signatures, call signatures, or construct signatures. A property whose value is a function type is still a property, not a method.

10. **Do not make interfaces callable.** An interface must not define a call signature. Use named methods instead. This overlaps with the method-only-interface requirement but is a separate existing rule.

11. **Do not extend `CallableFunction`.** Interfaces must not extend `CallableFunction`; describe behavior with explicit named methods instead.

12. **Use named object structures in function contracts.** Do not write anonymous object type literals within function parameter or return type annotations. Give the structure a named interface or class instead.

13. **Do not use intersection annotations for properties or parameters.** A property type or function parameter type must not be written as an intersection such as `A & B`. Define an interface that extends the required contracts instead. The existing rule targets property and parameter annotations, not every occurrence of an intersection type.

14. **Do not declare TypeScript type aliases.** Use a class, interface, or enum instead.

15. **Do not declare TypeScript union types.** Model the alternatives with the project’s approved named structures instead. This requirement applies to union type syntax wherever it occurs.

### Naming and control flow

16. **Do not begin function or method names with `get`.** Use a name that describes the behavior or value without the `get` prefix. The existing rule recognizes function declarations, function-valued variables, object methods/properties, and class methods; it does not cover every possible TypeScript signature form.

17. **Do not use `else` branches.** This includes `else if`. Prefer early returns or conditional expressions.

### Readability and layout

18. **Put each parameter on its own line.** In any function or callable signature with two or more parameters, each parameter must occupy a separate line, with the opening and closing parentheses on lines separate from the parameters. The existing ESLint rule can automatically fix whitespace in many cases.

19. **Extract repeated string literals.** By default, if the same string literal of at least three characters appears at least three times in one file, define a named constant and reuse it. The existing rule ignores module specifiers, property and method keys, enum members, TypeScript literal types, and certain comparisons against `typeof` results. Its threshold and minimum length are configurable today; Tightscript would need to choose fixed values.

## Existing supplementary restriction

The Bob package also exports an **opt-in** restriction, separate from its 19 plugin rules: disallow static class fields, static methods, and static initialization blocks. The rationale is to favor instance behavior or module-level composition. Decide whether this belongs in Tightscript’s required policy; it is not currently automatically enabled by the plugin.

## Comments and documentation links

The 19 Bob rules above do not include a no-comments rule. Tightscript allows no ordinary source comments: the only acceptable comments are `@see` comments containing a single Markdown link, with no explanatory text. The link must target a Markdown file tracked by Git in this repository, using a path relative to the source file; links outside the repository and links to untracked or non-Markdown files are invalid. A heading fragment is optional, but when present it must resolve to a heading in the target Markdown file (using that file's Markdown heading anchors). Tightscript must report links with missing files or headings as violations. Suppression directives must not become a way to bypass the pass/fail gate.

## Review checkpoint

Before implementation begins, review each numbered requirement and the supplementary restriction. Mark each as **keep**, **change**, or **drop**. Tightscript should implement only the reviewed policy, rather than treating the current Bob rule set as automatically approved.
