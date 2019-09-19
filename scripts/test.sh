#!/usr/bin/env bash

if [ "$SOLIDITY_COVERAGE" = true ]; then
  port=7555
else
  port=7545
fi

# Import common variables.
. scripts/common.sh

# Executes cleanup function at script exit.
trap cleanup EXIT

if ganache_running $port; then
  echo "Using existing ganache instance"
else
  echo "Starting our own ganache instance with $accounts users with default balance of $balance ETH"

  if [ "$SOLIDITY_COVERAGE" = true ]; then
    ./node_modules/.bin/testrpc-sc -l 0xfffffffffff -a $accounts -e $balance -p "$port" > ganache.log &
  else
    ./node_modules/.bin/ganache-cli -a $accounts -e $balance -p "$port" > ganache.log &
  fi

  ganache_pid=$!

  echo "Waiting for ganache to launch on port "$port"..."

  while ! ganache_running $port; do
    sleep 0.1
  done

  echo "Ganache launched!"
fi

# Run the truffle test or the solidity-coverage suite.
if [ "$SOLIDITY_COVERAGE" = true ]; then
  SOLIDITY_COVERAGE=true ./node_modules/.bin/solidity-coverage
else
  ./node_modules/.bin/truffle test "$@"
fi
