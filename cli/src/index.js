import { findWorkspaceDir } from '@pnpm/find-workspace-dir';
import { findWorkspacePackages } from '@pnpm/find-workspace-packages';
import { hardLinkDir } from '@pnpm/fs.hard-link-dir';
import { readExactProjectManifest } from '@pnpm/read-project-manifest';
import Debug from 'debug';
import { pathExists, remove } from 'fs-extra/esm';
import { createRequire } from 'node:module';
import path, { dirname, join } from 'node:path';
import lockfile from 'proper-lockfile';
import resolvePackageManifestPath from 'resolve-package-path';

const require = createRequire(import.meta.url);
const debug = Debug('sync-pnpm');

const syncDir = './dist';

export default async function syncPnpm(dir = process.cwd()) {
  const root = await findWorkspaceDir(dir);

  const localManifestPath = path.join(dir, 'package.json');
  const ownProject = await readExactProjectManifest(localManifestPath);
  const ownPackageJson = ownProject.manifest;
  const ownDependencies = [
    ...Object.keys(ownPackageJson.dependencies ?? {}),
    ...Object.keys(ownPackageJson.devDependencies ?? {}),
  ];

  const localProjects = await findWorkspacePackages(root);
  const packagesToSync = localProjects.filter((p) => {
    if (!p.manifest.name) return false;

    return ownDependencies.includes(p.manifest.name);
  });

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

    const syncFrom = join(pkg.dir, syncDir);
    const resolvedPackagePath = resolvePackagePath(name, dir);

    const syncTo = join(resolvedPackagePath, syncDir);

    await syncPkg(syncFrom, syncTo);
  }
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
  if (await pathExists(syncFrom)) {
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
}
