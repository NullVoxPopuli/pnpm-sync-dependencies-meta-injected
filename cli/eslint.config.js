'use strict';

import { configs } from '@nullvoxpopuli/eslint-configs';

const config = configs.node();

export default [
  ...config,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
