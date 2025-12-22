#!/bin/bash
# Redis monitoring script
# Usage: ./scripts/monitor/redis-stats.sh [redis-cli-options]

set -euo pipefail

REDIS_CLI="${REDIS_CLI:-redis-cli}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

echo "=== Redis Monitoring Stats ==="
echo "Time: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo ""

# Memory usage
echo "--- Memory Usage ---"
$REDIS_CLI -h "$REDIS_HOST" -p "$REDIS_PORT" INFO memory | grep -E "used_memory_human|used_memory_peak_human|maxmemory_human|mem_fragmentation_ratio"

echo ""
echo "--- Client Connections ---"
$REDIS_CLI -h "$REDIS_HOST" -p "$REDIS_PORT" INFO clients | grep -E "connected_clients|blocked_clients"

echo ""
echo "--- Command Stats ---"
$REDIS_CLI -h "$REDIS_HOST" -p "$REDIS_PORT" INFO stats | grep -E "total_commands_processed|instantaneous_ops_per_sec|keyspace_hits|keyspace_misses"

echo ""
echo "--- Hit Rate ---"
HITS=$($REDIS_CLI -h "$REDIS_HOST" -p "$REDIS_PORT" INFO stats | grep keyspace_hits | cut -d: -f2 | tr -d '\r')
MISSES=$($REDIS_CLI -h "$REDIS_HOST" -p "$REDIS_PORT" INFO stats | grep keyspace_misses | cut -d: -f2 | tr -d '\r')
TOTAL=$((HITS + MISSES))
if [ "$TOTAL" -gt 0 ]; then
  HIT_RATE=$(awk "BEGIN {printf \"%.2f\", ($HITS / $TOTAL) * 100}")
  echo "Cache hit rate: $HIT_RATE%"
else
  echo "Cache hit rate: N/A (no requests yet)"
fi

echo ""
echo "--- Keyspace ---"
$REDIS_CLI -h "$REDIS_HOST" -p "$REDIS_PORT" INFO keyspace

echo ""
echo "--- Persistence ---"
$REDIS_CLI -h "$REDIS_HOST" -p "$REDIS_PORT" INFO persistence | grep -E "aof_enabled|rdb_last_save_time|aof_rewrite_in_progress"
