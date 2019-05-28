import { outputFile } from 'fs-extra'
import path from 'path'
import { presetDir } from './consts.js'

export async function savePreset (id, data) {
  const presetFile = path.join(presetDir, `${ id }.json`)
  return outputFile(presetFile, JSON.stringify(data))
}
