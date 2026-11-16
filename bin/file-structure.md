# Tightscript File Structure

For maintainers changing file-level policies, this page records the approved basename, effective-line, and declaration-count contracts.

## Approved requirements

### TIGHTSCRIPT-REQ-015

- **Title:** Exported named classes and interfaces match their file basename

WHEN a checked file contains an exported named class or interface whose name does not exactly match the file basename, THE SYSTEM SHALL report a violation, unless the basename is `index`.

### TIGHTSCRIPT-REQ-016

- **Title:** Checked files do not exceed 600 effective lines

WHEN a checked file has more than 600 effective lines, THE SYSTEM SHALL report a violation. A line occupied only by an import declaration does not count; all other lines, including blank and comment-only lines, count.

### TIGHTSCRIPT-REQ-017

- **Title:** Each file contains at most one class or interface

WHEN a checked file contains more than one class declaration, class expression, or interface declaration in total, THE SYSTEM SHALL report a violation.
