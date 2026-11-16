import ts from "typescript";

const REQUIREMENT_ID = "REQ-022";
const PARAMETER_PROPERTY_MODIFIERS = new Set([
  ts.SyntaxKind.PublicKeyword,
  ts.SyntaxKind.PrivateKeyword,
  ts.SyntaxKind.ProtectedKeyword,
  ts.SyntaxKind.ReadonlyKeyword,
]);

function modifiersOf(node) {
  return ts.canHaveModifiers(node) ? (ts.getModifiers(node) ?? []) : [];
}

function hasModifier(node, modifierKind) {
  return modifiersOf(node).some((modifier) => modifier.kind === modifierKind);
}

function isStatic(member) {
  return hasModifier(member, ts.SyntaxKind.StaticKeyword);
}

function isPrivate(member) {
  return (
    hasModifier(member, ts.SyntaxKind.PrivateKeyword) ||
    (member.name !== undefined && ts.isPrivateIdentifier(member.name))
  );
}

function isInstancePropertyOrAccessor(member) {
  return (
    ts.isPropertyDeclaration(member) ||
    ts.isGetAccessorDeclaration(member) ||
    ts.isSetAccessorDeclaration(member)
  );
}

function isConstructorParameterProperty(parameter) {
  return modifiersOf(parameter).some((modifier) =>
    PARAMETER_PROPERTY_MODIFIERS.has(modifier.kind),
  );
}

function isPublicConstructorParameterProperty(parameter) {
  return (
    isConstructorParameterProperty(parameter) &&
    !hasModifier(parameter, ts.SyntaxKind.PrivateKeyword) &&
    !hasModifier(parameter, ts.SyntaxKind.ProtectedKeyword)
  );
}

function isDto(classDeclaration) {
  for (const member of classDeclaration.members) {
    if (ts.isMethodDeclaration(member)) {
      return false;
    }

    if (
      isInstancePropertyOrAccessor(member) &&
      !isStatic(member)
    ) {
      return false;
    }

    if (ts.isConstructorDeclaration(member)) {
      for (const parameter of member.parameters) {
        if (
          isConstructorParameterProperty(parameter) &&
          !isPublicConstructorParameterProperty(parameter)
        ) {
          return false;
        }
      }
    }
  }

  return true;
}

function diagnosticAt(sourceFile, filePath, node, message) {
  const start = node.getStart(sourceFile);
  const location = sourceFile.getLineAndCharacterOfPosition(start);
  return {
    filePath,
    line: location.line + 1,
    column: location.character + 1,
    requirementId: REQUIREMENT_ID,
    message,
    start,
  };
}

function violationsForClass(selectedFile, classDeclaration) {
  if (isDto(classDeclaration)) {
    return [];
  }

  const { sourceFile, displayPath } = selectedFile;
  const violations = [];
  for (const member of classDeclaration.members) {
    if (
      isInstancePropertyOrAccessor(member) &&
      !isStatic(member) &&
      !isPrivate(member)
    ) {
      violations.push(
        diagnosticAt(
          sourceFile,
          displayPath,
          member,
          `Instance property or accessor "${member.name.getText(sourceFile)}" must be private.`,
        ),
      );
    }

    if (!ts.isConstructorDeclaration(member)) {
      continue;
    }

    for (const parameter of member.parameters) {
      if (
        isConstructorParameterProperty(parameter) &&
        !isPrivate(parameter)
      ) {
        violations.push(
          diagnosticAt(
            sourceFile,
            displayPath,
            parameter,
            `Constructor parameter property "${parameter.name.getText(sourceFile)}" must be private.`,
          ),
        );
      }
    }
  }

  return violations;
}

/** Find REQ-022 violations in class declarations and expressions. */
// @see [Tightscript: private-state findings include their source and requirement ID.](./diagnostics.md#tightscript-req-004)
// @see [Tightscript: class analysis enforces private instance state outside DTOs.](./class-state.md#tightscript-req-022)
// @see [Tightscript: class analysis applies the DTO exception only to its approved parameter-property shape.](./class-state.md#tightscript-req-023)
// @see [Tightscript: private-state findings retain the source and rule details required of every diagnostic.](./diagnostics.md#tightscript-prop-req-004-01)
export function findPrivateInstanceStateViolations(sourceFiles) {
  const violations = [];

  for (const selectedFile of sourceFiles) {
    const { sourceFile } = selectedFile;

    function visit(node) {
      if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
        violations.push(...violationsForClass(selectedFile, node));
      }
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return violations;
}
