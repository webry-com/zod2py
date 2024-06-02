import { z } from "zod"
import {
  capitalizeAndFormatClassName,
  getDiscriminator,
  numberToLetter,
  primitiveToNaming,
  primitiveToPy,
} from "./utils.js"

export type PyStructure = {
  name: string
  fields: string[]
  type: "dataclass" | "enum"
}

export type TranslateResult =
  | {
      success: false
    }
  | {
      success: true
      code: string
      imports: string[]
      dataStructure: PyStructure[]
    }

export type TranslateBase<T extends z.ZodTypeAny = z.ZodTypeAny> = {
  zodType: T
  path: string
  name?: string
}

export type Translator = (base: TranslateBase) => TranslateResult

export default class ZodTranslator {
  private schema: z.ZodTypeAny

  constructor(schema: z.ZodTypeAny) {
    this.schema = schema
  }

  /* #region Handlers */

  handlerZodObject(base: TranslateBase<z.ZodObject<any>>): TranslateResult {
    base.path ||= base.name || "Unnamed"
    const className = capitalizeAndFormatClassName(base.path)

    const fields = base.zodType.shape
    const accumulatedImports: string[] = []
    const accumulatedDataclasses: PyStructure[] = []
    const fieldEntries = Object.entries(fields).map(([key, value]) => {
      const nestedPath = base.path ? `${base.path}~${key}` : key
      const pythonTypeResult = this.translate({
        zodType: value as z.ZodTypeAny,
        path: nestedPath,
        name: "",
      })
      if (!pythonTypeResult.success) {
        accumulatedImports.push("any")
        return `${key}: Any`
      }

      accumulatedImports.push(...pythonTypeResult.imports)
      accumulatedDataclasses.push(...pythonTypeResult.dataStructure)
      const pythonType = pythonTypeResult.code
      return `${key}: ${pythonType}`
    })

    return {
      success: true,
      code: className,
      imports: [...accumulatedImports, "dataclass"],
      dataStructure: [
        {
          name: className,
          fields: fieldEntries,
          type: "dataclass",
        },
        ...accumulatedDataclasses,
      ],
    }
  }

  handlerZodArray(base: TranslateBase<z.ZodArray<z.ZodUnknown>>): TranslateResult {
    const result = this.translate({
      zodType: base.zodType.element,
      path: base.path,
      name: base.name,
    })
    if (!result.success) return result

    return {
      success: true,
      code: `list[${result.code}]`,
      imports: result.imports,
      dataStructure: result.dataStructure,
    }
  }

  handlerZodString(): TranslateResult {
    return {
      success: true,
      code: `str`,
      imports: [],
      dataStructure: [],
    }
  }

  handlerZodNumber(): TranslateResult {
    return {
      success: true,
      code: `float`,
      imports: [],
      dataStructure: [],
    }
  }

  handlerZodBigInt(): TranslateResult {
    return {
      success: true,
      code: `float`,
      imports: [],
      dataStructure: [],
    }
  }

  handlerZodBoolean(): TranslateResult {
    return {
      success: true,
      code: `bool`,
      imports: [],
      dataStructure: [],
    }
  }

  handlerZodUnknown(): TranslateResult {
    return {
      success: true,
      code: "Any",
      imports: ["any"],
      dataStructure: [],
    }
  }

  handlerZodUndefined(): TranslateResult {
    return {
      success: true,
      code: "None",
      imports: [],
      dataStructure: [],
    }
  }

  handlerZodSymbol(): TranslateResult {
    return {
      success: true,
      code: "Any",
      imports: ["any"],
      dataStructure: [],
    }
  }

  handlerZodError(): TranslateResult {
    return {
      success: true,
      code: "Any",
      imports: ["any"],
      dataStructure: [],
    }
  }

  handlerZodNever(): TranslateResult {
    return {
      success: true,
      code: "None",
      imports: [],
      dataStructure: [],
    }
  }

  handlerZodPromise(): TranslateResult {
    return {
      success: true,
      code: "Any",
      imports: ["any"],
      dataStructure: [],
    }
  }

  handlerZodUnion(
    base: TranslateBase<z.ZodUnion<readonly [z.ZodTypeAny, ...z.ZodTypeAny[]]>>,
  ): TranslateResult {
    const results = base.zodType.options.map((option) =>
      this.translate({ zodType: option, path: base.path, name: base.name }),
    )
    const oneHasFailed = results.some((result) => !result.success)
    return {
      success: true,
      code: results
        .map((result) => {
          return result.success ? result.code : "Any"
        })
        .join(" | "),
      imports: [
        ...results.flatMap((result) => (result.success ? result.imports : [])),
        oneHasFailed ? "any" : "",
      ].filter(Boolean),
      dataStructure: results.flatMap((result) => (result.success ? result.dataStructure : [])),
    }
  }

  handlerZodLiteral(base: TranslateBase<z.ZodLiteral<any>>): TranslateResult {
    const { code, imports } = primitiveToPy(base.zodType.value)
    const isSimplyAnyOrNone = code === "Any" || code === "None"
    return {
      success: true,
      code: isSimplyAnyOrNone ? code : `Literal[${code}]`,
      imports: isSimplyAnyOrNone ? imports : [...imports, "literal"],
      dataStructure: [],
    }
  }

  handlerZodEnum(base: TranslateBase<z.ZodEnum<any>>): TranslateResult {
    base.path ||= base.name || "Unnamed"
    const enumName = capitalizeAndFormatClassName(base.path)
    const values = Object.entries(base.zodType.Values).map(([k, v]) => `${k} = "${v}"`)
    return {
      success: true,
      code: enumName,
      imports: ["enum"],
      dataStructure: [
        {
          name: enumName,
          type: "enum",
          fields: values,
        },
      ],
    }
  }

  handlerZodTuple(base: TranslateBase<z.ZodTuple>): TranslateResult {
    const elements = base.zodType.items.map((item) =>
      this.translate({ zodType: item, path: base.path, name: base.name }),
    )
    const oneHasFailed = elements.some((result) => !result.success)
    if (oneHasFailed) return { success: false }

    return {
      success: true,
      code: `Tuple[${elements.map((result) => (result.success ? result.code : "Any")).join(", ")}]`,
      imports: [...elements.flatMap((result) => (result.success ? result.imports : [])), "tuple"],
      dataStructure: elements.flatMap((result) => (result.success ? result.dataStructure : [])),
    }
  }

  handlerZodDate(): TranslateResult {
    return {
      success: true,
      code: "datetime.date",
      imports: ["datetime"],
      dataStructure: [],
    }
  }

  handlerZodRecord(base: TranslateBase<z.ZodRecord>): TranslateResult {
    const valueType = this.translate({
      zodType: base.zodType.valueSchema,
      path: base.path,
      name: base.name,
    })

    return {
      success: true,
      code: `dict[str, ${valueType.success ? valueType.code : "Any"}]`,
      imports: valueType.success ? valueType.imports : ["any"],
      dataStructure: valueType.success ? valueType.dataStructure : [],
    }
  }

  handlerZodNullable(base: TranslateBase<z.ZodNullable<any>>): TranslateResult {
    const result = this.translate({
      zodType: base.zodType.unwrap(),
      path: base.path,
      name: base.name,
    })

    return {
      success: true,
      code: result.success ? `Optional[${result.code}]` : "Any",
      imports: result.success ? [...result.imports, "optional"] : ["any"],
      dataStructure: result.success ? result.dataStructure : [],
    }
  }

  handlerZodOptional(base: TranslateBase<z.ZodOptional<any>>): TranslateResult {
    const result = this.translate({
      zodType: base.zodType.unwrap(),
      path: base.path,
      name: base.name,
    })

    return {
      success: true,
      code: result.success ? `Optional[${result.code}]` : "Any",
      imports: result.success ? [...result.imports, "optional"] : ["any"],
      dataStructure: result.success ? result.dataStructure : [],
    }
  }

  handlerZodEffects(base: TranslateBase<z.ZodEffects<any>>): TranslateResult {
    const result = this.translate({
      zodType: base.zodType.innerType(),
      path: base.path,
      name: base.name,
    })

    return {
      success: true,
      code: result.success ? result.code : "Any",
      imports: result.success ? result.imports : ["any"],
      dataStructure: result.success ? result.dataStructure : [],
    }
  }

  handlerZodBranded(base: TranslateBase<z.ZodBranded<any, any>>): TranslateResult {
    const result = this.translate({
      zodType: base.zodType.unwrap(),
      path: base.path,
      name: base.name,
    })

    return {
      success: true,
      code: result.success ? result.code : "Any",
      imports: result.success ? result.imports : ["any"],
      dataStructure: result.success ? result.dataStructure : [],
    }
  }

  handlerZodDefault(base: TranslateBase<z.ZodDefault<any>>): TranslateResult {
    const result = this.translate({
      zodType: base.zodType.removeDefault(),
      path: base.path,
      name: base.name,
    })

    return {
      success: true,
      code: result.success ? result.code : "Any",
      imports: result.success ? result.imports : ["any"],
      dataStructure: result.success ? result.dataStructure : [],
    }
  }

  handlerZodFunction(): TranslateResult {
    return {
      success: true,
      code: "Callable",
      imports: ["callable"],
      dataStructure: [],
    }
  }

  handlerZodDiscriminatedUnion(
    base: TranslateBase<z.ZodDiscriminatedUnion<any, any>>,
  ): TranslateResult {
    base.path ||= base.name || "Unnamed"
    const discriminator = base.zodType.discriminator
    const totalImports: string[] = []
    const totalDataStructures: PyStructure[] = []
    const unionTypes = (base.zodType.options as z.ZodObject<any>[]).map(
      (option: z.ZodObject<any>, i) => {
        // Use the descriminator as a postfix for the object dataclass name
        // Otherwise, use the index of the object in the union and convert it to a letter
        let key = ""
        const descriminatorValue = getDiscriminator(option.shape[discriminator])
        if (descriminatorValue.success) {
          const { code, imports } = primitiveToNaming(descriminatorValue.descriminator)
          totalImports.push(...imports, "literal")
          key = code
        }
        const postfix = key
          ? capitalizeAndFormatClassName(key)
          : capitalizeAndFormatClassName(discriminator) + numberToLetter(i)
        const baseName = base.path ? `${base.path}~${postfix}` : postfix
        const dataclassName = capitalizeAndFormatClassName(baseName)

        const result = this.translate({
          zodType: option,
          path: dataclassName,
          name: dataclassName,
        })
        if (!result.success) {
          totalImports.push("any")
          return "Any"
        }

        totalImports.push(...result.imports)
        totalDataStructures.push(...result.dataStructure)
        return dataclassName
      },
    )

    const hasOneAny = unionTypes.includes("Any")
    return {
      success: true,
      code: hasOneAny ? "Any" : unionTypes.join(" | "),
      imports: hasOneAny ? ["any"] : [...new Set(totalImports)],
      dataStructure: hasOneAny ? [] : [...new Set(totalDataStructures)],
    }
  }

  /* #endregion Handlers */

  getHandler(zodType: z.ZodTypeAny): Translator {
    const handler = (this as any)[`handler${zodType.constructor.name}`]
    if (handler == null) {
      console.error(`Unknown Zod Type: ${zodType.constructor.name}. Defaulting to Any.`)
      return (() => ({
        success: true,
        code: "Any",
        imports: ["any"],
        dataclasses: [],
      })).bind(this) as Translator
    }

    return handler.bind(this) as Translator
  }

  translate(base: TranslateBase): TranslateResult {
    const handler = this.getHandler(base.zodType)
    if (!handler) {
      return {
        success: false,
      }
    }
    return handler(base)
  }

  rootTranslate(name: string): TranslateResult {
    return this.translate({
      zodType: this.schema,
      path: "",
      name,
    })
  }

  static getImport(importType: string): string {
    return (
      {
        literal: "from typing import Literal",
        enum: "from enum import Enum",
        tuple: "from typing import Tuple",
        datetime: "from datetime import datetime",
        dict: "from typing import Dict",
        optional: "from typing import Optional",
        dataclass: "from dataclasses import dataclass",
        callable: "from typing import Callable",
        any: "from typing import Any",
        alias: "from typing import TypeAlias",
      }[importType] || ""
    )
  }

  static isNamedPyStructure(schema: z.ZodTypeAny): boolean {
    return schema instanceof z.ZodObject || schema instanceof z.ZodEnum
  }
}
