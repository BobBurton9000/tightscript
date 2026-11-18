import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { runCli } from "../test-support/run-cli.js";

const PROPERTY_ID = "PROP-REQ-004-01";

function configureSourceScope(project) {
  project.writeFile(
    "tightscript.config.json",
    JSON.stringify({
      include: [
        "app/**/*.ts",
        "app/**/*.tsx",
        "pages/**/*.ts",
        "pages/**/*.tsx",
        "src/app/**/*.ts",
        "src/app/**/*.tsx",
        "src/pages/**/*.ts",
        "src/pages/**/*.tsx",
        "proxy.ts",
        "src/proxy.ts",
      ],
    }),
  );
}

function installNext(project, version = "16.2.0") {
  project.writeFile(
    "node_modules/next/package.json",
    JSON.stringify({ name: "next", version, main: "index.js" }),
  );
  project.writeFile("node_modules/next/index.js", "module.exports = {};\n");
}

function callableExport(exportName, suffix = "") {
  const localName = `Local${exportName === "default" ? "Default" : exportName}${suffix}`;
  if (exportName === "default") {
    return `export default function ${localName}() { return 42; }\n`;
  }
  return `export function ${exportName}() { return 42; }\n`;
}

function moduleWithExports(exportNames, suffix = "") {
  return exportNames.map((name) => callableExport(name, suffix)).join("");
}

function assertCompletedCli(result) {
  assert.ifError(result.error);
  assert.equal(result.signal, null);
}

function assertPassedCli(result) {
  assertCompletedCli(result);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "PASS\n");
  assert.equal(result.stderr, "");
}

function assertFailedCli(result) {
  assertCompletedCli(result);
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /\nFAIL\n$/);
}

function assertDiagnostic(result, requirementId, exportName, filePath) {
  const expected = `[${requirementId}] Exported value "${exportName}"`;
  assert.ok(
    result.stderr.split("\n").some(
      (line) =>
        line.includes(expected) &&
        (filePath === undefined || line.startsWith(`${filePath}:`)),
    ),
    `expected ${expected}${filePath ? ` in ${filePath}` : ""}:\n${result.stderr}`,
  );
}

test(`[${PROPERTY_ID}] Next.js 16.x accepts every listed router, file-role, and callable-export combination`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  installNext(project);

  const pageAndLayoutExports = [
    "default",
    "generateMetadata",
    "generateViewport",
    "generateStaticParams",
  ];
  const tableModules = [
    {
      path: "app/shop/[id]/page.tsx",
      exports: pageAndLayoutExports,
    },
    {
      path: "app/shop/layout.tsx",
      exports: pageAndLayoutExports,
    },
    ...[
      "template",
      "default",
      "error",
      "global-error",
      "not-found",
      "loading",
      "forbidden",
      "unauthorized",
    ].map((name) => ({
      path: `app/shop/${name}.tsx`,
      exports: ["default"],
    })),
    {
      path: "app/api/[...path]/route.ts",
      exports: ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"],
    },
    {
      path: "pages/blog/[slug].tsx",
      exports: [
        "default",
        "getStaticProps",
        "getStaticPaths",
        "getServerSideProps",
      ],
    },
    {
      path: "pages/api/users/[id].ts",
      exports: ["default"],
    },
    ...["_app", "_document", "_error", "404", "500"].map((name) => ({
      path: `pages/${name}.tsx`,
      exports: ["default"],
    })),
    {
      path: "proxy.ts",
      exports: ["default", "proxy"],
    },
  ];

  for (const module of tableModules) {
    // Deliberately incompatible Next.js slot signatures remain eligible when the checker establishes callability.
    project.writeFile(
      module.path,
      moduleWithExports(module.exports, module.path.replaceAll(/[^a-zA-Z]/g, "")),
    );
  }

  const result = runCli(project.cwd);

  assertPassedCli(result);
});

test(`[${PROPERTY_ID}] project-level proxy exports qualify for App Router, Pages Router, or both`, async (t) => {
  for (const routers of [["app"], ["pages"], ["app", "pages"]]) {
    await t.test(`[${PROPERTY_ID}] active routers: ${routers.join(" and ")}`, (subtest) => {
      const project = createTemporaryProject(subtest);
      configureSourceScope(project);
      installNext(project);
      for (const router of routers) {
        project.writeFile(
          router === "app" ? "app/page.tsx" : "pages/index.tsx",
          callableExport("default", router),
        );
      }
      project.writeFile("proxy.ts", moduleWithExports(["default", "proxy"]));

      assertPassedCli(runCli(project.cwd));
    });
  }
});

test(`[${PROPERTY_ID}] supported src layouts work and active project-root routers take precedence`, async (t) => {
  await t.test(`[${PROPERTY_ID}] src-only App Router and Pages Router roots`, (subtest) => {
    const project = createTemporaryProject(subtest);
    configureSourceScope(project);
    installNext(project);
    project.writeFile("src/app/shop/[id]/page.tsx", callableExport("default"));
    project.writeFile("src/pages/shop/[id].tsx", callableExport("default"));
    project.writeFile("src/proxy.ts", moduleWithExports(["default", "proxy"]));

    assertPassedCli(runCli(project.cwd));
  });

  await t.test(`[${PROPERTY_ID}] root App and Pages directories disable equivalent src roles`, (subtest) => {
    const project = createTemporaryProject(subtest);
    configureSourceScope(project);
    installNext(project);
    project.writeFile("app/page.tsx", callableExport("default", "RootApp"));
    project.writeFile("src/app/page.tsx", callableExport("default", "SrcApp"));
    project.writeFile("pages/index.tsx", callableExport("default", "RootPages"));
    project.writeFile("src/pages/index.tsx", callableExport("default", "SrcPages"));
    project.writeFile("proxy.ts", moduleWithExports(["default", "proxy"], "Root"));
    project.writeFile("src/proxy.ts", moduleWithExports(["default", "proxy"], "Src"));

    const result = runCli(project.cwd);

    assertFailedCli(result);
    assertDiagnostic(result, "REQ-018", "default", "src/app/page.tsx");
    assertDiagnostic(result, "REQ-018", "default", "src/pages/index.tsx");
    assertDiagnostic(result, "REQ-018", "default", "src/proxy.ts");
    assertDiagnostic(result, "REQ-018", "proxy", "src/proxy.ts");
    for (const rootPath of ["app/page.tsx", "pages/index.tsx", "proxy.ts"]) {
      assert.equal(
        result.stderr
          .split("\n")
          .some((line) => line.startsWith(`${rootPath}:`) && line.includes("[REQ-018]")),
        false,
        `root-role module ${rootPath} should not retain REQ-018:\n${result.stderr}`,
      );
    }
  });
});

test(`[${PROPERTY_ID}] unsupported roles, names, and file boundaries retain REQ-018`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  installNext(project);
  project.writeFile("app/not-a-convention.ts", callableExport("default"));
  project.writeFile("app/middleware.ts", callableExport("default"));
  project.writeFile(
    "app/route.ts",
    `${callableExport("CUSTOM")}${callableExport("GET")}`,
  );
  project.writeFile(
    "app/page.tsx",
    `${callableExport("unlistedMetadata")}${callableExport("default")}`,
  );
  project.writeFile(
    "pages/api/unsupported.ts",
    `${callableExport("getStaticProps")}${callableExport("default")}`,
  );
  project.writeFile(
    "pages/_app.tsx",
    `${callableExport("getStaticProps")}${callableExport("default")}`,
  );

  const result = runCli(project.cwd);

  assertFailedCli(result);
  for (const [exportName, filePath] of [
    ["default", "app/not-a-convention.ts"],
    ["default", "app/middleware.ts"],
    ["CUSTOM", "app/route.ts"],
    ["unlistedMetadata", "app/page.tsx"],
    ["getStaticProps", "pages/api/unsupported.ts"],
    ["getStaticProps", "pages/_app.tsx"],
  ]) {
    assertDiagnostic(result, "REQ-018", exportName, filePath);
  }
  assert.match(result.stderr, /pages\/api\/unsupported\.ts:\d+:\d+ \[REQ-031\]/);
  assert.match(result.stderr, /pages\/_app\.tsx:\d+:\d+ \[REQ-031\]/);
});

test(`[${PROPERTY_ID}] unsupported Next.js majors and unresolved package versions never pass`, async (t) => {
  await t.test(`[${PROPERTY_ID}] unsupported major retains REQ-018`, (subtest) => {
    const project = createTemporaryProject(subtest);
    configureSourceScope(project);
    installNext(project, "15.4.1");
    project.writeFile("app/page.tsx", callableExport("default"));

    const result = runCli(project.cwd);

    assertFailedCli(result);
    assertDiagnostic(result, "REQ-018", "default", "app/page.tsx");
    assert.doesNotMatch(result.stderr, /\[REQ-005\] Evaluation error:/);
  });

  await t.test(`[${PROPERTY_ID}] malformed resolved version fails semantic evaluation closed`, (subtest) => {
    const project = createTemporaryProject(subtest);
    configureSourceScope(project);
    installNext(project, "not-a-semver-version");
    project.writeFile("app/page.tsx", callableExport("default"));

    const result = runCli(project.cwd);

    assertFailedCli(result);
    assertDiagnostic(result, "REQ-018", "default", "app/page.tsx");
    assert.match(result.stderr, /\[REQ-005\] Evaluation error:/);
  });
});

test(`[${PROPERTY_ID}] default, unchanged, changed, and indeterminate routing configuration is fail-closed`, async (t) => {
  await t.test(`[${PROPERTY_ID}] default configuration accepts a nested route`, (subtest) => {
    const project = createTemporaryProject(subtest);
    configureSourceScope(project);
    installNext(project);
    project.writeFile("app/shop/[id]/page.tsx", callableExport("default"));

    assertPassedCli(runCli(project.cwd));
  });

  await t.test(`[${PROPERTY_ID}] statically unchanged pageExtensions accepts a route`, (subtest) => {
    const project = createTemporaryProject(subtest);
    configureSourceScope(project);
    installNext(project);
    project.writeFile(
      "next.config.js",
      'const extensions = ["tsx", "ts", "jsx", "js"];\n' +
        "module.exports = { pageExtensions: extensions };\n",
    );
    project.writeFile("pages/shop/[id].tsx", callableExport("default"));

    assertPassedCli(runCli(project.cwd));
  });

  await t.test(`[${PROPERTY_ID}] changed pageExtensions retains REQ-018`, (subtest) => {
    const project = createTemporaryProject(subtest);
    configureSourceScope(project);
    installNext(project);
    project.writeFile(
      "next.config.js",
      'module.exports = { pageExtensions: ["page.tsx"] };\n',
    );
    project.writeFile("app/page.tsx", callableExport("default"));
    project.writeFile("pages/index.tsx", callableExport("default", "Pages"));

    const result = runCli(project.cwd);

    assertFailedCli(result);
    assertDiagnostic(result, "REQ-018", "default", "app/page.tsx");
    assertDiagnostic(result, "REQ-018", "default", "pages/index.tsx");
    assert.doesNotMatch(result.stderr, /\[REQ-005\] Evaluation error:/);
  });

  await t.test(`[${PROPERTY_ID}] dynamic configuration fails closed without execution`, (subtest) => {
    const project = createTemporaryProject(subtest);
    configureSourceScope(project);
    installNext(project);
    project.writeFile(
      "next.config.js",
      'module.exports = { pageExtensions: process.env.PAGE_EXTENSIONS };\n' +
        'require("node:fs").writeFileSync("config-executed", "yes");\n',
    );
    project.writeFile("app/page.tsx", callableExport("default"));

    const result = runCli(project.cwd);

    assertFailedCli(result);
    assertDiagnostic(result, "REQ-018", "default", "app/page.tsx");
    assert.match(result.stderr, /\[REQ-005\] Evaluation error:/);
    assert.equal(existsSync(`${project.cwd}/config-executed`), false);
  });
});
