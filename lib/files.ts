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
 * Resolves data file path with multiple fallback locations.
 * Ensures compatibility with both local and Vercel deployments.
 *
 * Tries paths in order:
 * 1. {projectRoot}/data/{filename}
 * 2. {cwd}/data/{filename}
 * 3. {projectRoot}/{filename} (if {projectRoot} !== {cwd})
 * 4. {cwd}/{filename}
 *
 * Debug logs show all paths attempted for troubleshooting.
 */
export function getProjectFilePath(filename: string): string {
  const cwd = process.cwd()
  const projectRoot = findProjectRoot(cwd)

  console.info(`[files] === Resolving file: ${filename}`)
  console.info(`[files] cwd: ${cwd}`)
  console.info(`[files] projectRoot: ${projectRoot}`)

  const pathsToTry = [
    { label: "projectRoot/data", path: path.join(projectRoot, "data", filename) },
    { label: "cwd/data", path: path.join(cwd, "data", filename) },
    ...(projectRoot !== cwd
      ? [{ label: "projectRoot", path: path.join(projectRoot, filename) }]
      : []),
    { label: "cwd", path: path.join(cwd, filename) },
  ]

  // Log all paths being checked
  pathsToTry.forEach(({ label, path: p }) => {
    const exists = fs.existsSync(p)
    console.info(`[files]   [${exists ? "✓" : "✗"}] ${label}: ${p}`)
  })

  // Find first existing file
  for (const { label, path: p } of pathsToTry) {
    if (fs.existsSync(p)) {
      console.info(`[files] ✓ Found at ${label}: ${p}`)
      return p
    }
  }

  // If not found, throw error with all paths attempted
  const pathsList = pathsToTry.map(({ label, path: p }) => `  ${label}: ${p}`).join("\n")
  throw new Error(
    `File "${filename}" not found.\n\nPaths checked:\n${pathsList}\n\nMake sure the file exists in the /data folder.`
  )
}