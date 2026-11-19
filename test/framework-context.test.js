import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  classifyNextModule,
  resolveFrameworkContext,
} from "../bin/framework-context.js";
import { createTemporaryProject } from "../test-support/temp-project.js";

function installNext(project, version, entryContents = "module.exports = {};\n") {
  project.writeFile(
    "node_modules/next/package.json",
    JSON.stringify({ name: "next", version, main: "index.js" }),
  );
  project.writeFile("node_modules/next/index.js", entryContents);
}

function createSupportedNextProject(testContext, version = "16.2.0") {
  const project = createTemporaryProject(testContext);
  installNext(project, version);
  return project;
}

function classifyFromProject(
  project,
  relativePath,
  frameworkContext = resolveFrameworkContext(project.cwd),
) {
  return classifyNextModule(relativePath, project.cwd, frameworkContext);
}

test("framework context treats an unresolved Next.js package as absent [REQ-005, REQ-006]", (t) => {
  const project = createTemporaryProject(t);

  const context = resolveFrameworkContext(project.cwd);

  assert.deepEqual(context.next, { status: "absent" });
});

test("framework context distinguishes supported and unsupported resolved versions [REQ-005, REQ-006]", async (t) => {
  for (const scenario of [
    { version: "16.2.3", status: "supported", major: 16 },
    { version: "15.4.1", status: "unsupported", major: 15 },
  ]) {
    await t.test(scenario.version, (subtest) => {
      const project = createTemporaryProject(subtest);
      const moduleMarker = resolve(project.cwd, "next-module-loaded");
      installNext(
        project,
        scenario.version,
        `require("node:fs").writeFileSync(${JSON.stringify(moduleMarker)}, "loaded");\n`,
      );

      const context = resolveFrameworkContext(project.cwd);

      assert.equal(context.next.status, scenario.status);
      assert.equal(context.next.version, scenario.version);
      assert.equal(context.next.major, scenario.major);
      assert.equal(context.next.packageRoot, resolve(project.cwd, "node_modules/next"));
      assert.equal(
        context.routingConfiguration.status,
        "default",
        "an absent Next.js config preserves default routing configuration",
      );
      assert.equal(
        projectPathExists(project.cwd, "next-module-loaded"),
        false,
        "resolving Next.js must not load its entry module",
      );
    });
  }
});

function projectPathExists(cwd, relativePath) {
  return existsSync(resolve(cwd, relativePath));
}

test("framework context fails closed when resolved Next.js metadata is unreadable [REQ-005, REQ-006, REQ-012]", (t) => {
  const project = createTemporaryProject(t);
  installNext(project, "16.1.0");
  const metadataPath = resolve(project.cwd, "node_modules/next/package.json");

  const context = resolveFrameworkContext(project.cwd, {
    readTextFile(filePath) {
      if (resolve(filePath) === metadataPath) {
        throw new Error("EACCES: metadata is unreadable");
      }
      return readFileSync(filePath, "utf8");
    },
  });

  assert.equal(context.next.status, "indeterminate");
  assert.equal(context.next.version, undefined);

  const malformedMetadataContext = resolveFrameworkContext(project.cwd, {
    readTextFile(filePath) {
      if (resolve(filePath) === metadataPath) {
        return "null";
      }
      return readFileSync(filePath, "utf8");
    },
  });
  assert.equal(malformedMetadataContext.next.status, "indeterminate");
  assert.equal(context.routingConfiguration.status, "default");
});

test("routing configuration defaults when absent or statically unchanged [REQ-005, REQ-006, REQ-012]", (t) => {
  const project = createTemporaryProject(t);

  assert.deepEqual(
    resolveFrameworkContext(project.cwd).routingConfiguration,
    { status: "default" },
  );

  project.writeFile(
    "next.config.ts",
    `const defaultExtensions = ["tsx", "ts", "jsx", "js"] as const;\n` +
      `export default { pageExtensions: defaultExtensions };\n`,
  );

  assert.deepEqual(
    resolveFrameworkContext(project.cwd).routingConfiguration,
    { status: "default" },
  );
});

test("routing configuration marks custom pageExtensions as changed [REQ-005, REQ-006]", (t) => {
  const project = createTemporaryProject(t);
  project.writeFile(
    "next.config.js",
    `module.exports = { pageExtensions: ["page.tsx", "page.ts"] };\n`,
  );

  const context = resolveFrameworkContext(project.cwd);

  assert.deepEqual(context.routingConfiguration, { status: "changed" });
});

test("routing status tracks only statically relevant config shape [PROP-REQ-001-01]", async (t) => {
  const cases = [
    {
      name: "inline config ignores a dynamic unrelated property",
      source: 'module.exports = { distDir: process.env.DIST_DIR };\n',
      status: "default",
    },
    {
      name: "const-aliased config ignores a dynamic unrelated property",
      source:
        'const dynamicDistDir = process.env.DIST_DIR;\n' +
        'const config = { distDir: dynamicDistDir };\n' +
        'module.exports = config;\n',
      status: "default",
    },
    {
      name: "explicit pageExtensions resolves a const alias to the default sequence",
      source:
        'const tsx = "tsx";\n' +
        'const defaultExtensions = [tsx, "ts", "jsx", "js"];\n' +
        'module.exports = { pageExtensions: defaultExtensions };\n',
      status: "default",
    },
    {
      name: "shorthand pageExtensions resolves its const alias to the default sequence",
      source:
        'const pageExtensions = ["tsx", "ts", "jsx", "js"];\n' +
        'module.exports = { pageExtensions };\n',
      status: "default",
    },
    {
      name: "a different static string array is changed",
      source:
        'module.exports = { pageExtensions: ["ts", "tsx", "jsx", "js"] };\n',
      status: "changed",
    },
    {
      name: "a static non-array value is changed",
      source: 'module.exports = { pageExtensions: "tsx" };\n',
      status: "changed",
    },
    {
      name: "a static array containing a non-string value is changed",
      source:
        'module.exports = { pageExtensions: ["tsx", 1] };\n',
      status: "changed",
    },
    {
      name: "a dynamic pageExtensions value is indeterminate",
      source: 'module.exports = { pageExtensions: process.env.PAGE_EXTENSIONS };\n',
      status: "indeterminate",
    },
    {
      name: "an unresolved shorthand pageExtensions value is indeterminate",
      source: 'module.exports = { pageExtensions };\n',
      status: "indeterminate",
    },
    {
      name: "a computed config key is indeterminate",
      source:
        'module.exports = { [process.env.CONFIG_KEY]: ["tsx", "ts", "jsx", "js"] };\n',
      status: "indeterminate",
    },
    {
      name: "an unanalysable spread is indeterminate",
      source: 'module.exports = { ...loadConfig() };\n',
      status: "indeterminate",
    },
    {
      name: "duplicate pageExtensions entries are indeterminate",
      source:
        'module.exports = { pageExtensions: ["tsx", "ts", "jsx", "js"], pageExtensions: ["ts"] };\n',
      status: "indeterminate",
    },
    {
      name: "a pageExtensions accessor is indeterminate",
      source:
        'module.exports = { get pageExtensions() { return ["tsx", "ts", "jsx", "js"]; } };\n',
      status: "indeterminate",
    },
    {
      name: "a prototype-changing __proto__ setter is indeterminate",
      source:
        'module.exports = { __proto__: { pageExtensions: ["tsx", "ts", "jsx", "js"] } };\n',
      status: "indeterminate",
    },
    {
      name: "an unsupported config expression is indeterminate",
      source: "module.exports = createConfig();\n",
      status: "indeterminate",
    },
  ];

  for (const scenario of cases) {
    await t.test(`[PROP-REQ-001-01] ${scenario.name}`, (subtest) => {
      const project = createTemporaryProject(subtest);
      project.writeFile("next.config.js", scenario.source);

      assert.deepEqual(resolveFrameworkContext(project.cwd).routingConfiguration, {
        status: scenario.status,
      });
    });
  }
});

test("dynamic routing configuration is indeterminate and is never executed [REQ-005, REQ-006, REQ-012, PROP-REQ-006-01]", (t) => {
  const project = createTemporaryProject(t);
  const markerPath = resolve(project.cwd, "configuration-executed");
  project.writeFile(
    "next.config.cjs",
    `module.exports = { pageExtensions: (() => {\n` +
      `  require("node:fs").writeFileSync(${JSON.stringify(markerPath)}, "executed");\n` +
      `  return ["tsx", "ts"];\n` +
      `})() };\n`,
  );

  const context = resolveFrameworkContext(project.cwd);

  assert.deepEqual(context.routingConfiguration, { status: "indeterminate" });
  assert.equal(projectPathExists(project.cwd, "configuration-executed"), false);
});

test("Next.js 16 classifies every listed router role and callable export [REQ-005, REQ-006, REQ-009]", async (t) => {
  const project = createSupportedNextProject(t);
  const defaultExport = ["default"];
  const pageExports = [
    "default",
    "generateMetadata",
    "generateViewport",
    "generateStaticParams",
  ];
  const routeExports = [
    "GET",
    "HEAD",
    "OPTIONS",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
  ];
  const pageRouteExports = [
    "default",
    "getStaticProps",
    "getStaticPaths",
    "getServerSideProps",
  ];
  const tableCases = [
    {
      path: "app/page.tsx",
      routers: ["app"],
      role: "app-page",
      moduleName: "page",
      exportNames: pageExports,
    },
    {
      path: "app/dashboard/layout.tsx",
      routers: ["app"],
      role: "app-layout",
      moduleName: "layout",
      exportNames: pageExports,
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
    ].map((moduleName) => ({
      path: `app/dashboard/${moduleName}.tsx`,
      routers: ["app"],
      role: "app-component",
      moduleName,
      exportNames: defaultExport,
    })),
    {
      path: "app/blog/[slug]/route.ts",
      routers: ["app"],
      role: "app-route-handler",
      moduleName: "route",
      exportNames: routeExports,
    },
    {
      path: "pages/index.tsx",
      routers: ["pages"],
      role: "pages-page-route",
      moduleName: "index",
      exportNames: pageRouteExports,
    },
    {
      path: "pages/blog/[slug].tsx",
      routers: ["pages"],
      role: "pages-page-route",
      moduleName: "[slug]",
      exportNames: pageRouteExports,
    },
    {
      path: "pages/api/users/[id].ts",
      routers: ["pages"],
      role: "pages-api-route",
      moduleName: "[id]",
      exportNames: defaultExport,
    },
    ...["_app", "_document", "_error", "404", "500"].map(
      (moduleName) => ({
        path: `pages/${moduleName}.tsx`,
        routers: ["pages"],
        role: "pages-special-module",
        moduleName,
        exportNames: defaultExport,
      }),
    ),
  ];

  for (const tableCase of tableCases) {
    project.writeFile(tableCase.path, "");
  }
  const context = resolveFrameworkContext(project.cwd);

  for (const tableCase of tableCases) {
    await t.test(`${tableCase.path} exposes only its table entries`, () => {
      const { path, ...expected } = tableCase;
      const classification = classifyFromProject(project, path, context);

      assert.deepEqual(classification, expected);
      for (const exportName of expected.exportNames) {
        assert.ok(classification.exportNames.includes(exportName));
      }
      assert.equal(classification.exportNames.includes("notListed"), false);
    });
  }
});

test("project-level proxy is classified for either router and supported src layouts [REQ-005, REQ-006]", async (t) => {
  const proxyCases = [
    { source: "app/page.tsx", proxy: "proxy.ts", routers: ["app"] },
    { source: "pages/index.tsx", proxy: "proxy.ts", routers: ["pages"] },
    {
      source: "app/page.tsx",
      secondSource: "pages/index.tsx",
      proxy: "proxy.ts",
      routers: ["app", "pages"],
    },
    {
      source: "src/app/page.tsx",
      proxy: "src/proxy.ts",
      routers: ["app"],
    },
    {
      source: "src/pages/index.tsx",
      proxy: "src/proxy.ts",
      routers: ["pages"],
    },
  ];

  for (const scenario of proxyCases) {
    await t.test(`${scenario.proxy} with ${scenario.routers.join(" and ")}`, (subtest) => {
      const project = createSupportedNextProject(subtest);
      project.writeFile(scenario.source, "");
      if (scenario.secondSource !== undefined) {
        project.writeFile(scenario.secondSource, "");
      }
      project.writeFile(scenario.proxy, "");

      assert.deepEqual(
        classifyFromProject(project, scenario.proxy),
        {
          routers: scenario.routers,
          role: "project-proxy",
          moduleName: "proxy",
          exportNames: ["default", "proxy"],
        },
      );
    });
  }
});

test("root router directories take precedence over their src equivalents [REQ-005, REQ-006]", (t) => {
  const project = createSupportedNextProject(t);
  for (const path of [
    "app/page.tsx",
    "src/app/page.tsx",
    "pages/index.tsx",
    "src/pages/index.tsx",
  ]) {
    project.writeFile(path, "");
  }
  const context = resolveFrameworkContext(project.cwd);

  assert.equal(
    classifyFromProject(project, "app/page.tsx", context).role,
    "app-page",
  );
  assert.equal(
    classifyFromProject(project, "pages/index.tsx", context).role,
    "pages-page-route",
  );
  assert.equal(classifyFromProject(project, "src/app/page.tsx", context), null);
  assert.equal(classifyFromProject(project, "src/pages/index.tsx", context), null);
});

test("nested routes and src router roots are classified only in active layouts [REQ-005, REQ-006]", (t) => {
  const project = createSupportedNextProject(t);
  project.writeFile("src/app/shop/[id]/page.tsx", "");
  project.writeFile("src/pages/shop/[id].tsx", "");
  project.writeFile("src/proxy.ts", "");
  const context = resolveFrameworkContext(project.cwd);

  assert.deepEqual(
    classifyFromProject(project, "src/app/shop/[id]/page.tsx", context),
    {
      routers: ["app"],
      role: "app-page",
      moduleName: "page",
      exportNames: [
        "default",
        "generateMetadata",
        "generateViewport",
        "generateStaticParams",
      ],
    },
  );
  assert.deepEqual(
    classifyFromProject(project, "src/pages/shop/[id].tsx", context),
    {
      routers: ["pages"],
      role: "pages-page-route",
      moduleName: "[id]",
      exportNames: [
        "default",
        "getStaticProps",
        "getStaticPaths",
        "getServerSideProps",
      ],
    },
  );
  assert.deepEqual(classifyFromProject(project, "src/proxy.ts", context).routers, [
    "app",
    "pages",
  ]);
});

test("unlisted names, paths, extensions, and Next contexts receive no table role [REQ-005, REQ-006, REQ-009]", async (t) => {
  const unsupportedCases = [
    {
      name: "unresolved Next.js package",
      setup(project) {},
    },
    {
      name: "unsupported Next.js major",
      setup(project) {
        installNext(project, "15.4.1");
      },
    },
    {
      name: "changed pageExtensions",
      setup(project) {
        installNext(project, "16.2.0");
        project.writeFile(
          "next.config.js",
          'module.exports = { pageExtensions: ["page.tsx"] };\n',
        );
      },
    },
    {
      name: "indeterminate pageExtensions",
      setup(project) {
        installNext(project, "16.2.0");
        project.writeFile(
          "next.config.js",
          'module.exports = { pageExtensions: process.env.PAGE_EXTENSIONS };\n',
        );
      },
    },
  ];

  for (const scenario of unsupportedCases) {
    await t.test(scenario.name, (subtest) => {
      const project = createTemporaryProject(subtest);
      scenario.setup(project);
      project.writeFile("app/page.tsx", "");

      assert.equal(classifyFromProject(project, "app/page.tsx"), null);
    });
  }

  const project = createSupportedNextProject(t);
  for (const path of [
    "app/middleware.ts",
    "app/blog/proxy.ts",
    "app/page.jsx",
    "pages/api/users/[id].js",
  ]) {
    project.writeFile(path, "");
    assert.equal(classifyFromProject(project, path), null, path);
  }
  project.writeFile("app/page.tsx", "");
  assert.equal(
    classifyFromProject(project, "../outside/app/page.tsx"),
    null,
  );
});
