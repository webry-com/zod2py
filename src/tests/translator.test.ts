import { expect, test } from "vitest"
import ZodTranslator from "../zod-handlers.js"
import { z } from "zod"

test("ZodString translates correctly", () => {
  const translator = new ZodTranslator(z.string())
  const result = translator.rootTranslate("test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("str")
  expect(new Set(result.imports)).toEqual(new Set([]))
  expect(result.dataStructure).toEqual([])
})

test("ZodNumber & ZodBigInt translate correctly", () => {
  const translatorNumber = new ZodTranslator(z.number())
  const translatorBigInt = new ZodTranslator(z.bigint())
  const resultNumber = translatorNumber.rootTranslate("test")
  const resultBigInt = translatorBigInt.rootTranslate("test")
  expect(resultNumber.success).toBe(true)
  expect(resultBigInt.success).toBe(true)
  if (!resultNumber.success || !resultBigInt.success) return

  expect(resultNumber.code).toBe("float")
  expect(new Set(resultNumber.imports)).toEqual(new Set([]))
  expect(resultNumber.dataStructure).toEqual([])

  expect(resultBigInt.code).toBe("float")
  expect(new Set(resultBigInt.imports)).toEqual(new Set([]))
  expect(resultBigInt.dataStructure).toEqual([])
})

test("ZodBoolean translates correctly", () => {
  const translator = new ZodTranslator(z.boolean())
  const result = translator.rootTranslate("test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("bool")
  expect(new Set(result.imports)).toEqual(new Set([]))
  expect(result.dataStructure).toEqual([])
})

test("ZodArray translates correctly", () => {
  const translator = new ZodTranslator(z.array(z.string()))
  const result = translator.rootTranslate("test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("list[str]")
  expect(new Set(result.imports)).toEqual(new Set([]))
  expect(result.dataStructure).toEqual([])
})

test("ZodObject translates correctly", () => {
  const translator = new ZodTranslator(
    z.object({
      name: z.string(),
      age: z.number(),
      isStudent: z.boolean().optional(),
    }),
  )
  const result = translator.rootTranslate("Test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("Test")
  expect(new Set(result.imports)).toEqual(new Set(["dataclass", "optional"]))
  expect(result.dataStructure).toEqual([
    {
      name: "Test",
      fields: ["name: str", "age: float", "isStudent: Optional[bool]"],
      type: "dataclass",
    },
  ])
})

test("Nested ZodObject translates correctly", () => {
  const translator = new ZodTranslator(
    z.object({
      user: z.object({
        name: z.string(),
        age: z.number(),
        isStudent: z.boolean(),
      }),
    }),
  )
  const result = translator.rootTranslate("Test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("Test")
  expect(new Set(result.imports)).toEqual(new Set(["dataclass"]))
  expect(result.dataStructure).toEqual([
    {
      name: "Test",
      fields: ["user: TestUser"],
      type: "dataclass",
    },
    {
      name: "TestUser",
      fields: ["name: str", "age: float", "isStudent: bool"],
      type: "dataclass",
    },
  ])
})

test("Nested ZodArray translates correctly", () => {
  const translator = new ZodTranslator(
    z.object({
      users: z.array(
        z.object({
          name: z.string(),
          age: z.number(),
          isStudent: z.boolean(),
        }),
      ),
    }),
  )
  const result = translator.rootTranslate("Test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("Test")
  expect(new Set(result.imports)).toEqual(new Set(["dataclass"]))
  expect(result.dataStructure).toEqual([
    { name: "Test", fields: ["users: list[TestUsers]"], type: "dataclass" },
    {
      name: "TestUsers",
      fields: ["name: str", "age: float", "isStudent: bool"],
      type: "dataclass",
    },
  ])
})

test("ZodUnion translates correctly", () => {
  const translator = new ZodTranslator(z.union([z.string(), z.number()]))
  const result = translator.rootTranslate("Test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("str | float")
  expect(new Set(result.imports)).toEqual(new Set([]))
  expect(result.dataStructure).toEqual([])
})

test("ZodLiteral translates correctly with string", () => {
  const translator = new ZodTranslator(z.literal("test"))
  const result = translator.rootTranslate("Test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe('Literal["test"]')
  expect(new Set(result.imports)).toEqual(new Set(["literal"]))
  expect(result.dataStructure).toEqual([])
})

test("ZodLiteral translates correctly with number", () => {
  const translator = new ZodTranslator(z.literal(5))
  const result = translator.rootTranslate("Test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("Literal[5]")
  expect(new Set(result.imports)).toEqual(new Set(["literal"]))
  expect(result.dataStructure).toEqual([])
})

test("ZodLiteral translates correctly with boolean", () => {
  const translator = new ZodTranslator(z.literal(true))
  const result = translator.rootTranslate("Test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("Literal[True]")
  expect(new Set(result.imports)).toEqual(new Set(["literal"]))
  expect(result.dataStructure).toEqual([])
})

test("ZodLiteral translates correctly with bigint", () => {
  const translator = new ZodTranslator(z.literal(5n))
  const result = translator.rootTranslate("Test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("Literal[5]")
  expect(new Set(result.imports)).toEqual(new Set(["literal"]))
  expect(result.dataStructure).toEqual([])
})

test("ZodLiteral translates correctly with null", () => {
  const translator = new ZodTranslator(z.literal(null))
  const result = translator.rootTranslate("Test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("None")
  expect(new Set(result.imports)).toEqual(new Set([]))
  expect(result.dataStructure).toEqual([])
})

test("ZodLiteral translates correctly with undefined", () => {
  const translator = new ZodTranslator(z.literal(undefined))
  const result = translator.rootTranslate("Test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("None")
  expect(new Set(result.imports)).toEqual(new Set([]))
  expect(result.dataStructure).toEqual([])
})

test("ZodLiteral translates correctly with symbol", () => {
  const stringResult = new ZodTranslator(z.literal("test")).rootTranslate("Test")
  const numberResult = new ZodTranslator(z.literal(5)).rootTranslate("Test")
  const bigintResult = new ZodTranslator(z.literal(5n)).rootTranslate("Test")
  const booleanResult = new ZodTranslator(z.literal(true)).rootTranslate("Test")
  const symbolResult = new ZodTranslator(z.literal(Symbol("test"))).rootTranslate("Test")
  const nullResult = new ZodTranslator(z.literal(null)).rootTranslate("Test")
  const undefinedResult = new ZodTranslator(z.literal(undefined)).rootTranslate("Test")

  expect(stringResult.success).toBe(true)
  expect(numberResult.success).toBe(true)
  expect(bigintResult.success).toBe(true)
  expect(booleanResult.success).toBe(true)
  expect(symbolResult.success).toBe(true)
  expect(nullResult.success).toBe(true)
  expect(undefinedResult.success).toBe(true)
  if (
    !stringResult.success ||
    !numberResult.success ||
    !bigintResult.success ||
    !booleanResult.success ||
    !symbolResult.success ||
    !nullResult.success ||
    !undefinedResult.success
  )
    return

  expect(stringResult.code).toBe('Literal["test"]')
  expect(numberResult.code).toBe("Literal[5]")
  expect(bigintResult.code).toBe("Literal[5]")
  expect(booleanResult.code).toBe("Literal[True]")
  expect(symbolResult.code).toBe('Literal["test"]')
  expect(nullResult.code).toBe("None")
  expect(undefinedResult.code).toBe("None")

  expect(new Set(stringResult.imports)).toEqual(new Set(["literal"]))
  expect(new Set(numberResult.imports)).toEqual(new Set(["literal"]))
  expect(new Set(bigintResult.imports)).toEqual(new Set(["literal"]))
  expect(new Set(booleanResult.imports)).toEqual(new Set(["literal"]))
  expect(new Set(symbolResult.imports)).toEqual(new Set(["literal"]))
  expect(new Set(nullResult.imports)).toEqual(new Set([]))
  expect(new Set(undefinedResult.imports)).toEqual(new Set([]))

  expect(stringResult.dataStructure).toEqual([])
  expect(numberResult.dataStructure).toEqual([])
  expect(bigintResult.dataStructure).toEqual([])
  expect(booleanResult.dataStructure).toEqual([])
  expect(symbolResult.dataStructure).toEqual([])
  expect(nullResult.dataStructure).toEqual([])
  expect(undefinedResult.dataStructure).toEqual([])
})

test("ZodEnum translates correctly", () => {
  const translator = new ZodTranslator(z.enum(["test", "test2"]))
  const result = translator.rootTranslate("test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("Test")
  expect(new Set(result.imports)).toEqual(new Set(["enum"]))
  expect(result.dataStructure).toEqual([
    {
      name: "Test",
      fields: ['test = "test"', 'test2 = "test2"'],
      type: "enum",
    },
  ])
})

test("ZodTuple translates correctly", () => {
  const translator = new ZodTranslator(z.tuple([z.string(), z.number()]))
  const result = translator.rootTranslate("test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("Tuple[str, float]")
  expect(new Set(result.imports)).toEqual(new Set(["tuple"]))
  expect(result.dataStructure).toEqual([])
})

test("ZodDate translates correctly", () => {
  const translator = new ZodTranslator(z.date())
  const result = translator.rootTranslate("test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("datetime.date")
  expect(new Set(result.imports)).toEqual(new Set(["datetime"]))
  expect(result.dataStructure).toEqual([])
})

test("ZodRecord translates correctly", () => {
  const translator = new ZodTranslator(z.record(z.number()))
  const result = translator.rootTranslate("test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("dict[str, float]")
  expect(new Set(result.imports)).toEqual(new Set([]))
  expect(result.dataStructure).toEqual([])
})

test("ZodNullable translates correctly", () => {
  const translator = new ZodTranslator(z.nullable(z.string()))
  const result = translator.rootTranslate("test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("Optional[str]")
  expect(new Set(result.imports)).toEqual(new Set(["optional"]))
  expect(result.dataStructure).toEqual([])
})

test("ZodOptional translates correctly", () => {
  const translator = new ZodTranslator(z.optional(z.string()))
  const result = translator.rootTranslate("test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("Optional[str]")
  expect(new Set(result.imports)).toEqual(new Set(["optional"]))
  expect(result.dataStructure).toEqual([])
})

test("ZodEffects translates correctly", () => {
  const translator = new ZodTranslator(z.string().email())
  const result = translator.rootTranslate("test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("str")
  expect(new Set(result.imports)).toEqual(new Set([]))
  expect(result.dataStructure).toEqual([])
})

test("ZodBranded translates correctly", () => {
  const translator = new ZodTranslator(z.string().brand("test"))
  const result = translator.rootTranslate("test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("str")
  expect(new Set(result.imports)).toEqual(new Set([]))
  expect(result.dataStructure).toEqual([])
})

test("ZodDefault translates correctly", () => {
  const translator = new ZodTranslator(z.string().default("test"))
  const result = translator.rootTranslate("test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("str")
  expect(new Set(result.imports)).toEqual(new Set([]))
  expect(result.dataStructure).toEqual([])
})

test("ZodDiscriminatedUnion with String Literal Descriminator translates correctly", () => {
  const translator = new ZodTranslator(
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("X"),
        a: z.string(),
      }),
      z.object({
        type: z.literal("Y"),
        b: z.number(),
      }),
    ]),
  )
  const result = translator.rootTranslate("Test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("TestX | TestY")
  expect(result.dataStructure).toEqual([
    {
      name: "TestX",
      fields: ['type: Literal["X"]', "a: str"],
      type: "dataclass",
    },
    {
      name: "TestY",
      fields: ['type: Literal["Y"]', "b: float"],
      type: "dataclass",
    },
  ])
  expect(new Set(result.imports)).toEqual(new Set(["literal", "dataclass"]))
})

test("ZodDiscriminatedUnion without String Literal Descriminator translates correctly", () => {
  const translator = new ZodTranslator(
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal(null),
        a: z.string(),
      }),
      z.object({
        type: z.literal(undefined),
        b: z.number(),
      }),
      z.object({
        type: z.literal(0),
        b: z.number(),
      }),
      z.object({
        type: z.literal("l"),
        b: z.number(),
      }),
    ]),
  )
  const result = translator.rootTranslate("Test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("TestNull | TestUndefined | Test0 | TestL")
  expect(result.dataStructure).toEqual([
    {
      name: "TestNull",
      fields: ["type: None", "a: str"],
      type: "dataclass",
    },
    {
      name: "TestUndefined",
      fields: ["type: None", "b: float"],
      type: "dataclass",
    },
    {
      name: "Test0",
      fields: ["type: Literal[0]", "b: float"],
      type: "dataclass",
    },
    {
      name: "TestL",
      fields: ['type: Literal["l"]', "b: float"],
      type: "dataclass",
    },
  ])
  expect(new Set(result.imports)).toEqual(new Set(["literal", "dataclass"]))
})

test("ZodUnknown translates correctly", () => {
  const translator = new ZodTranslator(z.unknown())
  const result = translator.rootTranslate("Test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("Any")
  expect(new Set(result.imports)).toEqual(new Set(["any"]))
  expect(result.dataStructure).toEqual([])
})

test("ZodUndefined translates correctly", () => {
  const translator = new ZodTranslator(z.undefined())
  const result = translator.rootTranslate("Test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("None")
  expect(new Set(result.imports)).toEqual(new Set([]))
  expect(result.dataStructure).toEqual([])
})

test("ZodSymbol translates correctly", () => {
  const translator = new ZodTranslator(z.symbol())
  const result = translator.rootTranslate("Test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("Any")
  expect(new Set(result.imports)).toEqual(new Set(["any"]))
  expect(result.dataStructure).toEqual([])
})

test("ZodNever translates correctly", () => {
  const translator = new ZodTranslator(z.never())
  const result = translator.rootTranslate("Test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("None")
  expect(new Set(result.imports)).toEqual(new Set([]))
  expect(result.dataStructure).toEqual([])
})

test("ZodPromise translates correctly", () => {
  const translator = new ZodTranslator(z.promise(z.string()))
  const result = translator.rootTranslate("Test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("Any")
  expect(new Set(result.imports)).toEqual(new Set(["any"]))
  expect(result.dataStructure).toEqual([])
})

test("ZodFunction translates correctly", () => {
  const translator = new ZodTranslator(z.function())
  const result = translator.rootTranslate("Test")
  expect(result.success).toBe(true)
  if (!result.success) return

  expect(result.code).toBe("Callable")
  expect(new Set(result.imports)).toEqual(new Set(["callable"]))
  expect(result.dataStructure).toEqual([])
})
