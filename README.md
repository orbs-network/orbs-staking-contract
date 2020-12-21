# Orbs Staking Contract

Orbs staking contract on Ethereum (Solidity)

The Orbs staking contract is a very lean and concise Ethereum contract with a single purpose - to hold the locked ORBS tokens staked by delegators. The contract supports staking (locking) and unstaking after cooldown of 2 weeks (unlocking). The contract was designed to be lean, simple and remain immutable because it holds a significant amount of money (all locked ORBS tokens). 

The rest of the [Orbs PoS contract ecosystem](https://github.com/orbs-network/orbs-ethereum-contracts-v2/) (about 16 more Ethereum contracts involving complex actions from elections to rewards) depends on this contract by reading information from it.

## Specification

[High-level specification](docs/CONTRACT.md)

## Build

To build the project, please run:

```bash
yarn compile
```

## Tests

To run the tests, please run:

```bash
yarn test
```

To run the tests coverage suite, please run:

```bash
yarn coverage
```

To run the tests with a gas profiler, please run:

```bash
yarn profile
```
