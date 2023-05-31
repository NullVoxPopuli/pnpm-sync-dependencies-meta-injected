#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import run from './src/index.js';

let yarg = yargs(hideBin(process.argv));

yarg.wrap(yarg.terminalWidth());

yarg
  .command(
    ['run', '$0'],
    'the default command -- sync dependencies if relevant',
    (yargs) => {
      return yargs
        .option('watch', {
          description:
            'start sync-dependencies-meta-injected in watch mode, useful for developing with rollup (or other tools) in watch mode.',
          default: false,
          type: 'boolean',
        })
        .option('directory', {
          description:
            'Change the working directory that sync-dependencies-meta-injected runs in',
          default: process.cwd(),
        });
    },
    (args) => {
      return run(args);
    }
  )
  .help().argv;
