import { extname, relative, resolve, sep } from "node:path";
import ts from "typescript";
import {
  classifyNextModule,
  resolveFrameworkContext,
} from "./framework-context.js";

const UNRESOLVED_TYPE_FLAGS =
  ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.TypeParameter;
const MAX_PROVENANCE_DEPTH = 64;
const REACT_WRAPPER_NAMES = new Set(["memo", "forwardRef"]);
const PAGES_DATA_EXPORTS = new Set([
  "getStaticProps",
  "getStaticPaths",
  "getServerSideProps",
]);
const JSX_COMPONENT_DIAGNOSTICS = new Set([2604, 2786, 2787, 2788]);

function unwrapExpression(expression) {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function isImportBindingDeclaration(declaration) {
  return (
    ts.isImportDeclaration(declaration) ||
    ts.isImportClause(declaration) ||
    ts.isImportSpecifier(declaration) ||
    ts.isNamespaceImport(declaration) ||
    ts.isImportEqualsDeclaration(declaration)
  );
}

function resolvedSymbolFor(checker, symbol) {
  if (symbol === undefined) {
    return undefined;
  }

  let current = symbol;
  const visited = new Set();
  while ((current.flags & ts.SymbolFlags.Alias) !== 0) {
    if (visited.has(current)) {
      return undefined;
    }
    visited.add(current);
    try {
      const next = checker.getAliasedSymbol(current);
      if (next === undefined || next === current) {
        return undefined;
      }
      current = next;
    } catch {
      return undefined;
    }
  }
  return current;
}

function symbolsMatch(checker, left, right) {
  const resolvedLeft = resolvedSymbolFor(checker, left);
  const resolvedRight = resolvedSymbolFor(checker, right);
  if (resolvedLeft === undefined || resolvedRight === undefined) {
    return false;
  }
  if (resolvedLeft === resolvedRight) {
    return true;
  }

  const rightDeclarations = new Set(resolvedRight.declarations ?? []);
  return (resolvedLeft.declarations ?? []).some((declaration) =>
    rightDeclarations.has(declaration),
  );
}

function importDeclarationsFor(sourceFile) {
  return sourceFile.statements.filter(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteralLike(statement.moduleSpecifier),
  );
}

function moduleExportSymbol(checker, importDeclaration, exportName) {
  let moduleSymbol;
  try {
    moduleSymbol = checker.getSymbolAtLocation(importDeclaration.moduleSpecifier);
    if (moduleSymbol === undefined) {
      return undefined;
    }
    return checker
      .getExportsOfModule(moduleSymbol)
      .find((symbol) => symbol.getName() === exportName);
  } catch {
    return undefined;
  }
}

function importedReactWrapperName(expression, checker, sourceFile) {
  const current = unwrapExpression(expression);
  const imports = importDeclarationsFor(sourceFile).filter(
    (statement) => statement.moduleSpecifier.text === "react",
  );

  if (ts.isIdentifier(current)) {
    const candidateSymbol = checker.getSymbolAtLocation(current);
    for (const statement of imports) {
      const namedBindings = statement.importClause?.namedBindings;
      if (!namedBindings || !ts.isNamedImports(namedBindings)) {
        continue;
      }
      for (const specifier of namedBindings.elements) {
        const importedName = (specifier.propertyName ?? specifier.name).text;
        if (!REACT_WRAPPER_NAMES.has(importedName)) {
          continue;
        }
        const localSymbol = checker.getSymbolAtLocation(specifier.name);
        if (symbolsMatch(checker, candidateSymbol, localSymbol)) {
          return importedName;
        }
      }
    }
    return undefined;
  }

  if (!ts.isPropertyAccessExpression(current) || !ts.isIdentifier(current.expression)) {
    return undefined;
  }

  const importedName = current.name.text;
  if (!REACT_WRAPPER_NAMES.has(importedName)) {
    return undefined;
  }
  const candidateSymbol = checker.getSymbolAtLocation(current.name);
  for (const statement of imports) {
    const clause = statement.importClause;
    const namedBindings = clause?.namedBindings;
    const rootBinding =
      namedBindings !== undefined && ts.isNamespaceImport(namedBindings)
        ? namedBindings.name
        : clause?.name;
    if (
      rootBinding === undefined ||
      !symbolsMatch(
        checker,
        checker.getSymbolAtLocation(current.expression),
        checker.getSymbolAtLocation(rootBinding),
      )
    ) {
      continue;
    }

    const exportSymbol = moduleExportSymbol(checker, statement, importedName);
    if (symbolsMatch(checker, candidateSymbol, exportSymbol)) {
      return importedName;
    }
  }
  return undefined;
}

function approvedReactWrapperName(expression, context, resolving = new Set()) {
  const direct = importedReactWrapperName(
    expression,
    context.checker,
    context.sourceFile,
  );
  if (direct !== undefined) {
    return direct;
  }

  const current = unwrapExpression(expression);
  if (!ts.isIdentifier(current) || resolving.has(current.text)) {
    return undefined;
  }
  const symbol = context.checker.getSymbolAtLocation(current);
  if (symbol === undefined) {
    return undefined;
  }
  const declaration = (symbol.declarations ?? []).find(
    (candidate) =>
      ts.isVariableDeclaration(candidate) &&
      candidate.getSourceFile() === context.sourceFile &&
      ts.isIdentifier(candidate.name) &&
      candidate.name.text === current.text,
  );
  if (
    declaration?.initializer === undefined ||
    declaration.parent === undefined ||
    !ts.isVariableDeclaration(declaration) ||
    (declaration.parent.flags & ts.NodeFlags.Const) === 0
  ) {
    return undefined;
  }

  const nextResolving = new Set(resolving);
  nextResolving.add(current.text);
  return approvedReactWrapperName(
    declaration.initializer,
    context,
    nextResolving,
  );
}

function isFunctionLikeImplementation(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node)
  );
}

function hasFunctionBody(node) {
  return (
    !ts.isFunctionDeclaration(node) ||
    node.body !== undefined
  );
}

function localFunctionForExpression(expression, context, resolving = new Set()) {
  const current = unwrapExpression(expression);
  if (!ts.isIdentifier(current) || resolving.has(current.text)) {
    return undefined;
  }

  const symbol = context.checker.getSymbolAtLocation(current);
  if (symbol === undefined) {
    return undefined;
  }
  const declarations = symbol.declarations ?? [];
  if (
    declarations.some(isImportBindingDeclaration) ||
    declarations.some(
      (declaration) => declaration.getSourceFile() !== context.sourceFile,
    )
  ) {
    return undefined;
  }

  const functionDeclaration = declarations.find(
    (declaration) =>
      ts.isFunctionDeclaration(declaration) && declaration.body !== undefined,
  );
  if (functionDeclaration !== undefined) {
    return { functionNode: functionDeclaration, bindingDeclaration: functionDeclaration };
  }

  const variableDeclaration = declarations.find(
    (declaration) =>
      ts.isVariableDeclaration(declaration) &&
      ts.isIdentifier(declaration.name) &&
      declaration.name.text === current.text,
  );
  if (
    variableDeclaration === undefined ||
    variableDeclaration.initializer === undefined ||
    variableDeclaration.parent === undefined ||
    (variableDeclaration.parent.flags & ts.NodeFlags.Const) === 0
  ) {
    return undefined;
  }

  const initializer = unwrapExpression(variableDeclaration.initializer);
  if (isFunctionLikeImplementation(initializer) && hasFunctionBody(initializer)) {
    return { functionNode: initializer, bindingDeclaration: variableDeclaration };
  }

  if (ts.isIdentifier(initializer)) {
    const nextResolving = new Set(resolving);
    nextResolving.add(current.text);
    return localFunctionForExpression(initializer, context, nextResolving);
  }
  return undefined;
}

function result(kind, details = {}) {
  return { kind, implementations: new Set(), ...details };
}

function localResult(implementation, bindingDeclaration) {
  return result("local", {
    implementations: new Set([implementation]),
    bindingDeclaration,
  });
}

function combineResults(results) {
  if (results.some((candidate) => candidate.kind === "incomplete")) {
    return result("incomplete", {
      sourceNode: results.find((candidate) => candidate.kind === "incomplete")
        .sourceNode,
    });
  }
  if (results.some((candidate) => candidate.kind !== "local")) {
    return result("nonlocal");
  }

  const implementations = new Set();
  for (const candidate of results) {
    for (const implementation of candidate.implementations) {
      implementations.add(implementation);
    }
  }
  const firstBinding = results[0]?.bindingDeclaration;
  return result("local", {
    implementations,
    bindingDeclaration: results.every(
      (candidate) => candidate.bindingDeclaration === firstBinding,
    )
      ? firstBinding
      : undefined,
  });
}

function traceVariableDeclaration(declaration, context, environment, stack, depth) {
  if (
    declaration.getSourceFile() !== context.sourceFile ||
    !ts.isIdentifier(declaration.name) ||
    declaration.initializer === undefined ||
    declaration.parent === undefined ||
    (declaration.parent.flags & ts.NodeFlags.Const) === 0
  ) {
    return result("nonlocal");
  }
  const traced = traceExpression(
    declaration.initializer,
    context,
    environment,
    stack,
    depth + 1,
  );
  if (traced.kind !== "local") {
    return traced;
  }
  return { ...traced, bindingDeclaration: declaration };
}

function functionImplementationFor(declaration, checker) {
  if (declaration.body !== undefined) {
    return declaration;
  }
  if (declaration.name === undefined) {
    return undefined;
  }
  const symbol = checker.getSymbolAtLocation(declaration.name);
  return (symbol?.declarations ?? []).find(
    (candidate) =>
      ts.isFunctionDeclaration(candidate) && candidate.body !== undefined,
  );
}

function traceLocalDeclaration(declaration, context, environment, stack, depth) {
  if (declaration.getSourceFile() !== context.sourceFile) {
    return result("nonlocal");
  }

  if (ts.isFunctionDeclaration(declaration)) {
    let implementation;
    try {
      implementation = functionImplementationFor(declaration, context.checker);
    } catch {
      return result("incomplete", { sourceNode: declaration });
    }
    if (implementation === undefined) {
      return result("nonlocal");
    }
    return localResult(implementation, declaration);
  }

  if (ts.isVariableDeclaration(declaration)) {
    return traceVariableDeclaration(
      declaration,
      context,
      environment,
      stack,
      depth,
    );
  }
  return result("nonlocal");
}

function isNestedFunctionLike(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

function returnExpressions(functionNode) {
  if (
    ts.isArrowFunction(functionNode) &&
    !ts.isBlock(functionNode.body)
  ) {
    return [functionNode.body];
  }
  if (functionNode.body === undefined || !ts.isBlock(functionNode.body)) {
    return [];
  }

  const expressions = [];
  function visit(node) {
    if (node !== functionNode.body && isNestedFunctionLike(node)) {
      return;
    }
    if (ts.isReturnStatement(node)) {
      expressions.push(node.expression);
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(functionNode.body);
  return expressions;
}

function statementAlwaysReturns(statement) {
  if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) {
    return true;
  }
  if (ts.isBlock(statement)) {
    return statement.statements.some(statementAlwaysReturns);
  }
  if (ts.isIfStatement(statement)) {
    return (
      statement.elseStatement !== undefined &&
      statementAlwaysReturns(statement.thenStatement) &&
      statementAlwaysReturns(statement.elseStatement)
    );
  }
  return false;
}

function bodyAlwaysReturns(functionNode) {
  if (ts.isArrowFunction(functionNode) && !ts.isBlock(functionNode.body)) {
    return true;
  }
  return (
    functionNode.body !== undefined &&
    ts.isBlock(functionNode.body) &&
    functionNode.body.statements.some(statementAlwaysReturns)
  );
}

function wrapperEnvironment(functionNode, call, context, environment) {
  const nextEnvironment = new Map(environment);
  const parameters = functionNode.parameters;
  for (let index = 0; index < parameters.length; index += 1) {
    const parameter = parameters[index];
    if (!ts.isIdentifier(parameter.name)) {
      return undefined;
    }
    let argument = call.arguments[index];
    if (argument !== undefined && ts.isSpreadElement(argument)) {
      return undefined;
    }
    if (argument === undefined) {
      argument = parameter.initializer;
    }
    if (argument === undefined) {
      return undefined;
    }
    const symbol = context.checker.getSymbolAtLocation(parameter.name);
    if (symbol === undefined) {
      return undefined;
    }
    nextEnvironment.set(symbol, argument);
  }
  return nextEnvironment;
}

function traceLocalWrapperCall(call, functionInfo, context, environment, stack, depth) {
  const functionNode = functionInfo.functionNode;
  if (!bodyAlwaysReturns(functionNode)) {
    return result("nonlocal");
  }
  const nextEnvironment = wrapperEnvironment(
    functionNode,
    call,
    context,
    environment,
  );
  if (nextEnvironment === undefined) {
    return result("nonlocal");
  }

  const returns = returnExpressions(functionNode);
  if (returns.length === 0 || returns.some((expression) => expression === undefined)) {
    return result("nonlocal");
  }

  const nextStack = new Set(stack);
  nextStack.add(functionNode);
  return combineResults(
    returns.map((expression) =>
      traceExpression(
        expression,
        context,
        nextEnvironment,
        nextStack,
        depth + 1,
      ),
    ),
  );
}

function traceIdentifier(identifier, context, environment, stack, depth) {
  let symbol;
  try {
    symbol = context.checker.getSymbolAtLocation(identifier);
  } catch {
    return result("incomplete", { sourceNode: identifier });
  }
  if (symbol === undefined) {
    return result("incomplete", { sourceNode: identifier });
  }

  const mappedArgument = environment.get(symbol);
  if (mappedArgument !== undefined) {
    return traceExpression(
      mappedArgument,
      context,
      environment,
      stack,
      depth + 1,
    );
  }

  const declarations = symbol.declarations ?? [];
  if (declarations.some(isImportBindingDeclaration)) {
    return result("nonlocal");
  }

  let resolved = symbol;
  if ((symbol.flags & ts.SymbolFlags.Alias) !== 0) {
    resolved = resolvedSymbolFor(context.checker, symbol);
    if (resolved === undefined) {
      return result("incomplete", { sourceNode: identifier });
    }
  }
  const targetDeclarations = resolved.declarations ?? [];
  if (
    targetDeclarations.length === 0 ||
    targetDeclarations.some(
      (declaration) => declaration.getSourceFile() !== context.sourceFile,
    )
  ) {
    return result("nonlocal");
  }

  const functionDeclaration = targetDeclarations.find(
    (declaration) =>
      ts.isFunctionDeclaration(declaration) && declaration.body !== undefined,
  );
  if (functionDeclaration !== undefined) {
    return localResult(functionDeclaration, functionDeclaration);
  }

  const variableDeclaration = targetDeclarations.find(
    (declaration) =>
      ts.isVariableDeclaration(declaration) &&
      ts.isIdentifier(declaration.name),
  );
  if (variableDeclaration !== undefined) {
    if (stack.has(variableDeclaration)) {
      return result("nonlocal");
    }
    const nextStack = new Set(stack);
    nextStack.add(variableDeclaration);
    return traceVariableDeclaration(
      variableDeclaration,
      context,
      environment,
      nextStack,
      depth,
    );
  }
  return result("nonlocal");
}

function traceCallExpression(call, context, environment, stack, depth) {
  let wrapperName;
  try {
    wrapperName = approvedReactWrapperName(call.expression, context);
  } catch {
    return result("incomplete", { sourceNode: call.expression });
  }
  if (wrapperName !== undefined) {
    const componentArgument = call.arguments[0];
    if (componentArgument === undefined || ts.isSpreadElement(componentArgument)) {
      return result("nonlocal");
    }
    return traceExpression(
      componentArgument,
      context,
      environment,
      stack,
      depth + 1,
    );
  }

  let functionInfo;
  try {
    functionInfo = localFunctionForExpression(call.expression, context);
  } catch {
    return result("incomplete", { sourceNode: call.expression });
  }
  if (functionInfo !== undefined) {
    if (stack.has(functionInfo.functionNode)) {
      return result("nonlocal");
    }
    return traceLocalWrapperCall(
      call,
      functionInfo,
      context,
      environment,
      stack,
      depth,
    );
  }

  let symbol;
  try {
    symbol = context.checker.getSymbolAtLocation(call.expression);
  } catch {
    return result("incomplete", { sourceNode: call.expression });
  }
  return symbol === undefined
    ? result("incomplete", { sourceNode: call.expression })
    : result("nonlocal");
}

function traceExpression(expression, context, environment, stack, depth) {
  if (depth > MAX_PROVENANCE_DEPTH) {
    return result("nonlocal");
  }
  const current = unwrapExpression(expression);
  if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
    return localResult(current);
  }
  if (ts.isIdentifier(current)) {
    return traceIdentifier(current, context, environment, stack, depth);
  }
  if (ts.isConditionalExpression(current)) {
    return combineResults([
      traceExpression(current.whenTrue, context, environment, stack, depth + 1),
      traceExpression(current.whenFalse, context, environment, stack, depth + 1),
    ]);
  }
  if (ts.isBinaryExpression(current)) {
    if (current.operatorToken.kind === ts.SyntaxKind.CommaToken) {
      return traceExpression(
        current.right,
        context,
        environment,
        stack,
        depth + 1,
      );
    }
    if (
      current.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
      current.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      current.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
    ) {
      return combineResults([
        traceExpression(current.left, context, environment, stack, depth + 1),
        traceExpression(current.right, context, environment, stack, depth + 1),
      ]);
    }
  }
  if (ts.isCallExpression(current)) {
    return traceCallExpression(current, context, environment, stack, depth);
  }
  return result("nonlocal");
}

function addExportRoute(routes, exportName, descriptor) {
  const descriptors = routes.get(exportName) ?? [];
  descriptors.push(descriptor);
  routes.set(exportName, descriptors);
}

function addBindingExportRoutes(routes, bindingName, declaration) {
  if (ts.isIdentifier(bindingName)) {
    addExportRoute(routes, bindingName.text, {
      kind: "declaration",
      route: bindingName,
      declaration,
    });
    return;
  }
  if (ts.isObjectBindingPattern(bindingName) || ts.isArrayBindingPattern(bindingName)) {
    for (const element of bindingName.elements) {
      if (ts.isBindingElement(element)) {
        addBindingExportRoutes(routes, element.name, declaration);
      }
    }
  }
}

function exportRoutesFor(sourceFile) {
  const routes = new Map();
  const starExports = [];

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause === undefined) {
        if (statement.moduleSpecifier !== undefined && !statement.isTypeOnly) {
          starExports.push(statement);
        }
        continue;
      }
      if (ts.isNamedExports(statement.exportClause)) {
        for (const specifier of statement.exportClause.elements) {
          if (statement.isTypeOnly || specifier.isTypeOnly) {
            continue;
          }
          if (statement.moduleSpecifier !== undefined) {
            addExportRoute(routes, specifier.name.text, {
              kind: "reexport",
              route: specifier,
            });
          } else {
            addExportRoute(routes, specifier.name.text, {
              kind: "local-reference",
              route: specifier,
              valueNode: specifier.propertyName ?? specifier.name,
            });
          }
        }
      } else if (ts.isNamespaceExport(statement.exportClause)) {
        addExportRoute(routes, statement.exportClause.name.text, {
          kind: "reexport",
          route: statement.exportClause,
        });
      }
      continue;
    }

    if (ts.isExportAssignment(statement)) {
      addExportRoute(routes, statement.isExportEquals ? "export=" : "default", {
        kind: "expression",
        route: statement.expression,
        valueNode: statement.expression,
      });
      continue;
    }

    const modifiers = ts.getModifiers(statement) ?? [];
    const isDefault = modifiers.some(
      (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
    );
    const isExported =
      isDefault ||
      modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (!isExported) {
      continue;
    }

    if (isDefault) {
      addExportRoute(routes, "default", {
        kind: "declaration",
        route: statement.name ?? statement,
        declaration: statement,
      });
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        addBindingExportRoutes(routes, declaration.name, declaration);
      }
    } else if (statement.name !== undefined) {
      addExportRoute(routes, statement.name.text, {
        kind: "declaration",
        route: statement.name,
        declaration: statement,
      });
    }
  }

  return { routes, starExports };
}

function descriptorForExport(exportName, routes, starExports) {
  const descriptors = routes.get(exportName) ?? [];
  if (descriptors.length === 1) {
    return descriptors[0];
  }
  if (descriptors.length > 1) {
    return { kind: "ambiguous", route: descriptors[0].route };
  }
  if (starExports.length > 0) {
    return { kind: "reexport", route: starExports[0] };
  }
  return undefined;
}

function traceDescriptor(descriptor, context) {
  if (descriptor === undefined || descriptor.kind === "reexport" || descriptor.kind === "ambiguous") {
    return result("nonlocal");
  }
  if (descriptor.kind === "declaration") {
    const traced = traceLocalDeclaration(
      descriptor.declaration,
      context,
      new Map(),
      new Set(),
      0,
    );
    if (traced.kind !== "local") {
      return traced;
    }
    return { ...traced, bindingDeclaration: descriptor.declaration };
  }
  if (descriptor.kind === "local-reference" || descriptor.kind === "expression") {
    return traceExpression(
      descriptor.valueNode,
      context,
      new Map(),
      new Set(),
      0,
    );
  }
  return result("nonlocal");
}

function recordIncomplete(analysis, sourceNode, reason) {
  if (typeof analysis.requireResolvedSemanticInformation === "function") {
    analysis.requireResolvedSemanticInformation(undefined, sourceNode, reason);
    return;
  }
  analysis.evaluationErrors.push({
    kind: "semantic-resolution",
    filePath: sourceNode?.getSourceFile().fileName,
    message: `Could not resolve ${reason}.`,
  });
}

function callableExportCandidates(analysis, selectedFile) {
  const { checker } = analysis;
  const { sourceFile, displayPath } = selectedFile;
  if (!ts.isExternalModule(sourceFile)) {
    return [];
  }
  if (checker === undefined) {
    recordIncomplete(
      analysis,
      sourceFile,
      "callable export information required by framework compatibility analysis",
    );
    return [];
  }

  let moduleSymbol;
  let exportedSymbols;
  try {
    moduleSymbol = sourceFile.symbol ?? checker.getSymbolAtLocation(sourceFile);
    if (moduleSymbol === undefined) {
      throw new Error("The selected module has no TypeScript symbol.");
    }
    exportedSymbols = checker.getExportsOfModule(moduleSymbol);
  } catch {
    recordIncomplete(
      analysis,
      sourceFile,
      "module export information required by framework compatibility analysis",
    );
    return [];
  }

  const { routes, starExports } = exportRoutesFor(sourceFile);
  const candidates = [];
  for (const exportedSymbol of exportedSymbols) {
    const exportName = exportedSymbol.getName();
    const descriptor = descriptorForExport(exportName, routes, starExports);
    const sourceNode = descriptor?.route ?? sourceFile;
    let targetSymbol = exportedSymbol;
    if ((targetSymbol.flags & ts.SymbolFlags.Alias) !== 0) {
      targetSymbol = resolvedSymbolFor(checker, targetSymbol);
      if (targetSymbol === undefined) {
        recordIncomplete(
          analysis,
          sourceNode,
          "callable export symbol required by framework compatibility analysis",
        );
        candidates.push({
          selectedFile,
          exportName,
          descriptor,
          route: sourceNode,
          outcome: "incomplete",
          reason: "unresolved export symbol",
        });
        continue;
      }
    }
    if ((targetSymbol.flags & ts.SymbolFlags.Value) === 0) {
      continue;
    }

    const declaration =
      targetSymbol.valueDeclaration ?? targetSymbol.declarations?.[0] ?? sourceNode;
    let exportedType;
    try {
      exportedType = checker.getTypeOfSymbolAtLocation(targetSymbol, declaration);
    } catch {
      recordIncomplete(
        analysis,
        sourceNode,
        "callable export type required by framework compatibility analysis",
      );
      candidates.push({
        selectedFile,
        exportName,
        descriptor,
        route: sourceNode,
        outcome: "incomplete",
        reason: "unresolved callable export type",
      });
      continue;
    }

    if (
      exportedType === undefined ||
      (exportedType.flags & UNRESOLVED_TYPE_FLAGS) !== 0
    ) {
      recordIncomplete(
        analysis,
        sourceNode,
        "callable export information required by framework compatibility analysis",
      );
      candidates.push({
        selectedFile,
        exportName,
        descriptor,
        route: sourceNode,
        outcome: "incomplete",
        reason: "unresolved callable export type",
      });
      continue;
    }

    let signatures;
    try {
      signatures = checker.getSignaturesOfType(exportedType, ts.SignatureKind.Call);
    } catch {
      recordIncomplete(
        analysis,
        sourceNode,
        "call signatures required by framework compatibility analysis",
      );
      candidates.push({
        selectedFile,
        exportName,
        descriptor,
        route: sourceNode,
        outcome: "incomplete",
        reason: "unresolved callable signatures",
      });
      continue;
    }
    if (signatures.length === 0) {
      continue;
    }

    candidates.push({
      selectedFile,
      exportName,
      descriptor,
      route: sourceNode,
      outcome: "pending",
      reason: "callable export requires compatibility analysis",
    });
  }
  return candidates;
}

function provenanceForCandidate(candidate, analysis, selectedFile) {
  if (candidate.outcome === "incomplete") {
    return result("incomplete", { sourceNode: candidate.route });
  }
  const context = {
    checker: analysis.checker,
    sourceFile: selectedFile.sourceFile,
  };
  let provenance;
  try {
    provenance = traceDescriptor(candidate.descriptor, context);
  } catch {
    return result("incomplete", { sourceNode: candidate.route });
  }
  if (provenance.kind === "incomplete") {
    recordIncomplete(
      analysis,
      provenance.sourceNode ?? candidate.route,
      "local callable implementation provenance required by framework compatibility analysis",
    );
  }
  return provenance;
}

function moduleSpecifierFor(sourcePath, probePath) {
  const extension = extname(sourcePath);
  let specifier = relative(
    resolve(probePath, ".."),
    extension.length === 0
      ? sourcePath
      : sourcePath.slice(0, -extension.length),
  ).split(sep).join("/");
  if (!specifier.startsWith(".")) {
    specifier = `./${specifier}`;
  }
  return specifier;
}

function newProbePath(cwd, program) {
  const baseName = "__tightscript_compatibility_probe__";
  let suffix = 0;
  while (true) {
    const name = suffix === 0 ? baseName : `${baseName}_${suffix}`;
    const candidatePath = resolve(cwd, `${name}.tsx`);
    if (program.getSourceFile(candidatePath) === undefined && !ts.sys.fileExists(candidatePath)) {
      return candidatePath;
    }
    suffix += 1;
  }
}

function probeReactComponents(analysis, candidates, cwd) {
  const results = new Map(candidates.map((candidate) => [candidate, "accepted"]));
  if (candidates.length === 0) {
    return results;
  }

  const originalProgram = analysis.program;
  if (originalProgram === undefined) {
    for (const candidate of candidates) {
      recordIncomplete(
        analysis,
        candidate.route,
        "configured JSX component semantics required by REQ-004",
      );
      results.set(candidate, "incomplete");
    }
    return results;
  }

  const probePath = newProbePath(cwd, originalProgram);
  const ranges = new Map();
  let probeText = 'import * as React from "react";\nvoid React;\n';
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const alias = `__tightscript_component_${index}`;
    const exportName = candidate.exportName;
    const importStart = probeText.length;
    const moduleSpecifier = moduleSpecifierFor(
      candidate.selectedFile.filePath,
      probePath,
    );
    if (
      exportName !== "default" &&
      !ts.isIdentifierText(exportName, ts.ScriptTarget.Latest)
    ) {
      recordIncomplete(
        analysis,
        candidate.route,
        "a JSX probe import for the exported component",
      );
      results.set(candidate, "incomplete");
      continue;
    }
    probeText +=
      exportName === "default"
        ? `import ${alias} from ${JSON.stringify(moduleSpecifier)};\n`
        : `import { ${exportName} as ${alias} } from ${JSON.stringify(moduleSpecifier)};\n`;
    const importEnd = probeText.length;
    probeText += `const __tightscript_result_${index} = <${alias} {...({} as any)} />;\n`;
    ranges.set(candidate, {
      importStart,
      importEnd,
      elementStart: importEnd,
      elementEnd: probeText.length,
    });
  }

  const compilerOptions = originalProgram.getCompilerOptions();
  const host = ts.createCompilerHost(compilerOptions);
  const originalFileExists = host.fileExists.bind(host);
  const originalReadFile = host.readFile.bind(host);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getCurrentDirectory = () => cwd;
  host.fileExists = (fileName) =>
    resolve(fileName) === probePath || originalFileExists(fileName);
  host.readFile = (fileName) =>
    resolve(fileName) === probePath ? probeText : originalReadFile(fileName);
  host.getSourceFile = (
    fileName,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
  ) => {
    if (resolve(fileName) === probePath) {
      const target =
        typeof languageVersion === "object"
          ? languageVersion.languageVersion
          : languageVersion;
      return ts.createSourceFile(
        probePath,
        probeText,
        target ?? ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
    }
    return originalGetSourceFile(
      fileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile,
    );
  };

  let probeProgram;
  let probeSourceFile;
  try {
    probeProgram = ts.createProgram(
      [...originalProgram.getRootFileNames(), probePath],
      compilerOptions,
      host,
    );
    probeSourceFile = probeProgram.getSourceFile(probePath);
    if (probeSourceFile === undefined) {
      throw new Error("TypeScript could not create the in-memory JSX probe.");
    }
  } catch {
    for (const candidate of candidates) {
      recordIncomplete(
        analysis,
        candidate.route,
        "configured JSX component semantics required by REQ-004",
      );
      results.set(candidate, "incomplete");
    }
    return results;
  }

  let diagnostics;
  try {
    diagnostics = probeProgram.getSemanticDiagnostics(probeSourceFile);
  } catch {
    diagnostics = undefined;
  }
  if (diagnostics === undefined) {
    for (const candidate of candidates) {
      recordIncomplete(
        analysis,
        candidate.route,
        "configured JSX component semantics required by REQ-004",
      );
      results.set(candidate, "incomplete");
    }
    return results;
  }

  for (const diagnostic of diagnostics) {
    let candidateRange;
    let candidate;
    if (diagnostic.start !== undefined) {
      for (const [possibleCandidate, range] of ranges) {
        if (
          diagnostic.start >= range.importStart &&
          diagnostic.start < range.importEnd
        ) {
          candidate = possibleCandidate;
          candidateRange = range;
          break;
        }
        if (
          diagnostic.start >= range.elementStart &&
          diagnostic.start < range.elementEnd
        ) {
          candidate = possibleCandidate;
          candidateRange = range;
          break;
        }
      }
    }

    if (
      candidate !== undefined &&
      candidateRange !== undefined &&
      diagnostic.start >= candidateRange.elementStart &&
      diagnostic.start < candidateRange.elementEnd &&
      JSX_COMPONENT_DIAGNOSTICS.has(diagnostic.code)
    ) {
      if (results.get(candidate) === "accepted") {
        results.set(candidate, "ineligible");
      }
      continue;
    }

    const affected = candidate === undefined ? candidates : [candidate];
    for (const affectedCandidate of affected) {
      recordIncomplete(
        analysis,
        affectedCandidate.route,
        "configured JSX component semantics and resolved React types required by REQ-004",
      );
      results.set(affectedCandidate, "incomplete");
    }
  }

  return results;
}

function bindingName(declaration) {
  if (ts.isFunctionDeclaration(declaration) && ts.isIdentifier(declaration.name)) {
    return declaration.name.text;
  }
  if (
    ts.isVariableDeclaration(declaration) &&
    ts.isIdentifier(declaration.name)
  ) {
    return declaration.name.text;
  }
  return undefined;
}

/** Analyse callable exports for the approved React and Next.js compatibility exceptions. */
// @see [react-next-compatibility: the analyser evaluates only source files already selected for TypeScript analysis.](./framework-compatibility.md#react-next-compatibility-req-001)
// @see [react-next-compatibility: the analyser consumes the include-selected roots without expanding the source set.](./framework-compatibility.md#react-next-compatibility-req-002)
// @see [react-next-compatibility: the analyser requires checker-accepted JSX and proven same-file React implementations.](./framework-compatibility.md#react-next-compatibility-req-004)
// @see [react-next-compatibility: the analyser grants Next.js eligibility only for listed roles, exports, and local implementations.](./framework-compatibility.md#react-next-compatibility-req-005)
// @see [react-next-compatibility: unsupported or unresolved Next.js cases remain ineligible or incomplete.](./framework-compatibility.md#react-next-compatibility-req-006)
// @see [react-next-compatibility: only the exact local Pages Router export declaration enters the REQ-031 exception set.](./framework-compatibility.md#react-next-compatibility-req-009)
// @see [react-next-compatibility: other lowercase `get` declarations are not added to the exception set.](./framework-compatibility.md#react-next-compatibility-req-010)
// @see [react-next-compatibility: the analyser marks an export eligible only after every applicable condition succeeds.](./framework-compatibility.md#react-next-compatibility-req-011)
// @see [react-next-compatibility: unresolved semantic conditions are recorded as incomplete rather than exempted.](./framework-compatibility.md#react-next-compatibility-req-012)
// @see [react-next-compatibility: the analyser requires positive proof before granting a callable-export exception.](./framework-compatibility.md#react-next-compatibility-prop-req-004-01)
// @see [react-next-compatibility: the analyser identifies only exact local Pages Router bindings for REQ-031.](./framework-compatibility.md#react-next-compatibility-prop-req-009-01)
// @see [react-next-compatibility: the analyser leaves unselected files and semantic probes outside policy roots.](./framework-compatibility.md#react-next-compatibility-prop-req-001-01)
export function analyzeFrameworkCompatibility(analysis, options = {}) {
  const cwd = resolve(options.cwd ?? process.cwd());
  let frameworkContext = options.frameworkContext;
  if (frameworkContext === undefined) {
    try {
      frameworkContext = resolveFrameworkContext(cwd);
    } catch {
      frameworkContext = {
        next: { status: "indeterminate" },
        routingConfiguration: { status: "indeterminate" },
      };
    }
  }

  const decisions = [];
  const eligibleReq018Routes = new Set();
  const eligibleReq031Declarations = new Set();
  const pendingReactCandidates = [];

  for (const selectedFile of analysis.sourceFiles) {
    const candidates = callableExportCandidates(analysis, selectedFile);
    for (const candidate of candidates) {
      const decision = {
        filePath: selectedFile.displayPath,
        exportName: candidate.exportName,
        route: candidate.route,
        outcome: candidate.outcome,
        reason: candidate.reason,
        bindingDeclaration: undefined,
        frameworkRole: undefined,
      };
      decisions.push(decision);
      candidate.decision = decision;
      if (candidate.outcome === "incomplete") {
        continue;
      }

      const provenance = provenanceForCandidate(candidate, analysis, selectedFile);
      if (provenance.kind === "incomplete") {
        decision.outcome = "incomplete";
        decision.reason = "local implementation provenance could not be resolved";
        continue;
      }
      if (provenance.kind !== "local") {
        decision.outcome = "ineligible";
        decision.reason = "no same-file local callable implementation is proven";
        continue;
      }
      decision.bindingDeclaration =
        candidate.descriptor?.declaration ?? provenance.bindingDeclaration;

      const nextStatus = frameworkContext?.next?.status;
      if (nextStatus === "indeterminate" || nextStatus === undefined) {
        recordIncomplete(
          analysis,
          candidate.route,
          "the consuming project's Next.js context required by framework compatibility analysis",
        );
        decision.outcome = "incomplete";
        decision.reason = "Next.js project context is indeterminate";
        continue;
      }
      if (nextStatus === "unsupported") {
        decision.outcome = "ineligible";
        decision.reason = "resolved Next.js version is not in the compatibility table";
        continue;
      }
      if (nextStatus === "supported") {
        const routingStatus = frameworkContext.routingConfiguration?.status;
        if (routingStatus === "indeterminate" || routingStatus === undefined) {
          recordIncomplete(
            analysis,
            candidate.route,
            "routing configuration required to determine a Next.js module role",
          );
          decision.outcome = "incomplete";
          decision.reason = "Next.js routing configuration is indeterminate";
          continue;
        }
        if (routingStatus !== "default") {
          decision.outcome = "ineligible";
          decision.reason = "routing configuration does not establish default file roles";
          continue;
        }

        let classification;
        try {
          classification = classifyNextModule(
            selectedFile.filePath,
            cwd,
            frameworkContext,
          );
        } catch {
          recordIncomplete(
            analysis,
            candidate.route,
            "the Next.js module role required by framework compatibility analysis",
          );
          decision.outcome = "incomplete";
          decision.reason = "Next.js module role could not be classified";
          continue;
        }
        decision.frameworkRole = classification?.role;
        if (
          classification === null ||
          !classification.exportNames.includes(candidate.exportName)
        ) {
          decision.outcome = "ineligible";
          decision.reason = "export is absent from the resolved Next.js compatibility table";
          continue;
        }
        decision.outcome = "eligible";
        decision.reason = "callable export has a listed Next.js role and local implementation";
        continue;
      }

      if (nextStatus === "absent") {
        pendingReactCandidates.push(candidate);
        decision.reason = "local implementation awaits configured JSX component analysis";
        continue;
      }

      recordIncomplete(
        analysis,
        candidate.route,
        "the consuming project's framework context required by compatibility analysis",
      );
      decision.outcome = "incomplete";
      decision.reason = "framework context has an unknown state";
    }
  }

  const jsxResults = probeReactComponents(analysis, pendingReactCandidates, cwd);
  for (const candidate of pendingReactCandidates) {
    const status = jsxResults.get(candidate);
    const decision = candidate.decision;
    if (status === "accepted") {
      decision.outcome = "eligible";
      decision.reason = "local implementation is accepted as a JSX component";
    } else if (status === "ineligible") {
      decision.outcome = "ineligible";
      decision.reason = "the exported value is not accepted as a JSX component";
    } else {
      decision.outcome = "incomplete";
      decision.reason = "required JSX component semantics are incomplete";
    }
  }

  for (const decision of decisions) {
    if (decision.outcome !== "eligible" || decision.route === undefined) {
      continue;
    }
    eligibleReq018Routes.add(decision.route);
    if (
      decision.frameworkRole === "pages-page-route" &&
      PAGES_DATA_EXPORTS.has(decision.exportName) &&
      decision.bindingDeclaration !== undefined &&
      bindingName(decision.bindingDeclaration) === decision.exportName &&
      (ts.isFunctionDeclaration(decision.bindingDeclaration) ||
        ts.isVariableDeclaration(decision.bindingDeclaration))
    ) {
      eligibleReq031Declarations.add(decision.bindingDeclaration);
    }
  }

  return {
    frameworkContext,
    decisions,
    eligibleReq018Routes,
    eligibleReq031Declarations,
  };
}
