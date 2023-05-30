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
    () => {},
    () => {
      return run();
    }
  )
  .help().argv;
