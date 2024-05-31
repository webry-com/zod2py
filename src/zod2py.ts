import { Primitive, literal, z } from "zod"
import fs from "fs"
import { capitalizeAndFormatClassName, numberToLetter, primitiveToPy, unknown } from "./utils.js"

const loggedWarnings: string[] = []

type TypeMap = Map<
  Function,
  (
    zodType: z.ZodTypeAny,
    path: string,
    currentGeneratedCode: {
      code: string
      imports: string[]
    },
    dataclassName?: string,
  ) => string
>

export class ZodToPython {
  private filePath: string
  private typeMap: TypeMap

  constructor(filePath: string) {
    this.filePath = filePath
    this.typeMap = this.getTypeMap()
  }

  convert(schema: z.ZodTypeAny, className: string) {
    const currentGeneratedCode = {
      code: ``,
      imports: ["dataclass"],
    }
    this.zodSchemaToPythonDataclass(schema, className, currentGeneratedCode, className)
    this.writeToFile(currentGeneratedCode)
  }

  private getTypeMap(): TypeMap {
    return new Map([
      [
        z.ZodAny,
        (zodType, path, currentGeneratedCode) => {
          currentGeneratedCode.imports.push("any")
          return "Any"
        },
      ],
      [z.ZodString, () => "str"],
      [z.ZodNumber, () => "float"],
      [z.ZodBigInt, () => "float"],
      [z.ZodBoolean, () => "bool"],
      [
        z.ZodArray,
        (zodType: z.ZodArray<any>, path, currentGeneratedCode) => {
          const elementType = this.mapZodTypeToPython(zodType.element, path, currentGeneratedCode)
          return `list[${elementType}]`
        },
      ],
      [
        z.ZodObject,
        (zodType: z.ZodObject<any>, path, currentGeneratedCode, dataclassName) => {
          const className = capitalizeAndFormatClassName(path)
          if (dataclassName !== "") {
            this.zodSchemaToPythonDataclass(
              zodType,
              dataclassName ? dataclassName : className,
              currentGeneratedCode,
              path,
            )
          }
          return dataclassName ? dataclassName : className
        },
      ],
      [
        z.ZodUnion,
        (
          zodType: z.ZodUnion<readonly [z.ZodTypeAny, ...z.ZodTypeAny[]]>,
          path,
          currentGeneratedCode,
        ) => {
          const types = zodType.options
            .map((option) => this.mapZodTypeToPython(option, path, currentGeneratedCode))
            .join(" | ")
          return types
        },
      ],
      [
        z.ZodLiteral,
        (zodType: z.ZodLiteral<Primitive>, _, currentGeneratedCode) => {
          currentGeneratedCode.imports.push("literal")
          const pyType = primitiveToPy(zodType.value, currentGeneratedCode.imports)
          return pyType === "Any" ? pyType : `Literal[${pyType}]`
        },
      ],
      [
        z.ZodEnum,
        (zodType: z.ZodEnum<any>, path, currentGeneratedCode) => {
          const enumName = capitalizeAndFormatClassName(`${path}Enum`)
          const values = Object.entries(zodType.Values)
            .map(([k, v]) => `${k} = '${v}'`)
            .join(",\n    ")
          currentGeneratedCode.code += `\n\nclass ${enumName}(Enum):\n    ${values}`
          currentGeneratedCode.imports.push("enum")
          return enumName
        },
      ],
      [
        z.ZodTuple,
        (zodType: z.ZodTuple, path, currentGeneratedCode) => {
          const elements = zodType.items
            .map((item) => this.mapZodTypeToPython(item, path, currentGeneratedCode))
            .join(", ")
          currentGeneratedCode.imports.push("tuple")
          return `Tuple[${elements}]`
        },
      ],
      [
        z.ZodDate,
        (_, __, currentGeneratedCode) => {
          currentGeneratedCode.imports.push("datetime")
          return "datetime.date"
        },
      ],
      [
        z.ZodRecord,
        (zodType: z.ZodRecord<any>, path, currentGeneratedCode) => {
          const valueType = this.mapZodTypeToPython(zodType.valueSchema, path, currentGeneratedCode)
          return `dict[str, ${valueType}]`
        },
      ],
      [
        z.ZodNullable,
        (zodType: z.ZodNullable<any>, path, currentGeneratedCode) => {
          const innerType = this.mapZodTypeToPython(zodType.unwrap(), path, currentGeneratedCode)
          currentGeneratedCode.imports.push("optional")
          return `Optional[${innerType}]`
        },
      ],
      [
        z.ZodOptional,
        (zodType: z.ZodOptional<any>, path, currentGeneratedCode) => {
          const innerType = this.mapZodTypeToPython(zodType.unwrap(), path, currentGeneratedCode)
          currentGeneratedCode.imports.push("optional")
          return `Optional[${innerType}]`
        },
      ],
      [
        z.ZodEffects,
        (zodType: z.ZodEffects<any>, path, currentGeneratedCode) => {
          const innerType = this.mapZodTypeToPython(zodType.innerType(), path, currentGeneratedCode)
          return innerType
        },
      ],
      [
        z.ZodBranded,
        (zodType: z.ZodBranded<any, any>, path, currentGeneratedCode) => {
          const innerType = this.mapZodTypeToPython(zodType.unwrap(), path, currentGeneratedCode)
          return innerType
        },
      ],
      [
        z.ZodDefault,
        (zodType: z.ZodDefault<any>, path, currentGeneratedCode) => {
          const innerType = this.mapZodTypeToPython(
            zodType.removeDefault(),
            path,
            currentGeneratedCode,
          )
          return innerType
        },
      ],
      [
        z.ZodDiscriminatedUnion,
        (zodType: z.ZodDiscriminatedUnion<any, any>, path, currentGeneratedCode) => {
          const discriminator = zodType.discriminator
          const unionTypes = (zodType.options as z.ZodObject<any>[])
            .map((option: z.ZodObject<any>, i) => {
              let key = ""
              if (option.shape[discriminator] instanceof z.ZodLiteral) {
                const value = (option.shape[discriminator] as z.ZodLiteral<Primitive>).value
                key = primitiveToPy(value, currentGeneratedCode.imports)
              }

              const base = this.mapZodTypeToPython(option, path, currentGeneratedCode, "")

              const postfix = key
                ? capitalizeAndFormatClassName(key)
                : capitalizeAndFormatClassName(discriminator) + numberToLetter(i)
              const dataclassName = base + postfix

              this.mapZodTypeToPython(option, path, currentGeneratedCode, dataclassName)
              return dataclassName
            })
            .join(" | ")
          return unionTypes
        },
      ],
      [z.ZodUnknown, () => "Any"],
      [
        z.ZodFunction,
        (zodType, path, currentGeneratedCode) => {
          currentGeneratedCode.imports.push("callable")
          return "Callable"
        },
      ],
      [z.ZodUndefined, () => "None"],
      [
        z.ZodSymbol,
        (zodType, _, currentGeneratedCode) => {
          const value = zodType.description
          return `"${value}"`
        },
      ],
      [z.ZodError, () => "Any"],
      [z.ZodNull, () => "None"],
      [z.ZodNever, () => "Any"],
      [z.ZodPromise, () => "Any"],
    ])
  }

  zodSchemaToPythonDataclass(
    schema: z.ZodTypeAny,
    className: string,
    currentGeneratedCode: { code: string; imports: string[] },
    path: string = "",
  ): void {
    // TODO: Handle more initial types
    if (schema instanceof z.ZodObject) {
      const fields = schema.shape
      const fieldEntries = Object.entries(fields).map(([key, value]) => {
        const nestedPath = path ? `${path}~${key}` : key
        const pythonType = this.mapZodTypeToPython(
          value as z.ZodTypeAny,
          nestedPath,
          currentGeneratedCode,
        )
        return `${key}: ${pythonType}`
      })
      currentGeneratedCode.code +=
        `\n\n@dataclass\nclass ${className}:\n    ` + fieldEntries.join("\n    ")
    }
  }

  mapZodTypeToPython(
    zodType: z.ZodTypeAny,
    path: string,
    currentGeneratedCode: { code: string; imports: string[] },
    dataclassName?: string,
  ): string {
    const registeredTypes = [...this.typeMap.keys()].map((e) => e.name)

    for (let [key, handler] of this.typeMap.entries()) {
      if (zodType instanceof key) {
        return handler(zodType, path, currentGeneratedCode, dataclassName)
      }

      if (
        !registeredTypes.includes(zodType.constructor.name) &&
        !loggedWarnings.includes(zodType.constructor.name)
      ) {
        loggedWarnings.push(zodType.constructor.name)
        console.warn(`No handler for ${zodType.constructor.name}`)
      }
    }

    currentGeneratedCode.imports.push("any")
    return "Any"
  }

  writeToFile(currentGeneratedCode: { code: string; imports: string[] }) {
    const code =
      `####################\n# Generated by ZodToPython\n# DO NOT MODIFY\n####################\n\n\n` +
      [...new Set(currentGeneratedCode.imports)]
        .map(
          (type) =>
            ({
              literal: "from typing import Literal",
              enum: "from enum import Enum",
              tuple: "from typing import Tuple",
              datetime: "from datetime import datetime",
              dict: "from typing import Dict",
              optional: "from typing import Optional",
              dataclass: "from dataclasses import dataclass",
              callable: "from typing import Callable",
              any: "from typing import Any",
            })[type],
        )
        .join("\n") +
      currentGeneratedCode.code

    fs.mkdirSync(this.filePath.split("/").slice(0, -1).join("/"), { recursive: true })
    fs.writeFileSync(this.filePath, code)
  }
}