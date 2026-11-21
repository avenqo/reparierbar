import * as migration_20261118_093915_anfang from './20261118_093915_anfang';
import * as migration_20261118_123534_rechtliches from './20261118_123534_rechtliches';

export const migrations = [
  {
    up: migration_20261118_093915_anfang.up,
    down: migration_20261118_093915_anfang.down,
    name: '20261118_093915_anfang',
  },
  {
    up: migration_20261118_123534_rechtliches.up,
    down: migration_20261118_123534_rechtliches.down,
    name: '20261118_123534_rechtliches'
  },
];
