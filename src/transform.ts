import {
  EmitHint,
  NewLineKind,
  PropertySignature,
  ScriptKind,
  ScriptTarget,
  SyntaxKind,
  TypeNode,
  addSyntheticLeadingComment,
  createPrinter,
  createSourceFile,
  factory
} from 'typescript'

export interface YApiBody {
  type: string

  required?: string[]
  title?: string

  /** type === 'array' */
  items?: YApiBody

  /** type === 'object' */
  properties?: {
    [key: string]: YApiBody
  }
}

export function transformByYApiBody(source: YApiBody, name = 'Struct') {
  if (!source.type) {
    return ''
  }

  const resultFile = createSourceFile(
    "someFileName.ts",
    "",
    ScriptTarget.Latest,
    false,
    ScriptKind.TS
  )

  const printer = createPrinter({ newLine: NewLineKind.LineFeed })
  const signature = makeInterface(source, name)

  return printer.printNode(EmitHint.Unspecified, signature, resultFile).replace(/;/g, '')
}

export function makeInterface(source: YApiBody, name: string) {

  const generateRecursive = (source: YApiBody, name: string, isRequired = false): PropertySignature => {
    const requiredMap: Record<string, boolean> = {}
    source.required?.forEach(key => (requiredMap[key] = true))

    let node: PropertySignature
    if (source.type === 'array') {
      if (source.items?.properties) {
        const properties = source.items.properties
        const keys = Object.keys(properties)
        const typeNodes: PropertySignature[] = []

        for (const key of keys) {
          const value = properties[key]
          typeNodes.push(generateRecursive(value, key, requiredMap[key]))
        }

        node = createPropertySignature(
          name,
          isRequired,
          factory.createArrayTypeNode(factory.createTypeLiteralNode(typeNodes))
        )
      } else {
        node = createPropertySignature(
          name,
          isRequired,
          factory.createArrayTypeNode(factory.createKeywordTypeNode(parseSimpleType(source.type)))
        )
      }
    } else if (source.type === 'object' && source.properties) {
      const keys = Object.keys(source.properties)
      const typeNodes: PropertySignature[] = []

      for (const key of keys) {
        const value = source.properties[key]
        typeNodes.push(generateRecursive(value, key, requiredMap[key]))
      }

      node = createPropertySignature(
        name,
        isRequired,
        factory.createTypeLiteralNode(typeNodes)
      )
    } else {
      node = createPropertySignature(
        name,
        isRequired,
        factory.createKeywordTypeNode(parseSimpleType(source.type))
      )
    }

    if (source.title) {
      addSyntheticLeadingComment(node, SyntaxKind.MultiLineCommentTrivia, source.title, true)
    }

    return node
  }

  return generateRecursive(source, name, true)
}

function createPropertySignature(name: string, isRequired: boolean, childNode: TypeNode) {
  return factory.createPropertySignature(
    undefined,
    factory.createIdentifier(name),
    isRequired ? undefined : factory.createToken(SyntaxKind.QuestionToken),
    childNode
  )
}

function parseSimpleType(type: string) {
  switch (type) {
    case 'string':
      return SyntaxKind.StringKeyword

    case 'number':
      return SyntaxKind.NumberKeyword

    case 'boolean':
      return SyntaxKind.BooleanKeyword

    default:
      return SyntaxKind.StringKeyword
  }
}
