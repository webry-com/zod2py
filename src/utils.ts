import { Primitive, z } from "zod";

export function capitalizeAndFormatClassName(path: string): string {
    return path
        .replace(/[^a-zA-Z0-9~]/g, "")
        .split("~")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("");
}

export function numberToLetter(number: number): string {
    let result = "";
    while (number >= 0) {
        result = String.fromCharCode((number % 26) + 65) + result;
        number = Math.floor(number / 26) - 1;
    }
    return result;
}

export function primitiveToPy(value: Primitive, imports: string[]): string {
    switch (typeof value) {
        case "string":
            return `"${value}"`;
        case "number":
            return value.toString();
        case "boolean":
            return value ? "True" : "False";
        case "bigint":
            return value.toString();
        case "undefined":
            return "None";
        case "function":
            imports.push("callable");
            return "Callable";
        case "symbol":
            return `"${value.description}"`;
        case "object":
            return "Any";
        default:
            return "Any";
    }
}

export function unknown(type: z.ZodTypeAny): string {
    console.error(`Unknown Zod Type: ${type.constructor.name}. Defaulting to Any.`);
    return "Any";
}