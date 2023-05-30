import { findRoot } from '@manypkg/find-root';
import { getPackages } from '@manypkg/get-packages';
import { hardLinkDir } from '@pnpm/fs.hard-link-dir';
import Debug from 'debug';
import { pathExists, readJson, remove } from 'fs-extra/esm';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import lockfile from 'proper-lockfile';
import resolvePackageManifestPath from 'resolve-package-path';

const require = createRequire(import.meta.url);
const debug = Debug('sync-pnpm');

const syncDir = './dist';

export default async function syncPnpm(dir = process.cwd()) {
  const root = await findRoot(dir);
  const ownPackageJson = await readJson(join(dir, 'package.json'));
  const ownDependencies = [
    ...Object.keys(ownPackageJson.dependencies ?? {}),
    ...Object.keys(ownPackageJson.devDependencies ?? {}),
  ];

  const localPackages = (await getPackages(root.rootDir)).packages;

  const packagesToSync = localPackages.filter(
    (p) =>
      p.packageJson.name !== 'sync-pnpm' &&
      ownDependencies.includes(p.packageJson.name)
  );

  for (const pkg of packagesToSync) {
    let name = pkg.packageJson.name;

    /**
     * This likely won't happen, but we can't have declared
     * a dependency on a package without a name.
     */
    if (!name) continue;

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
