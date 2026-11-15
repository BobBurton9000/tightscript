import assert from "node:assert/strict";
import test from "node:test";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { runCli } from "../test-support/run-cli.js";

function configureSourceScope(project) {
  project.writeFile(
    "tightscript.config.json",
    JSON.stringify({ include: ["src/**/*.ts", "src/**/*.tsx"] }),
  );
}

test("CLI rejects every selected type alias and union type [REQ-029, REQ-030]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/Aliases.ts",
    "type Plain = string;\n" +
      "type UnionAlias = string | number;\n" +
      "type ObjectAlias = { value: string | number };\n" +
      'const annotated: string | number = "value";\n' +
      "function parameterAndReturn(value: string | number): boolean | null { return true; }\n" +
      "const generic: Array<string | number> = [];\n" +
      "function constrained<T extends string | number>(value: T): T { return value; }\n" +
      "type Conditional<T> = T extends string | number ? true : false;\n" +
      "const asserted = null as string | number;\n" +
      'const tuple: [string | number, boolean] = ["", true];\n' +
      "type Callback = (value: string | number) => boolean;\n" +
      'const satisfied = "text" satisfies string | number;\n',
  );
  project.writeFile(
    "src/Widget.tsx",
    "type ComponentProps = { value: string | number };\n" +
      "type ComponentResult = string | number;\n" +
      "const view = null as string | number;\n",
  );
  project.writeFile(
    "outside/Unselected.ts",
    "type UnselectedAlias = string | number;\n",
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    [
      "src/Aliases.ts:1:1 [REQ-029] Type alias declarations are not permitted.",
      "src/Aliases.ts:2:1 [REQ-029] Type alias declarations are not permitted.",
      "src/Aliases.ts:2:19 [REQ-030] Union type syntax is not permitted.",
      "src/Aliases.ts:3:1 [REQ-029] Type alias declarations are not permitted.",
      "src/Aliases.ts:3:29 [REQ-030] Union type syntax is not permitted.",
      "src/Aliases.ts:4:18 [REQ-030] Union type syntax is not permitted.",
      "src/Aliases.ts:5:36 [REQ-030] Union type syntax is not permitted.",
      "src/Aliases.ts:5:54 [REQ-030] Union type syntax is not permitted.",
      "src/Aliases.ts:6:22 [REQ-030] Union type syntax is not permitted.",
      "src/Aliases.ts:7:32 [REQ-030] Union type syntax is not permitted.",
      "src/Aliases.ts:8:1 [REQ-029] Type alias declarations are not permitted.",
      "src/Aliases.ts:8:33 [REQ-030] Union type syntax is not permitted.",
      "src/Aliases.ts:9:26 [REQ-030] Union type syntax is not permitted.",
      "src/Aliases.ts:10:15 [REQ-030] Union type syntax is not permitted.",
      "src/Aliases.ts:11:1 [REQ-029] Type alias declarations are not permitted.",
      "src/Aliases.ts:11:25 [REQ-030] Union type syntax is not permitted.",
      "src/Aliases.ts:12:36 [REQ-030] Union type syntax is not permitted.",
      "src/Widget.tsx:1:1 [REQ-029] Type alias declarations are not permitted.",
      "src/Widget.tsx:1:32 [REQ-030] Union type syntax is not permitted.",
      "src/Widget.tsx:2:1 [REQ-029] Type alias declarations are not permitted.",
      "src/Widget.tsx:2:24 [REQ-030] Union type syntax is not permitted.",
      "src/Widget.tsx:3:22 [REQ-030] Union type syntax is not permitted.",
      "FAIL",
      "",
    ].join("\n"),
  );
});
