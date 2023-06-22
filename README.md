# `pnpm-sync-dependencies-meta-injected`


- Do you use `dependenciesMeta.*.injected = true`? 
- Are you tired of the fight against the balance between ergonomics and "dependencies being correct"?

_This package (with turborepo) will solve all your problems!_This

## Setup 


1. in your `turbo.json`, configure a `_syncPnpm` task:
    ```js 
    "_syncPnpm": {
      "dependsOn": ["^build"],
      "cache": false
    },
    ```
    It must not have a cache, because we need to modify the `.pnpm` directory in the top-level `node_modules` folder.
2. In each of your projects that declare a `dependenciesMeta.*.injected = true`, add a `_syncPnpm` script in your package.json:
    ```js
    "_syncPnpm": "DEBUG=sync-pnpm pnpm sync-dependencies-meta-injected"
    ```
3. In each of your projects now includes `_syncPnpm`, re-configure your project's `start` command to run `_syncPnpm` in watch mode so that you can continually work on your injected dependencies and have updates automatically re-synced as the built are built.
    ```js 
    "start": "concurrently 'ember serve' 'pnpm _syncPnpm --watch' --names 'tests serve,tests sync deps'",
    ```
    By using [`concurrently`](https://github.com/open-cli-tools/concurrently), we can run our dev server as well as the `_syncPnpm` task in watch mode in parallel.


4. in your `turbe.json`, configure each task that relies on `^build` to also rely on `_syncPnpm` (no `^`) -- this, combined with the above will sync the hard links that `pnpm` uses for `dependenciesMeta.*.injected` after the dependencies are built.
    ```js
    "test": {
      "outputs": [],
      "dependsOn": ["_syncPnpm", "^build"]
    },

    "build": {
      "outputs": ["dist/**"],
      "dependsOn": ["_syncPnpm", "^build"]
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
