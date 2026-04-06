import fs from "node:fs"
import path from "node:path"

function findProjectRoot(startDir: string = process.cwd()): string {
  let dir = startDir

  for (let i = 0; i < 8; i += 1) {
    const packageJsonPath = path.join(dir, "package.json")
    if (fs.existsSync(packageJsonPath)) return dir

    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  return startDir
}

/**
 * Gets absolute file path from the project /data folder.
 * Temporary debug logs are intentionally left for runtime verification.
 */
export function getProjectFilePath(filename: string): string {
  const cwd = process.cwd()
  const projectRoot = findProjectRoot(cwd)
  const filePath = path.join(projectRoot, "data", filename)
  const exists = fs.existsSync(filePath)

  console.info(`[files] cwd: ${cwd}`)
  console.info(`[files] projectRoot: ${projectRoot}`)
  console.info(`[files] Resolved path for ${filename}: ${filePath}`)
  console.info(`[files] Exists: ${exists}`)

  if (!exists) throw new Error(`File ${filename} not found at ${filePath}`)
  return filePath
}