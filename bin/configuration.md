# Tightscript Configuration

For maintainers changing configuration loading or initialization, this page records the approved configuration constraints and tested initialization invariants.

## Approved requirements

### TIGHTSCRIPT-REQ-008

- **Title:** Configuration cannot weaken the fixed policy

A Tightscript-specific configuration MUST NOT allow users to select or configure rules, change policy thresholds, exclude individual files, add per-file policy exceptions, or suppress violations. Its file-scope settings MAY select files using include patterns only.

### TIGHTSCRIPT-REQ-037

- **Title:** Init creates a default scope for every TypeScript file

WHEN a user invokes the configuration-generation command and no Tightscript configuration file exists for the project, THE SYSTEM SHALL create a default Tightscript configuration whose source-scope patterns select every `.ts` and `.tsx` file under the process current working directory (CWD), evaluated according to REQ-006.

### TIGHTSCRIPT-REQ-038

- **Title:** Init does not modify an existing configuration

IF the configuration-generation command is invoked while a Tightscript configuration file already exists for the project, THEN THE SYSTEM SHALL fail without modifying or replacing the existing file.

### TIGHTSCRIPT-REQ-039

- **Title:** A non-empty Tightscript source scope is required

A Tightscript configuration file MUST be present for the project being checked. IF no Tightscript configuration file is present, or its source-scope setting is absent or supplies no include patterns, THEN THE SYSTEM SHALL fail fast and report a source-scope configuration error; it MUST NOT fall back to the TypeScript project configuration or treat the scope as an empty file selection.

## Correctness properties

### TIGHTSCRIPT-PROP-REQ-008-01

- **Sources:** `REQ-008`
- **Living requirements:** [Tightscript: configuration cannot weaken the fixed policy](./configuration.md#tightscript-req-008)
- **Title:** Configuration cannot weaken the fixed policy
- **Preconditions:** A checked source file has a known policy violation and is selected by the configured include patterns.
- **Input or state space:** Configuration attempts to select or configure rules, change thresholds, exclude individual files, add per-file exceptions, or suppress violations; valid include-pattern source-scope settings.
- **Invariant:** Configuration cannot weaken the built-in policy through rule or threshold changes, individual-file exclusions or exceptions, or suppression. Include patterns are the permitted source-scope control.
- **Boundaries:** For each attempted weakening, the check either rejects the configuration or still reports the known violation; legitimate include-pattern selection remains permitted.
- **Test evidence:** `test/cli-config-property.test.js` — `PROP-REQ-008-01` cases reject prohibited settings and confirm positive include selection remains usable.

### TIGHTSCRIPT-PROP-REQ-037-01

- **Sources:** `REQ-037`, `REQ-006`, `REQ-039`
- **Living requirements:** [Tightscript: init creates a default scope for every TypeScript file](./configuration.md#tightscript-req-037); [Tightscript: include patterns select every matching TypeScript source relative to invocation CWD](./source-scope.md#tightscript-req-006); [Tightscript: a non-empty Tightscript source scope is required](./configuration.md#tightscript-req-039)
- **Title:** Init creates a complete default source scope
- **Preconditions:** The configuration-generation command is invoked when no Tightscript configuration exists for the project.
- **Input or state space:** A project tree containing root and nested `.ts` and `.tsx` files, and a tree with no TypeScript files.
- **Invariant:** Initialization creates a Tightscript configuration with a non-empty source-scope setting whose patterns select every `.ts` and `.tsx` file under the process CWD, evaluated relative to that CWD.
- **Boundaries:** Exercise both extensions at the CWD root and in nested directories. When no TypeScript files exist, the generated source-scope setting remains non-empty.
- **Test evidence:** `test/cli-init-source-scope-property.test.js` — `PROP-REQ-037-01` cases verify root and nested `.ts`/`.tsx` violations and a non-empty scope for an empty source tree.

### TIGHTSCRIPT-PROP-REQ-038-01

- **Sources:** `REQ-038`
- **Living requirements:** [Tightscript: init does not modify an existing configuration](./configuration.md#tightscript-req-038)
- **Title:** Init preserves an existing configuration
- **Preconditions:** The configuration-generation command is invoked while the project's Tightscript configuration file already exists.
- **Input or state space:** Existing configuration contents and the initialization attempt.
- **Invariant:** Initialization fails without modifying or replacing the existing configuration.
- **Boundaries:** Exercise existing valid and malformed configuration contents; assert that the command fails and the file remains byte-for-byte unchanged.
- **Test evidence:** `test/cli-init-property.test.js` — `PROP-REQ-038-01` tests `init preserves an existing valid configuration` and `init preserves an existing malformed configuration`.
