#!/usr/bin/env bash

cp ./header.txt ./StakingContract_flattened.sol	
../node_modules/.bin/truffle-flattener ../contracts/StakingContract.sol >> ./StakingContract_flattened.sol
