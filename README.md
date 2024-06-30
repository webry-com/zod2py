# zod2py

This is a simple tool to convert Zod to Python. You can use this tool to sync your Zod schema with your Python API and use Zod as a single source of truth.

## Getting Started
*TypeScript is not supported yet.*

1. `npm i -D zod2py`
2. `npx zod2py init` to create the config file
3. Add a script to run your watcher in your `package.json`:

```json
{
  "scripts": {
    "watch": "zod2py watch",
    "run": "zod2py run"
  }
}
```

4. Run `npm run watch` to start the watcher (e.g. when developing)
5. Or run `npm run run` to run the conversion once (e.g. when building)

## Example

Based on the config **zod2py.config.json**

```json
{
  "files": ["src/**/*.z2p.js"],
  "output": "{FOLDER}/z2p/{FILE}.py"
}
```

Zod2Py will listen to any `X/*.z2p.js` files and generate a corresponding `X/z2p/*.z2p.py` file with the schema converted to Python dataclasses, enums, aliases, and more.

_You can then use the generated Python files in your project._
