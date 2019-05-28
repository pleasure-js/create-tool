import { deepScanDir } from 'pleasure-utils'
import { pathExists, remove, mkdirp } from 'fs-extra'
import util from 'util'
import { prompt } from 'inquirer'
import fs from 'fs'
import Promise from 'bluebird'
import handlerbars from 'handlebars'
import { getConfig } from './get-config.js'

const readFile = util.promisify(fs.readFile)
const writeFile = util.promisify(fs.writeFile)

/**
 * @typedef {Object} ParserPlugin
 *
 * @property {Function} transform - Called with the `data` that's gonna be used to parse all of the `.hbs` files.
 * @property {Object} prompts - [inquirer.prompt](https://github.com/SBoudrias/Inquirer.js/) options
 * @property {Object} config - Additional configuration options
 * @property {Array|Boolean} [savePreset=true] - To save last default options introduced by the user. `true` for all,
 * `false` for none or and `String[]` of the values to save.
 */

const ParserPluginConfig = {
  savePreset: true
}

/**
 * Loads (if any) the `ParserPlugin` file called `pleasure-create.config.js` located at the main `dir`, then removes it.
 * Prompts, using [inquirer](https://github.com/SBoudrias/Inquirer.js/) any requests found at the `ParserPlugin.prompts`.
 * Renders `.hbs` files found in give `dir` with collected data retrieved using the configuration of `ParserPlugin.prompts`
 * Renames all `.hbs` files removing the suffix `.hbs`.
 * @param {String} dir - Directory to render
 * @param {Object} [defaultValues] - Optional initial data object to parse the handlebars templates
 * @return {Promise<void>}
 */
export async function render (dir, defaultValues = {}) {
  let data = {}
  let transform
  let prompts
  let config = Object.assign({}, ParserPluginConfig)

  const PleasureParserPlugin = await getConfig(dir)

  if (PleasureParserPlugin) {
    const { config: addConfig } = PleasureParserPlugin;
    ({ transform, prompts } = PleasureParserPlugin)

    Object.assign(config, addConfig)
  }

  const files = await deepScanDir(dir, { only: [/\.hbs$/] })

  if (config.savePreset) {
    prompts = prompts(dir).map((q) => {
      if (!defaultValues.hasOwnProperty(q.name)) {
        return q
      }
      q.default = defaultValues[q.name]
      return q
    })
  }

  if (prompts) {
    data = await prompt(prompts)
  }

  if (transform) {
    data = transform(data)
  }

  await Promise.each(files, async (src) => {
    const dst = src.replace(/\.hbs$/, '')
    const template = handlerbars.compile((await readFile(src)).toString())
    const parsed = template(data)
    await writeFile(dst, parsed)

    if (dst !== src) {
      await remove(src)
    }
  })

  return data
}
