# Orbs Staking Contract

Orbs staking contract on Ethereum (Solidity)

The Orbs staking contract is a very lean and concise Ethereum contract with a single purpose - to hold the locked ORBS tokens staked by delegators. The contract supports staking (locking) and unstaking after cooldown of 2 weeks (unlocking). The contract was designed to be lean, simple and remain immutable because it holds a significant amount of money (all locked ORBS tokens). 

The rest of the [Orbs PoS contract ecosystem](https://github.com/orbs-network/orbs-ethereum-contracts-v2/) (about 16 more Ethereum contracts involving complex actions from elections to rewards) depends on this contract by reading information from it.

## Official contract instances

* Ethereum staking contract: [0x01D59Af68E2dcb44e04C50e05F62E7043F2656C3](https://etherscan.io/address/0x01d59af68e2dcb44e04c50e05f62e7043f2656c3)
* Polygon staking contract: [0xeeae6791f684117b7028b48cb5dd21186df80b9c](https://polygonscan.com/address/0xeeae6791f684117b7028b48cb5dd21186df80b9c)

## Specification

[High-level specification](docs/CONTRACT.md)

## Security Audit
In February-March 2020, Orbs received security audits from SmartDEC and Bok Consulting Pty Ltd.

- [SmartDec](Orbs_Staking_SmartDec.pdf)
- [Bok Consulting Pty](https://github.com/bokkypoobah/OrbsStakingContractAudit/tree/master/audit)

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
