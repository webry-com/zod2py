import { Primitive, z } from "zod"

export function capitalizeAndFormatClassName(path: string): string {
  return path
    .replace(/[^a-zA-Z0-9~]/g, "")
    .split("~")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")
}

export function numberToLetter(number: number): string {
  let result = ""
  while (number >= 0) {
    result = String.fromCharCode((number % 26) + 65) + result
    number = Math.floor(number / 26) - 1
  }
  return result
}

export function primitiveToPy(value: Primitive): {
  imports: string[]
  code: string
} {
  if (value == null) {
    return {
      imports: [],
      code: "None",
    }
  }

  switch (typeof value) {
    case "string":
      return {
        imports: [],
        code: `"${value}"`,
      }
    case "number":
      return {
        imports: [],
        code: value.toString(),
      }
    case "boolean":
      return {
        imports: [],
        code: value ? "True" : "False",
      }
    case "bigint":
      return {
        imports: [],
        code: value.toString(),
      }
    case "function":
      return {
        imports: ["callable"],
        code: "Callable",
      }
    case "symbol":
      return {
        imports: [],
        code: `"${value.description}"`,
      }
    case "object":
      return {
        imports: ["any"],
        code: "Any",
      }
    default:
      return {
        imports: ["any"],
        code: "Any",
      }
  }
}

export function primitiveToNaming(value: Primitive): {
  imports: string[]
  code: string
} {
  if (value === null) {
    return {
      imports: [],
      code: "null",
    }
  }

  if (typeof value === "string") {
    return {
      imports: [],
      code: capitalizeAndFormatClassName(value),
    }
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return {
      imports: [],
      code: value.toString().replace(".", ""),
    }
  }

  if (typeof value === "boolean") {
    return {
      imports: [],
      code: value ? "True" : "False",
    }
  }

  if (typeof value === "symbol") {
    return {
      imports: [],
      code: value.description || "",
    }
  }

  return {
    imports: [],
    code: typeof value,
  }
}

export function unknown(type: z.ZodTypeAny): string {
  console.error(`Unknown Zod Type: ${type.constructor.name}. Defaulting to Any.`)
  return "Any"
}

export function getDiscriminator(type: z.ZodTypeAny):
  | {
      success: true
      descriminator: Primitive
    }
  | {
      success: false
    } {
  if (type.constructor.name === "ZodLazy") {
    return getDiscriminator((type as z.ZodLazy<any>).schema)
  } else if (type.constructor.name === "ZodEffects") {
    return getDiscriminator((type as z.ZodEffects<any>).innerType())
  } else if (type.constructor.name === "ZodLiteral") {
    return {
      success: true,
      descriminator: (type as z.ZodLiteral<any>).value,
    }
  } else if (type.constructor.name === "ZodDefault") {
    return getDiscriminator((type as z.ZodDefault<any>)._def.innerType)
  } else if (type.constructor.name === "ZodUndefined") {
    return {
      success: true,
      descriminator: undefined,
    }
  } else if (type.constructor.name === "ZodNull") {
    return {
      success: true,
      descriminator: null,
    }
  } else if (type.constructor.name === "ZodOptional") {
    return getDiscriminator((type as z.ZodOptional<any>).unwrap())
  } else if (type.constructor.name === "ZodNullable") {
    return getDiscriminator((type as z.ZodNullable<any>).unwrap())
  } else if (type.constructor.name === "ZodBranded") {
    return getDiscriminator((type as z.ZodBranded<any, any>).unwrap())
  } else if (type.constructor.name === "ZodReadonly") {
    return getDiscriminator((type as z.ZodReadonly<any>).unwrap())
  } else if (type.constructor.name === "ZodCatch") {
    return getDiscriminator((type as z.ZodCatch<any>)._def.innerType)
  } else {
    return {
      success: false,
    }
  }
}
