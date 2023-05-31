import { findWorkspaceDir } from '@pnpm/find-workspace-dir';
import { findWorkspacePackages } from '@pnpm/find-workspace-packages';
import { hardLinkDir } from '@pnpm/fs.hard-link-dir';
import { readExactProjectManifest } from '@pnpm/read-project-manifest';
import Debug from 'debug';
import { pathExists, remove } from 'fs-extra/esm';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path, { dirname, join } from 'node:path';
import lockfile from 'proper-lockfile';
import resolvePackageManifestPath from 'resolve-package-path';

const require = createRequire(import.meta.url);
const debug = Debug('sync-pnpm');

/**
 * @typedef {object} Options
 * @property {string} directory working directory
 * @property {boolean} watch enable or disable watch mode
 *
 * @param {Options} options
 */
export default async function syncPnpm(options) {
  const { directory: dir, watch } = options;

  const packagesToSync = await getPackagesToSync(dir);

  if (!packagesToSync) return;

  for (const pkg of packagesToSync) {
    let name = pkg.manifest.name;

    /**
     * This likely won't happen, but we can't have declared
     * a dependency on a package without a name.
     */
    if (!name) continue;

    const { files } = pkg.manifest;

    /**
     * It's unlikely that a modern package will forgo these things, unless they're a
     * single file in the root directory of the package
     */
    if (!files && !pkg.manifest.exports) {
      // TODO: sync the whole package
      continue;
    }

    if (!files) {
      throw new Error(
        `${name} did not specify a 'files' entry in package.json. This is required for telling npm pack what files to include. Docs: https://docs.npmjs.com/cli/v9/configuring-npm/package-json#files`
      );
    }

    for (let syncDir of files) {
      const syncFrom = join(pkg.dir, syncDir);
      const resolvedPackagePath = resolvePackagePath(name, dir);
      const syncTo = join(resolvedPackagePath, syncDir);

      if (await isFile(syncFrom)) {
        // we only sync directories
        // TODO: how do we sync files?
        continue;
      }

      await syncPkg(syncFrom, syncTo);
    }
  }
}

/**
 * @param {string} filePath
 */
async function isFile(filePath) {
  try {
    let stat = await fs.lstat(filePath);

    return stat.isFile();
  } catch {
    // We don't care about *any* errors here
    // It's likely that the path doesn't exist
    // or we don't have permission to read it (in which case false is correct anyway)
    return false;
  }
}

/**
 * @param {string} dir the current working directory or the directory of a project
 */
async function getPackagesToSync(dir) {
  const root = await findWorkspaceDir(dir);

  if (!root) {
    throw new Error(`Could not find workspace root`);
  }

  const localManifestPath = path.join(dir, 'package.json');
  const ownProject = await readExactProjectManifest(localManifestPath);
  const injectedDependencyNames = injectedDeps(ownProject);

  /**
   * If dependencies are not injected, we don't need to re-link
   */
  if (!injectedDependencyNames || injectedDependencyNames?.size === 0) {
    return;
  }

  const localProjects = await findWorkspacePackages(root);

  return localProjects.filter((p) => {
    if (!p.manifest.name) return false;

    return injectedDependencyNames.has(p.manifest.name);
  });
}

/**
 * @typedef {Awaited<ReturnType<typeof readExactProjectManifest>>} Project
 *
 * @param {Project} project
 */
function injectedDeps(project) {
  const ownPackageJson = project.manifest;

  let depMeta = ownPackageJson.dependenciesMeta;

  if (!depMeta) return;

  let injectedDependencyNames = new Set();

  for (let [depName, meta] of Object.entries(depMeta)) {
    if (meta.injected) {
      injectedDependencyNames.add(depName);
    }
  }

  return injectedDependencyNames;
}

/**
 * @param {string} name
 * @param {string} startingDirectory resolve from here
 */
function resolvePackagePath(name, startingDirectory) {
  const resolvedManifestPath = resolvePackageManifestPath(
    name,
    startingDirectory
  );

  if (!resolvedManifestPath) {
    throw new Error(`Could not find package, ${name}`);
  }

  const resolvedPackagePath = dirname(resolvedManifestPath);

  return resolvedPackagePath;
}

/**
 * @param {string} syncFrom
 * @param {string} syncTo
 */
async function syncPkg(syncFrom, syncTo) {
  let exists = await pathExists(syncFrom);

  if (!exists) {
    /**
     * If the path doesn't exist, it's likely that the package hasn't
     * been built yet.
     * Once built, the path should exist.
     *
     * Another scenario is that the `files` or `exports` entries are incorrect.
     */
    return;
  }

  let releaseLock;

  try {
    releaseLock = await lockfile.lock(syncTo, { realpath: false });
    debug(`lockfile created for syncing to ${syncTo}`);
  } catch (e) {
    debug(
      `lockfile already exists for syncing to ${syncTo}, some other sync process is already handling this directory, so skipping...`
    );

    return;
  }

  if (await pathExists(syncTo)) {
    await remove(syncTo);
    debug(`removed ${syncTo} before syncing`);
  }

  debug(`syncing from ${syncFrom} to ${syncTo}`);
  await hardLinkDir(syncFrom, [syncTo]);
  releaseLock();
}
