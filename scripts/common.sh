#!/usr/bin/env bash

balance=1000
accounts=30

# Test if ganache is running on port $1.
# Result is in $?
ganache_running() {
  nc -z localhost $1
}

# Kills ganache process with its PID in $ganache_pid.
cleanup() {
  echo "cleaning up"
  # Kill the ganache instance that we started (if we started one).
  if [ -n "$ganache_pid" ]; then
    kill -9 $ganache_pid
  fi
}
