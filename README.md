# `pnpm-sync-dependencies-meta-injected`


- Do you use [`dependenciesMeta.*.injected = true`](https://pnpm.io/package_json#dependenciesmetainjected)?
- Are you tired of the fight against the balance between ergonomics and "dependencies being correct"?

_This package will solve all your problems!_

## Setup

1. Install the dependency.

    ```bash
    pnpm i pnpm-sync-dependencies-meta-injected -D
    ```

2. In each of your projects that declare a `dependenciesMeta.*.injected = true`, add a `_syncPnpm` script in your package.json:
    ```js
    "_syncPnpm": "pnpm sync-dependencies-meta-injected"
    ```

3. In each of your projects that includes `_syncPnpm`, re-configure your project's `start` command to run `_syncPnpm` in watch mode so that you can continually work on your injected dependencies and have updates automatically re-synced as they are built.
    ```js
    "start": "concurrently 'ember serve' 'pnpm _syncPnpm --watch' --names 'tests serve,tests sync deps'",
    ```
    By using [`concurrently`](https://github.com/open-cli-tools/concurrently), we can run our dev server as well as the `_syncPnpm` task in watch mode in parallel.


## If you use turborepo

When using turborepo, we can automatically sync the injected dependencies for all tasks defined in turbo.json
    
1. In your `turbo.json`, configure a `_syncPnpm` task:
    ```js
    "_syncPnpm": {
      "dependsOn": ["^build"],
      "cache": false
    },
    ```
    It must not have a cache, because we need to modify the `.pnpm` directory in the top-level `node_modules` folder.

2. In your `turbo.json`, configure each task that relies on `^build` to also rely on `_syncPnpm` (no `^`) -- this, combined with the above will sync the hard links that `pnpm` uses for `dependenciesMeta.*.injected` after the dependencies are built.
    ```diff
      "test": {
        "outputs": [],
    -   "dependsOn": ["^build"]
    +   "dependsOn": ["_syncPnpm"]
      },

      "build": {
        "outputs": ["dist/**"],
    -   "dependsOn": ["^build"]
    +   "dependsOn": ["_syncPnpm"]
      },
    // etc
    ```


## Debug

Add
```bash
DEBUG=sync-pnpm
```
before the invocation.

Example of adding to the package.json#scripts

```js
"_syncPnpm": "DEBUG=sync-pnpm pnpm sync-dependencies-meta-injected"
```

Or on-the-fly:
```bash
DEBUG=sync-pnpm pnpm _syncPnpm
```
