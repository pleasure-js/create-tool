/*!
 * pleasure-create-tool v1.0.0-beta
 * (c) 2018-2019 Martin Rafael Gonzalez <tin@devtin.io>
 * MIT
 */
'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var fsExtra = require('fs-extra');
var path = _interopDefault(require('path'));
var pleasureUtils = require('pleasure-utils');
var util = _interopDefault(require('util'));
var inquirer = require('inquirer');
var fs = _interopDefault(require('fs'));
var Promise = _interopDefault(require('bluebird'));
var handlerbars = _interopDefault(require('handlebars'));
var pick = _interopDefault(require('lodash/pick'));
var md5 = _interopDefault(require('md5'));

async function cloneRepoAndClean (src, dst) {
  const { Clone } = require('nodegit');
  await Clone(src, dst);
  await fsExtra.remove(path.join(dst, '.git'));
  return { src, dst }
}

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
};

/**
 *
 * @param {String} dir - Directory from where to locate the file
 * @return {Promise<{ParserPlugin}>}
 */
async function getConfig (dir) {
  const pleasureCreateConfigFile = getConfigFile(dir);
  if (await fsExtra.pathExists(pleasureCreateConfigFile)) {
    const config = require(pleasureCreateConfigFile);
    return Object.assign({}, ParserPluginConfig, config)
  }
  return ParserPluginConfig
}

/**
 * Removes the configuration file give a directory
 * @param {String} dir - Directory from where to locate the file
 * @return {Promise<any>}
 */
async function removeConfig (dir) {
  return fsExtra.remove(getConfigFile(dir))
}

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

/**
 * @typedef {Object} ParserPlugin
 *
 * @property {Function} transform - Called with the `data` that's gonna be used to parse all of the `.hbs` files.
 * @property {Object} prompts - [inquirer.prompt](https://github.com/SBoudrias/Inquirer.js/) options
 * @property {Object} config - Additional configuration options
 * @property {Array|Boolean} [savePreset=true] - To save last default options introduced by the user. `true` for all,
 * `false` for none or and `String[]` of the values to save.
 */

const ParserPluginConfig$1 = {
  savePreset: true
};

/**
 * Loads (if any) the `ParserPlugin` file called `pleasure-create.config.js` located at the main `dir`, then removes it.
 * Prompts, using [inquirer](https://github.com/SBoudrias/Inquirer.js/) any requests found at the `ParserPlugin.prompts`.
 * Renders `.hbs` files found in give `dir` with collected data retrieved using the configuration of `ParserPlugin.prompts`
 * Renames all `.hbs` files removing the suffix `.hbs`.
 * @param {String} dir - Directory to render
 * @param {Object} [defaultValues] - Optional initial data object to parse the handlebars templates
 * @return {Promise<void>}
 */
async function render (dir, defaultValues = {}) {
  let data = {};
  let transform;
  let prompts;
  let config = Object.assign({}, ParserPluginConfig$1);

  const PleasureParserPlugin = await getConfig(dir);

  if (PleasureParserPlugin) {
    const { config: addConfig } = PleasureParserPlugin;
    ({ transform, prompts } = PleasureParserPlugin);

    Object.assign(config, addConfig);
  }

  const files = await pleasureUtils.deepScanDir(dir, { only: [/\.hbs$/] });

  if (config.savePreset) {
    prompts = prompts(dir).map((q) => {
      if (!defaultValues.hasOwnProperty(q.name)) {
        return q
      }
      q.default = defaultValues[q.name];
      return q
    });
  }

  if (prompts) {
    data = await inquirer.prompt(prompts);
  }

  if (transform) {
    data = transform(data);
  }

  await Promise.each(files, async (src) => {
    const dst = src.replace(/\.hbs$/, '');
    const template = handlerbars.compile((await readFile(src)).toString());
    const parsed = template(data);
    await writeFile(dst, parsed);

    if (dst !== src) {
      await fsExtra.remove(src);
    }
  });

  return data
}

const presetDir = path.resolve(__dirname, '.presets');

async function loadPreset (srcRepo, hash) {
  const { savePreset } = await getConfig(srcRepo);
  if (!savePreset) {
    return {}
  }
  const presetFile = path.join(presetDir, `${ hash }.json`);
  let preset = {};

  if (await fsExtra.pathExists(presetFile)) {
    preset = require(presetFile);
  }
  return Array.isArray(savePreset) ? pick(preset, savePreset) : preset
}

async function savePreset (id, data) {
  const presetFile = path.join(presetDir, `${ id }.json`);
  return fsExtra.outputFile(presetFile, JSON.stringify(data))
}

/**
 * Clones given `repository` into the given `destination`. Parses all found handlebars templates (`.hbs`) in the repo
 * and optionally loads a file
 * @param {String} srcRepo - The git repository (local path or URL)
 * @param {String} destination - Local destination of the repo
 * @return {Promise}
 */
async function create (srcRepo, destination) {
  await cloneRepoAndClean(srcRepo, destination);

  const repo = await getConfig(destination);
  const enteredData = await render(destination, await loadPreset(destination, md5(srcRepo)));

  if (repo.savePreset) {
    await savePreset(md5(srcRepo), Array.isArray(repo.savePreset) ? pick(enteredData, repo.savePreset) : enteredData);
  }

  await removeConfig(destination);
}

var index = {
  cloneRepoAndClean,
  create,
  render
};

module.exports = index;
