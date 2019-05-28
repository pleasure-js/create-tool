import { remove } from 'fs-extra'
import path from 'path'

export async function cloneRepoAndClean (src, dst) {
  const { Clone } = require('nodegit')
  await Clone(src, dst)
  await remove(path.join(dst, '.git'))
  return { src, dst }
}
