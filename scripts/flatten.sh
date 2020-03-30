#!/usr/bin/env bash

# header (comments)
cp ./header.txt ./StakingContract_flattened.sol	

# append the flattened contracts after the header
../node_modules/.bin/truffle-flattener ../contracts/StakingContract.sol >> ./StakingContract_flattened.sol
