import ts from "typescript";

const REQUIREMENT_ID = "REQ-024";
const CALLABLE_FUNCTION_REQUIREMENT_ID = "REQ-026";
const SIGNATURE_KINDS = [
  { kind: ts.SignatureKind.Call, label: "call" },
  { kind: ts.SignatureKind.Construct, label: "construct" },
];
const UNRESOLVED_TYPE_FLAGS =
  ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.TypeParameter;

function diagnosticAt(sourceFile, filePath, node, requirementId, message) {
  const start = node.getStart(sourceFile);
  const location = sourceFile.getLineAndCharacterOfPosition(start);
  return {
    filePath,
    line: location.line + 1,
    column: location.character + 1,
    requirementId,
    message,
    start,
  };
}

function reportUnresolvedHeritage(analysis, heritage) {
  analysis.requireResolvedSemanticInformation(
    undefined,
    heritage,
    "interface heritage required by REQ-024",
  );
}

function symbolName(symbol) {
  return symbol?.getName?.() ?? symbol?.name;
}

function resolveHeritage(analysis, heritage) {
  const { checker } = analysis;
  if (checker === undefined) {
    reportUnresolvedHeritage(analysis, heritage);
    return undefined;
  }

  try {
    let symbol = checker.getSymbolAtLocation(heritage.expression);
    const type = checker.getTypeAtLocation(heritage);
    if (symbol?.flags !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0) {
      symbol = checker.getAliasedSymbol(symbol);
    }

    if (
      symbol === undefined ||
      type === undefined ||
      (type.flags & UNRESOLVED_TYPE_FLAGS) !== 0
    ) {
      reportUnresolvedHeritage(analysis, heritage);
      return undefined;
    }

    return { symbol, type };
  } catch {
    reportUnresolvedHeritage(analysis, heritage);
    return undefined;
  }
}

function interfaceDeclarationsFor(type) {
  const declarations = new Set();
  const seenTypes = new Set();

  function visit(currentType) {
    if (currentType === undefined || currentType === null || seenTypes.has(currentType)) {
      return;
    }
    seenTypes.add(currentType);

    const symbols = [
      currentType.getSymbol?.(),
      currentType.symbol,
      currentType.target?.symbol,
    ];
    for (const symbol of symbols) {
      for (const declaration of symbol?.declarations ?? []) {
        if (ts.isInterfaceDeclaration(declaration)) {
          declarations.add(declaration);
        }
      }
    }

    for (const constituent of currentType.types ?? []) {
      visit(constituent);
    }
  }

  visit(type);
  return declarations;
}

function ensureHeritageChainResolvable(analysis, type, visitedInterfaces) {
  for (const declaration of interfaceDeclarationsFor(type)) {
    if (visitedInterfaces.has(declaration)) {
      continue;
    }
    visitedInterfaces.add(declaration);

    for (const clause of declaration.heritageClauses ?? []) {
      for (const heritage of clause.types) {
        const resolved = resolveHeritage(analysis, heritage);
        if (resolved !== undefined) {
          ensureHeritageChainResolvable(
            analysis,
            resolved.type,
            visitedInterfaces,
          );
        }
      }
    }
  }
}

function signatureViolations(analysis, selectedFile, interfaceDeclaration, heritage, baseType) {
  const { sourceFile, displayPath } = selectedFile;
  const violations = [];

  for (const { kind, label } of SIGNATURE_KINDS) {
    let signatures;
    try {
      signatures = analysis.checker.getSignaturesOfType(baseType, kind);
    } catch {
      reportUnresolvedHeritage(analysis, heritage);
      continue;
    }

    if (signatures.length > 0) {
      violations.push(
        diagnosticAt(
          sourceFile,
          displayPath,
          heritage,
          REQUIREMENT_ID,
          `Interface "${interfaceDeclaration.name.text}" must not inherit ${label} signatures.`,
        ),
      );
    }
  }

  return violations;
}

function violationsForInterface(analysis, selectedFile, interfaceDeclaration) {
  const { sourceFile, displayPath } = selectedFile;
  const violations = [];

  for (const member of interfaceDeclaration.members) {
    if (ts.isPropertySignature(member)) {
      violations.push(
        diagnosticAt(
          sourceFile,
          displayPath,
          member,
          REQUIREMENT_ID,
          `Interface data property "${member.name.getText(sourceFile)}" is not permitted; interfaces may declare methods only.`,
        ),
      );
    } else if (ts.isIndexSignatureDeclaration(member)) {
      violations.push(
        diagnosticAt(
          sourceFile,
          displayPath,
          member,
          REQUIREMENT_ID,
          "Interface index signatures are not permitted.",
        ),
      );
    } else if (ts.isCallSignatureDeclaration(member)) {
      violations.push(
        diagnosticAt(
          sourceFile,
          displayPath,
          member,
          REQUIREMENT_ID,
          "Interface call signatures are not permitted.",
        ),
      );
    } else if (ts.isConstructSignatureDeclaration(member)) {
      violations.push(
        diagnosticAt(
          sourceFile,
          displayPath,
          member,
          REQUIREMENT_ID,
          "Interface construct signatures are not permitted.",
        ),
      );
    }
  }

  const visitedInterfaces = new Set([interfaceDeclaration]);
  for (const clause of interfaceDeclaration.heritageClauses ?? []) {
    for (const heritage of clause.types) {
      const resolved = resolveHeritage(analysis, heritage);
      if (resolved === undefined) {
        continue;
      }

      if (symbolName(resolved.symbol) === "CallableFunction") {
        violations.push(
          diagnosticAt(
            sourceFile,
            displayPath,
            heritage,
            CALLABLE_FUNCTION_REQUIREMENT_ID,
            "Interfaces must not extend CallableFunction.",
          ),
        );
      }

      violations.push(
        ...signatureViolations(
          analysis,
          selectedFile,
          interfaceDeclaration,
          heritage,
          resolved.type,
        ),
      );
      ensureHeritageChainResolvable(
        analysis,
        resolved.type,
        visitedInterfaces,
      );
    }
  }

  return violations;
}

/** Find REQ-024 and REQ-026 violations in selected interface declarations. */
export function findInterfaceViolations(analysis) {
  const violations = [];

  for (const selectedFile of analysis.sourceFiles) {
    function visit(node) {
      if (ts.isInterfaceDeclaration(node)) {
        violations.push(
          ...violationsForInterface(analysis, selectedFile, node),
        );
      }
      ts.forEachChild(node, visit);
    }

    visit(selectedFile.sourceFile);
  }

  return violations;
}
