import { outputFile, pathExists } from 'fs-extra'
import path from 'path'
import pick from 'lodash/pick'
import { presetDir } from './consts.js'
import { getConfig } from './get-config.js'

export async function loadPreset (srcRepo, hash) {
  const { savePreset } = await getConfig(srcRepo)
  if (!savePreset) {
    return {}
  }
  const presetFile = path.join(presetDir, `${ hash }.json`)
  let preset = {}

  if (await pathExists(presetFile)) {
    preset = require(presetFile)
  }
  return Array.isArray(savePreset) ? pick(preset, savePreset) : preset
}
