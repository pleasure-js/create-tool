import { render } from './render.js'
import { cloneRepoAndClean } from './clone-repo-and-clean.js'
import { getConfig, removeConfig } from './get-config.js'
import { loadPreset } from './load-preset.js'
import { savePreset } from './save-preset.js'
import pick from 'lodash/pick'
import md5 from 'md5'

/**
 * Clones given `repository` into the given `destination`. Parses all found handlebars templates (`.hbs`) in the repo
 * and optionally loads a file
 * @param {String} srcRepo - The git repository (local path or URL)
 * @param {String} destination - Local destination of the repo
 * @return {Promise}
 */
export async function create (srcRepo, destination) {
  await cloneRepoAndClean(srcRepo, destination)

  const repo = await getConfig(destination)
  const enteredData = await render(destination, await loadPreset(destination, md5(srcRepo)))

  if (repo.savePreset) {
    await savePreset(md5(srcRepo), Array.isArray(repo.savePreset) ? pick(enteredData, repo.savePreset) : enteredData)
  }

  await removeConfig(destination)
}
