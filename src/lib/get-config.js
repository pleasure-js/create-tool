import path from 'path'
import { pathExists, remove as removeFile } from 'fs-extra'

function getConfigFile (dir) {
  return path.join(dir, `pleasure-create.config.js`)
}

/**
 * @typedef {Object} ParserPlugin
 *
 * @property {Function} transform - Called with the `data` that's gonna be used to parse all of the `.hbs` files.
 * @property {Object} prompts - [inquirer.prompt](https://github.com/SBoudrias/Inquirer.js/) options
 * @property {Array|Boolean} [savePreset=true] - To save last default options introduced by the user. `true` for all,
 * `false` for none or and `String[]` of the values to save.
 */

const ParserPluginConfig = {
  savePreset: true
}

/**
 *
 * @param {String} dir - Directory from where to locate the file
 * @return {Promise<{ParserPlugin}>}
 */

export async function getConfig (dir) {
  const pleasureCreateConfigFile = getConfigFile(dir)
  if (await pathExists(pleasureCreateConfigFile)) {
    const config = require(pleasureCreateConfigFile)
    return Object.assign({}, ParserPluginConfig, config)
  }
  return ParserPluginConfig
}

/**
 * Removes the configuration file give a directory
 * @param {String} dir - Directory from where to locate the file
 * @return {Promise<any>}
 */

export async function removeConfig (dir) {
  return removeFile(getConfigFile(dir))
}
