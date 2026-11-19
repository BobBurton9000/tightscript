import assert from "node:assert/strict";
import test from "node:test";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { runCli } from "../test-support/run-cli.js";

const PROPERTY_ID = "PROP-REQ-007-01";
const POLICY_INDEPENDENCE_PROPERTY_ID = "PROP-REQ-008-01";

function configureProject(project) {
  project.writeFile("package.json", JSON.stringify({ type: "module" }));
  project.writeFile(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        skipLibCheck: true,
      },
    }),
  );
  project.writeFile(
    "tightscript.config.json",
    JSON.stringify({
      include: [
        "app/**/*.ts",
        "app/**/*.tsx",
        "pages/**/*.ts",
        "pages/**/*.tsx",
      ],
    }),
  );
  project.writeFile(
    "node_modules/next/package.json",
    JSON.stringify({ name: "next", version: "16.2.0", main: "index.js" }),
  );
  project.writeFile("node_modules/next/index.js", "module.exports = {};\n");
}

function assertFailedCli(result) {
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /\nFAIL\n$/);
}

function assertFinding(result, requirementId, filePath, message) {
  assert.ok(
    result.stderr.split("\n").some(
      (line) =>
        line.startsWith(`${filePath}:`) &&
        line.includes(`[${requirementId}]`) &&
        line.includes(message),
    ),
    `expected [${requirementId}] ${message} in ${filePath}:\n${result.stderr}`,
  );
}

function assertNoFinding(result, requirementId, filePath, message) {
  assert.equal(
    result.stderr.split("\n").some(
      (line) =>
        line.startsWith(`${filePath}:`) &&
        line.includes(`[${requirementId}]`) &&
        line.includes(message),
    ),
    false,
    `unexpected [${requirementId}] ${message} in ${filePath}:\n${result.stderr}`,
  );
}

test(`[${PROPERTY_ID}] an eligible App Router export does not suppress independent export and import policies`, (t) => {
  const project = createTemporaryProject(t);
  configureProject(project);
  project.writeFile(
    "support/values.ts",
    "export const unchangedValue = 1;\n" +
      "export const wrappedValue = 2;\n",
  );
  project.writeFile(
    "support/star.ts",
    "export const starValue = 3;\n" +
      "export function starCallable() { return 3; }\n",
  );
  project.writeFile(
    "app/page.ts",
    'import { unchangedValue, wrappedValue } from "../support/values.js";\n' +
      "export default function Page() { return null; }\n" +
      "export const directPassthrough = unchangedValue;\n" +
      "export const nestedWrapper = { nested: { wrappedValue } };\n" +
      'export * from "../support/star.js";\n' +
      "function ListedCallable() { return null; }\n" +
      "export { ListedCallable };\n" +
      "export const exposedObject = { visible: true };\n",
  );
  project.writeFile(
    "app/policy.ts",
    "interface DataContract { value: string; }\n" +
      "type NamedAlias = string;\n" +
      "type UnionAlias = string | number;\n",
  );

  const result = runCli(project.cwd);

  assertFailedCli(result);
  assertNoFinding(result, "REQ-018", "app/page.ts", 'Exported value "default"');
  assertFinding(result, "REQ-018", "app/page.ts", 'Exported value "starCallable"');
  assertFinding(result, "REQ-018", "app/page.ts", 'Exported value "ListedCallable"');
  assertFinding(result, "REQ-019", "app/page.ts", 'Imported value "unchangedValue"');
  assertFinding(result, "REQ-019", "app/page.ts", 'Imported value "wrappedValue"');
  assertFinding(result, "REQ-019", "app/page.ts", 'Source star export "starValue"');
  assertFinding(result, "REQ-019", "app/page.ts", 'Source star export "starCallable"');
  assertFinding(result, "REQ-020", "app/page.ts", 'Local value "ListedCallable"');
  assertFinding(result, "REQ-021", "app/page.ts", 'Exported const "exposedObject"');
  assertFinding(result, "REQ-021", "app/page.ts", 'Exported const "nestedWrapper"');
  assertFinding(result, "REQ-024", "app/policy.ts", 'Interface data property "value"');
  assertFinding(result, "REQ-029", "app/policy.ts", "Type alias declarations are not permitted");
  assertFinding(result, "REQ-030", "app/policy.ts", "Union type syntax is not permitted");
});

test(
  `[${POLICY_INDEPENDENCE_PROPERTY_ID}] an eligible Next.js convention export does not suppress independent import, export, type, and style policies`,
  (t) => {
    const project = createTemporaryProject(t);
    configureProject(project);
    project.writeFile("support/values.ts", "export const unchangedValue = 1;\n");
    project.writeFile(
      "app/page.ts",
      'import { unchangedValue } from "../support/values.js";\n' +
        "export default function Page() { return null; }\n" +
        "export const directPassthrough = unchangedValue;\n" +
        "export function notAConvention() { return null; }\n" +
        "type RouteValue = string | number;\n" +
        "if (true) {\n" +
        "  const value = 1;\n" +
        "} else {\n" +
        "  const fallback = 2;\n" +
        "}\n",
    );

    const result = runCli(project.cwd);

    assertFailedCli(result);
    assertNoFinding(result, "REQ-018", "app/page.ts", 'Exported value "default"');
    assertFinding(result, "REQ-019", "app/page.ts", 'Imported value "unchangedValue"');
    assertFinding(result, "REQ-018", "app/page.ts", 'Exported value "notAConvention"');
    assertFinding(result, "REQ-029", "app/page.ts", "Type alias declarations are not permitted");
    assertFinding(result, "REQ-030", "app/page.ts", "Union type syntax is not permitted");
    assertFinding(result, "REQ-032", "app/page.ts", "else and else if branches are not permitted");
  },
);

test(`[${PROPERTY_ID}] an exact Pages Router exception leaves other lowercase get names enforced`, (t) => {
  const project = createTemporaryProject(t);
  configureProject(project);
  project.writeFile(
    "pages/index.ts",
    "export function getStaticProps() { return undefined; }\n" +
      "export function getOtherData() { return undefined; }\n" +
      "class Store { getItem() { return undefined; } }\n",
  );

  const result = runCli(project.cwd);

  assertFailedCli(result);
  assertNoFinding(result, "REQ-018", "pages/index.ts", 'Exported value "getStaticProps"');
  assertNoFinding(result, "REQ-031", "pages/index.ts", 'name "getStaticProps"');
  assertFinding(result, "REQ-018", "pages/index.ts", 'Exported value "getOtherData"');
  assertFinding(result, "REQ-031", "pages/index.ts", 'name "getOtherData"');
  assertFinding(result, "REQ-031", "pages/index.ts", 'name "getItem"');
});
