import { Command } from "commander"
import ora from "ora"
import packageJSON from "../package.json" with { type: "json" }
import path from "path"
import fs from "fs"
import { FSWatcher, watch } from "chokidar"
import { z } from "zod"
import { ZodToPython } from "./zod2py.js"
import { capitalizeAndFormatClassName } from "./utils.js"

const CONFIG_FILES: string[] = ["zod2py.config.json", ".zod2py.json"]
const CONFIG: ZTPConfig = {
  files: [],
  output: "{FOLDER}/{FILE}.api.py",
}
const IGNORE_FILES = [/(^|[\/\\])\../, "node_modules/*", ".git/*"]

const program = new Command()
const spinner = ora()
const watchers: {
  config?: FSWatcher
  files?: FSWatcher
} = {}

program.version(packageJSON.version)
program.command("run").action(async () => {
  spinner.start("Reading Config...")

  loadConfig(true, (result) => {
    spinner.succeed("Config found & loaded.")
    spinner.start("Watching...")

    if (watchers.config) watchers.config.close()
    watchers.config = watch(CONFIG_FILES, {
      persistent: true,
    })
    watchers.config
      .on("add", () => loadConfig(false))
      .on("change", () => loadConfig(false))
      .on("unlink", () => loadConfig(false))

    if (watchers.files) watchers.files.close()
    watchers.files = watch(result.files, {
      ignored: IGNORE_FILES,
      persistent: true,
    })
    watchers.files
      .on("add", (simplePath) => translate(simplePath))
      .on("change", (simplePath) => translate(simplePath))
      .on("unlink", (simplePath) => {
        fs.unlinkSync(path.join(process.cwd(), pyFileFromJsFile(simplePath)))
      })
  })
})

program.parse(process.argv)

function pyFileFromJsFile(jsFile: string) {
  if (!CONFIG.output.includes("{FOLDER}") && !CONFIG.output.includes("{FILE}")) {
    spinner.fail("Invalid config.output.")
    spinner.warn("Please include {FOLDER} and {FILE} in the config.output.")
    spinner.warn("Example: {FOLDER}/api/{FILE}.api.py")
    spinner.info("Defaulting to {FOLDER}/{FILE}.api.py")
  }

  const parentPath = path.dirname(jsFile)
  const fileName = path.basename(jsFile, ".js")
  return CONFIG.output
    .replace("{FOLDER}", parentPath)
    .replace("{FILE}", fileName)
    .replace(".js", ".py")
}

async function translate(filePath: string) {
  const moduleObj = await import(
    "file://" + path.join(process.cwd(), filePath) + "?t=" + Date.now()
  )
  const pyFile = pyFileFromJsFile(filePath)

  if (moduleObj.default) {
    const baseName = path.basename(filePath, ".js")
    const ztp = new ZodToPython(pyFile)
    ztp.convert(moduleObj.default, capitalizeAndFormatClassName(baseName))
    return
  }

  if (Object.keys(moduleObj).length === 0) {
    fs.unlinkSync(path.join(process.cwd(), pyFile))
    return
  }

  for (const key in moduleObj) {
    const baseName = key
    const ztp = new ZodToPython(pyFile)
    ztp.convert(moduleObj[key], capitalizeAndFormatClassName(baseName))
  }
}

export type ZTPConfig = {
  files: string[]
  output: string
}

function loadRawConfig(configPaths: string[]): Promise<
  | {
      success: true
      config: ZTPConfig
    }
  | {
      success: false
      config: null
    }
> {
  return new Promise((resolve) => {
    for (const configName of configPaths) {
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

function loadConfig(initial: boolean, onLoad?: (config: ZTPConfig) => void) {
  loadRawConfig(CONFIG_FILES).then((result) => {
    if (!result.success) {
      spinner.fail("Failed to load configuration.")
      spinner.warn(
        "Please create a zod-to-python.config.json or ztp.config.json file in the root of your project.",
      )
      process.exit(1)
    } else {
      const config = result.config
      const files = config.files
      if (files == null) {
        spinner.warn("No files to watch.")
        spinner.warn("Set config.files to an array of files to watch.")
        process.exit(1)
      }

      for (const file of files) {
        if (typeof file !== "string") {
          spinner.fail("Invalid file path in config.files")
          process.exit(1)
        }

        if (!file.endsWith(".js")) {
          spinner.fail("Only .js files are supported.")
          spinner.warn(
            "If you want to use .ts schemas have a look at our API and integrate it into your project.",
          )
          process.exit(1)
        }
      }

      if (config.output && CONFIG.output !== config.output && !initial) {
        spinner.info("Config output changed. Deleting old files...")
        spinner.info("Restart zod2py to generate the new files.")
        const deleteWatcher = watch([...CONFIG.files], {
          ignored: IGNORE_FILES,
          persistent: true,
        })
        deleteWatcher.on("add", (simplePath) => {
          fs.unlinkSync(path.join(process.cwd(), pyFileFromJsFile(simplePath)))
        })
        deleteWatcher.on("ready", () => {
          deleteWatcher.close()
          process.exit(0)
        })
        return
      }

      Object.assign(CONFIG, config)
      onLoad && onLoad(config)
    }
  })
}
