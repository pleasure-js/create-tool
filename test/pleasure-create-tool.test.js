import test from 'ava'
import { cloneRepoAndClean, render } from '../'
import path from 'path'
import { remove, mkdirp, pathExists } from 'fs-extra'
import fs from 'fs'

const testingRepo = path.join(__dirname, '../../pleasure-boilerplate-default')
const testingSandboxPath = path.join(__dirname, `tmp`)

test.beforeEach(async () => {
  await remove(testingSandboxPath)
})

test('Clones a git repo into a directory', async t => {
  await t.notThrowsAsync(cloneRepoAndClean(testingRepo, testingSandboxPath))
  t.true(fs.readdirSync(testingSandboxPath).length > 1) // there are files...
  t.false(pathExists(path.join(testingSandboxPath, '.git')))
})

// stdin fails
test.skip('Parses files in the git repo using mustache', async t => {
  await cloneRepo(testingRepo, testingSandboxPath)
  await render(testingSandboxPath)
  t.true(fs.readdirSync(testingSandboxPath).length > 1) // there are files...
})
