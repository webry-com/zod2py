import { Command } from "commander"
import ora, { Ora } from "ora"
import packageJSON from "../package.json" with { type: "json" }
import path from "path"
import fs from "fs"
import { FSWatcher, watch } from "chokidar"
import { z } from "zod"
import { ZodToPython } from "./zod2py.js"
import { capitalizeAndFormatClassName } from "./utils.js"
import { getDiff } from "recursive-diff"

class Zod2Py {
  static CONFIG_FILES: string[] = ["zod2py.config.json", ".zod2py.json"]
  static IGNORE_FILES = [/(^|[\/\\])\../, "node_modules/*", ".git/*"]

  cli: Command
  cliSpinner: Ora
  cliConfigWatcher: FSWatcher | null
  cliFilesWatcher: FSWatcher | null
  config: ZTPConfig
  validationSchema: ReturnType<typeof createConfigValidationSchema>

  constructor() {
    this.cli = new Command()
    this.cliSpinner = ora()
    this.cliConfigWatcher = null
    this.cliFilesWatcher = null
    this.config = getDefaultConfig(this.cliSpinner)
    this.validationSchema = createConfigValidationSchema(this.cliSpinner)

    this.boot()
  }

  async boot() {
    this.cli.version(packageJSON.version)
    this.cli.description("Zod to Python CLI")
    this.cli.parse()

    this.cliSpinner.start("Reading Config...")
    await this.loadConfig()

    this.cliSpinner.succeed("Config found & loaded.")
    this.cliSpinner.start("Watching...")
    await this.bootWatchers()
  }

  async bootWatchers() {
    if (this.cliConfigWatcher) this.cliConfigWatcher.close()
    this.cliConfigWatcher = watch(Zod2Py.CONFIG_FILES, {
      persistent: true,
    })
    this.cliConfigWatcher.on("add", () => this.loadConfig())
    this.cliConfigWatcher.on("change", () => this.loadConfig())
    this.cliConfigWatcher.on("unlink", () => this.loadConfig())

    if (this.cliFilesWatcher) this.cliFilesWatcher.close()
    this.cliFilesWatcher = watch(this.config.files, {
      ignored: Zod2Py.IGNORE_FILES,
      persistent: true,
    })
    this.cliFilesWatcher.on("add", (simplePath) => this.translate(simplePath))
    this.cliFilesWatcher.on("change", (simplePath) => this.translate(simplePath))
    this.cliFilesWatcher.on("unlink", (simplePath) => {
      fs.unlinkSync(path.join(process.cwd(), this.getPythonFilePath(simplePath)))
    })
  }

  async translate(filePath: string) {
    const moduleObj = await import(
      "file://" + path.join(process.cwd(), filePath) + "?t=" + Date.now()
    )
    const pyFile = this.getPythonFilePath(filePath)

    if (moduleObj.default) {
      const baseName = path.basename(filePath, ".js")
      const ztp = new ZodToPython(pyFile)
      ztp.convert(moduleObj.default, capitalizeAndFormatClassName(baseName))
      this.cliSpinner.info("Reloaded " + filePath)
      return
    }

    if (Object.keys(moduleObj).length === 0) {
      fs.unlinkSync(path.join(process.cwd(), pyFile))
      this.cliSpinner.info("Deleting " + filePath + " (No schemas found in file)")
      return
    }

    for (const key in moduleObj) {
      const baseName = key
      const ztp = new ZodToPython(pyFile)
      ztp.convert(moduleObj[key], capitalizeAndFormatClassName(baseName))
      this.cliSpinner.info("Reloaded " + filePath)
    }
  }

  /* #region Private Methods */

  private getPythonFilePath(jsFilePath: string, output?: string) {
    const parentPath = path.dirname(jsFilePath)
    const fileName = path.basename(jsFilePath, ".js")
    return (output || this.config.output)
      .replace("{FOLDER}", parentPath)
      .replace("{FILE}", fileName)
      .replace(".js", ".py")
  }

  private async loadConfig() {
    const { config, success } = await this.readConfig()
    if (!success) {
      this.cliSpinner.fail("Failed to read configuration.")
      this.cliSpinner.warn(
        "Please create a zod2py.config.json or .zod2py.json file in the root of your project.",
      )
      process.exit(1)
    }

    const result = this.validationSchema.safeParse(config)
    if (!result.success) {
      process.exit(1)
    }

    const diff = getDiff(this.config, result.data)
    for (const { op, path } of diff) {
      this.onConfigChange(op, path as [string, number])
    }

    Object.assign(this.config, result.data)
  }

  private onConfigChange(op: string, [name, i]: [string, number]) {
    if (name === "output" && op === "update") {
      this.cliSpinner.info("Config output changed. Deleting old files and restarting watchers...")
      const oldOutput = this.config.output
      const deleteWatcher = watch([...this.config.files], {
        ignored: Zod2Py.IGNORE_FILES,
        persistent: true,
      })
      deleteWatcher.on("add", (simplePath) => {
        this.cliSpinner.info("Deleting " + this.getPythonFilePath(simplePath, oldOutput))
        if (fs.existsSync(this.getPythonFilePath(simplePath, oldOutput))) {
          fs.unlinkSync(path.join(process.cwd(), this.getPythonFilePath(simplePath, oldOutput)))
        }
      })
      deleteWatcher.on("ready", () => {
        deleteWatcher.close()
        this.bootWatchers()
      })
    }
  }

  private readConfig(): Promise<ReadConfigResult> {
    return new Promise((resolve) => {
      for (const configName of Zod2Py.CONFIG_FILES) {
        const configPath = path.join(process.cwd(), configName)
        try {
          const rawData = fs.readFileSync(configPath, { encoding: "utf-8" })
          const config: ZTPConfig = JSON.parse(rawData)
          resolve({
            success: true,
            config,
          })
          return
        } catch (error) {}
      }

      resolve({
        success: false,
        config: null,
      })
    })
  }

  /* #endregion */
}

new Zod2Py()

/* #region Tools */

type ZTPConfig = z.infer<ReturnType<typeof createConfigValidationSchema>>
type ReadConfigResult =
  | {
      success: true
      config: ZTPConfig
    }
  | {
      success: false
      config: null
    }

function createConfigValidationSchema(cliSpinner: Ora) {
  const validationSchema = z
    .object({
      files: z.array(z.string()).refine((val) => {
        if (val.length === 0) {
          cliSpinner.fail("No files to watch.")
          cliSpinner.warn("Set config.files to an array of files to watch.")
          return false
        }

        const hasNonJSFiles = val.some((file) => !file.endsWith(".js"))
        if (hasNonJSFiles) {
          cliSpinner.fail("Only .js files are supported.")
          cliSpinner.warn(
            "If you want to use .ts schemas have a look at our API and integrate it into your project.",
          )
          return false
        }

        return true
      }),
      output: z.string().refine((val) => {
        if (!val.includes("{FOLDER}") && !val.includes("{FILE}")) {
          cliSpinner.fail("Invalid config.output.")
          cliSpinner.warn("Please include {FOLDER} and {FILE} in the config.output.")
          cliSpinner.warn("Example: {FOLDER}/api/{FILE}.api.py")
          return false
        }
        return true
      }),
    })
    .brand()
  return validationSchema
}

function getDefaultConfig(cliSpinner: Ora): ZTPConfig {
  const config = {
    files: ["src/**/*.schema.js"],
    output: "{FOLDER}/{FILE}.api.py",
  }
  const validationSchema = createConfigValidationSchema(cliSpinner)
  const result = validationSchema.safeParse(config)
  if (!result.success) {
    cliSpinner.fail("Internal Error: Failed to create default config.")
    process.exit(1)
  }

  return result.data
}

/* #endregion */
