import assert from "node:assert/strict";
import test from "node:test";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { runCli } from "../test-support/run-cli.js";

function configureSourceScope(project) {
  project.writeFile(
    "tightscript.config.json",
    JSON.stringify({ include: ["src/**/*.ts"] }),
  );
}

test("CLI requires private instance properties, accessors, and parameter properties [REQ-022]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  const cases = [
    [
      "AbstractProperty.ts",
      "abstract class AbstractProperty {\n  abstract value: number;\n}\n",
    ],
    [
      "ProtectedProperty.ts",
      "class ProtectedProperty {\n  protected value = 1;\n}\n",
    ],
    [
      "PublicGetter.ts",
      "class PublicGetter {\n  get value(): number { return 1; }\n}\n",
    ],
    [
      "PublicSetter.ts",
      "class PublicSetter {\n  set value(next: number) {}\n}\n",
    ],
    [
      "PublicParameterProperty.ts",
      "class PublicParameterProperty {\n" +
        "  constructor(public value: number) {}\n" +
        "  operation() {}\n" +
        "}\n",
    ],
    [
      "ProtectedParameterProperty.ts",
      "class ProtectedParameterProperty {\n  constructor(protected value: number) {}\n}\n",
    ],
    [
      "PrivateControls.ts",
      "class PrivateControls {\n" +
        "  private value = 1;\n" +
        "  #hidden = 2;\n" +
        "  private get secret(): number { return this.value; }\n" +
        "  private set secret(next: number) { this.value = next; }\n" +
        "}\n",
    ],
    [
      "PrivateParameterProperty.ts",
      "class PrivateParameterProperty {\n  constructor(private value: number) {}\n}\n",
    ],
    [
      "StaticControls.ts",
      "class StaticControls {\n" +
        "  static value = 1;\n" +
        "  static get category(): number { return 1; }\n" +
        "  static operation() {}\n" +
        "}\n",
    ],
  ];

  for (const [fileName, contents] of cases) {
    project.writeFile(`src/${fileName}`, contents);
  }

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    "src/AbstractProperty.ts:2:3 [REQ-022] Instance property or accessor \"value\" must be private.\n" +
      "src/ProtectedParameterProperty.ts:2:15 [REQ-022] Constructor parameter property \"value\" must be private.\n" +
      "src/ProtectedProperty.ts:2:3 [REQ-022] Instance property or accessor \"value\" must be private.\n" +
      "src/PublicGetter.ts:2:3 [REQ-022] Instance property or accessor \"value\" must be private.\n" +
      "src/PublicParameterProperty.ts:2:15 [REQ-022] Constructor parameter property \"value\" must be private.\n" +
      "src/PublicSetter.ts:2:3 [REQ-022] Instance property or accessor \"value\" must be private.\n" +
      "FAIL\n",
  );
});

test("CLI applies the exact DTO exception and method-disqualification boundaries [REQ-022, REQ-023]", async (t) => {
  await t.test("public constructor properties are exempt only for DTOs", (subtest) => {
    const project = createTemporaryProject(subtest);
    configureSourceScope(project);
    project.writeFile(
      "src/Dto.ts",
      "class Dto {\n" +
        "  constructor(\n" +
        "    public id: string,\n" +
        "    readonly name: string\n" +
        "  ) {}\n" +
        "}\n",
    );
    project.writeFile(
      "src/DtoWithStaticMembers.ts",
      "class DtoWithStaticMembers {\n" +
        "  static category = \"record\";\n" +
        "  static get kind(): string { return \"record\"; }\n" +
        "  constructor(public id: string) {}\n" +
        "}\n",
    );

    const result = runCli(project.cwd);

    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.equal(result.status, 0);
    assert.equal(result.stdout, "PASS\n");
    assert.equal(result.stderr, "");
  });

  await t.test("instance state, accessors, and any method disqualify a DTO", (subtest) => {
    const project = createTemporaryProject(subtest);
    configureSourceScope(project);
    project.writeFile(
      "src/DtoWithAccessor.ts",
      "class DtoWithAccessor {\n" +
        "  constructor(public id: string) {}\n" +
        "  get label(): string { return this.id; }\n" +
        "}\n",
    );
    project.writeFile(
      "src/DtoWithInstanceProperty.ts",
      "class DtoWithInstanceProperty {\n" +
        "  constructor(public id: string) {}\n" +
        "  label = \"record\";\n" +
        "}\n",
    );
    project.writeFile(
      "src/DtoWithMethod.ts",
      "class DtoWithMethod {\n" +
        "  constructor(public id: string) {}\n" +
        "  operation() {}\n" +
        "}\n",
    );
    project.writeFile(
      "src/DtoWithPrivateMethod.ts",
      "class DtoWithPrivateMethod {\n" +
        "  constructor(public id: string) {}\n" +
        "  private operation() {}\n" +
        "}\n",
    );
    project.writeFile(
      "src/DtoWithReadonlyAndStaticMethod.ts",
      "class DtoWithReadonlyAndStaticMethod {\n" +
        "  constructor(readonly id: string) {}\n" +
        "  static create() {}\n" +
        "}\n",
    );
    project.writeFile(
      "src/DtoWithStaticMethod.ts",
      "class DtoWithStaticMethod {\n" +
        "  constructor(public id: string) {}\n" +
        "  static create() {}\n" +
        "}\n",
    );

    const result = runCli(project.cwd);

    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(
      result.stderr,
      "src/DtoWithAccessor.ts:2:15 [REQ-022] Constructor parameter property \"id\" must be private.\n" +
        "src/DtoWithAccessor.ts:3:3 [REQ-022] Instance property or accessor \"label\" must be private.\n" +
        "src/DtoWithInstanceProperty.ts:2:15 [REQ-022] Constructor parameter property \"id\" must be private.\n" +
        "src/DtoWithInstanceProperty.ts:3:3 [REQ-022] Instance property or accessor \"label\" must be private.\n" +
        "src/DtoWithMethod.ts:2:15 [REQ-022] Constructor parameter property \"id\" must be private.\n" +
        "src/DtoWithPrivateMethod.ts:2:15 [REQ-022] Constructor parameter property \"id\" must be private.\n" +
        "src/DtoWithReadonlyAndStaticMethod.ts:2:15 [REQ-022] Constructor parameter property \"id\" must be private.\n" +
        "src/DtoWithStaticMethod.ts:2:15 [REQ-022] Constructor parameter property \"id\" must be private.\n" +
        "FAIL\n",
    );
  });
});
