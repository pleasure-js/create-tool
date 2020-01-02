/*!
 * @pleasure-js/create-tool v1.0.0-beta
 * (c) 2018-2020 Martin Rafael Gonzalez <tin@devtin.io>
 * MIT
 */
'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var fse = require('fs-extra');
var fse__default = _interopDefault(fse);
var path = _interopDefault(require('path'));
var utils = require('@pleasure-js/utils');
var _ = _interopDefault(require('lodash'));
var util = _interopDefault(require('util'));
var inquirer = require('inquirer');
var fs = _interopDefault(require('fs'));
var Promise = _interopDefault(require('bluebird'));
var handlerbars = _interopDefault(require('handlebars'));
var pick = _interopDefault(require('lodash/pick'));
var merge = _interopDefault(require('deepmerge'));
var md5 = _interopDefault(require('md5'));

async function cloneRepoAndClean (src, dst) {
  const { Clone } = require('nodegit');
  await Clone(src, dst);
  await fse.remove(path.join(dst, '.git'));
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
  if (await fse.pathExists(pleasureCreateConfigFile)) {
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
  return fse.remove(getConfigFile(dir))
}

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

/**
 * @typedef {Object} ParserPlugin
 *
 * @property {Function} transform - Called with the `data` that's gonna be used to parse all of the `.hbs` files.
 * @property {Object} prompts - [inquirer.prompt](https://github.com/SBoudrias/Inquirer.js/) options
 * @property {Function} finished - Called once the operation is completed. Receives `{ dir, data, fse = 'fs-extra', _ = 'lodash' }`.
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
 * Renames all `.hbs` files removing the suffix `.hbs`. `.hbs` files starting with a `_` will be renamed removing the
 * prefix underscore (`_`) and preserving it's `.hbs` extension.
 * @param {String} dir - Directory to render
 * @param {Object} [defaultValues] - Optional initial data object to parse the handlebars templates
 * @return {Promise<void>}
 */
async function render (dir, defaultValues = {}) {
  let data = {};
  let transform;
  let prompts;
  let finished;
  let config = Object.assign({}, ParserPluginConfig$1);

  const PleasureParserPlugin = await getConfig(dir);

  if (PleasureParserPlugin) {
    const { config: addConfig } = PleasureParserPlugin;
    ({ transform, prompts, finished } = PleasureParserPlugin);

    Object.assign(config, addConfig);
  }

  const files = await utils.deepScanDir(dir, { only: [/\.hbs$/] });

  if (config.savePreset && prompts) {
    prompts = prompts(dir).map((q) => {
      if (defaultValues.hasOwnProperty(q.name) && !q.default) {
        q.default = defaultValues[q.name];
      }
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
    const dst = /^_/.test(path.basename(src)) ? src : src.replace(/\.hbs$/, '');
    const template = handlerbars.compile((await readFile(src)).toString());
    const parsed = template(data);
    await writeFile(dst, parsed);

    if (dst !== src) {
      return fse.remove(src)
    }

    if (/^_/.test(path.basename(src))) {
      return fse.move(dst, path.join(path.dirname(src), path.basename(src).replace(/^_/, '')))
    }
  });

  if (finished) {
    await finished({ dir, data, fse: fse__default, _ });
  }

  return data
}

const presetDir = path.resolve(__dirname, '../.presets');

async function loadPreset (srcRepo, hash) {
  const { savePreset } = await getConfig(srcRepo);
  if (!savePreset) {
    return {}
  }
  const presetFile = path.join(presetDir, `${ hash }.json`);
  let preset = {};

  if (await fse.pathExists(presetFile)) {
    preset = require(presetFile);
  }
  return Array.isArray(savePreset) ? pick(preset, savePreset) : preset
}

async function savePreset (id, data) {
  const presetFile = path.join(presetDir, `${ id }.json`);
  return fse.outputFile(presetFile, JSON.stringify(data))
}

/**
 * Clones given `repository` into the given `destination`. Parses all found handlebars templates (`.hbs`) in the repo
 * and optionally loads a file
 * @param {String} srcRepo - The git repository (local path or URL)
 * @param {String} destination - Local destination of the repo
 * @param {Object} [addData] - Optional data to use in rendering the templates.
 * @return {Promise}
 */
async function create (srcRepo, destination, addData = {}) {
  await cloneRepoAndClean(srcRepo, destination);

  const repo = await getConfig(destination);
  const enteredData = await render(destination, merge(await loadPreset(destination, md5(srcRepo)), addData));

  if (repo.savePreset) {
    const compiledData = Array.isArray(repo.savePreset) ? pick(enteredData, repo.savePreset) : enteredData;
    await savePreset(md5(srcRepo), merge(compiledData, addData));
  }

  await removeConfig(destination);

  return enteredData
}

var index = {
  cloneRepoAndClean,
  create,
  render
};

module.exports = index;
