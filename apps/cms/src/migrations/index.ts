import * as migration_20251215_021600 from './20251215_021600';
import * as migration_20251215_052852 from './20251215_052852';
import * as migration_20251215_140000 from './20251215_140000';
import * as migration_20251215_220000_add_search_indexes from './20251215_220000_add_search_indexes';
import * as migration_20251221_optimization_indexes from './20251221_optimization_indexes';

export const migrations = [
  {
    up: migration_20251215_021600.up,
    down: migration_20251215_021600.down,
    name: '20251215_021600',
  },
  {
    up: migration_20251215_052852.up,
    down: migration_20251215_052852.down,
    name: '20251215_052852',
  },
  {
    up: migration_20251215_140000.up,
    down: migration_20251215_140000.down,
    name: '20251215_140000'
  },
  {
    up: migration_20251215_220000_add_search_indexes.up,
    down: migration_20251215_220000_add_search_indexes.down,
    name: '20251215_220000_add_search_indexes'
  },
  {
    up: migration_20251221_optimization_indexes.up,
    down: migration_20251221_optimization_indexes.down,
    name: '20251221_optimization_indexes'
  },
];
