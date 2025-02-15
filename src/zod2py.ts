import { z } from "zod"
import fs from "fs"
import ZodTranslator from "./zod-handlers.js"
import { Ora } from "ora"

export class ZodToPython {
  private filePath: string
  private spinner: Ora

  constructor(filePath: string, spinner: Ora) {
    this.filePath = filePath
    this.spinner = spinner
  }

  convert(schema: z.ZodTypeAny, className: string) {
    const code = this.zodSchemaToPythonDataclass(schema, className)
    if (code) {
      this.writeToFile(code)
    }
  }

  zodSchemaToPythonDataclass(schema: z.ZodTypeAny, className: string): string | undefined {
    const translator = new ZodTranslator(schema)
    const result = translator.translate({
      zodType: schema,
      path: "",
      name: className,
    })
    if (!result.success) {
      this.spinner.fail(`Interal Error: Failed to convert ${className}`)
      return
    }

    if (!ZodTranslator.isNamedPyStructure(schema)) {
      result.imports.push("alias")
      result.code = `${className}: TypeAlias = ${result.code}`
    } else {
      result.code = ""
    }

    const imports = [...new Set(result.imports)].map(ZodTranslator.getImport).join("\n")
    const dataclasses = result.dataStructure
    const pyStructure = dataclasses
      .map((dc) => {
        if (dc.type === "dataclass") {
          return `@dataclass\nclass ${dc.name}:\n    ${dc.fields.join("\n    ")}`
        }

        if (dc.type === "enum") {
          return `class ${dc.name}(Enum):\n    ${dc.fields.join("\n    ")}`
        }
      })
      .join("\n")
    const code = result.code

    const header = `####################\n# Generated by Zod2Py\n# DO NOT MODIFY\n####################`
    return `${[header, imports, pyStructure, code].filter(Boolean).join("\n\n")}\n`
  }

  writeToFile(code: string) {
    fs.mkdirSync(this.filePath.split("/").slice(0, -1).join("/"), { recursive: true })
    fs.writeFileSync(this.filePath, code)
  }
}
