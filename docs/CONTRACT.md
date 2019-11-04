# Staking Contract High-Level Specification

&nbsp;
## Introduction
The Orbs network uses a flavor of DPoS as a sybil resistance mechanism. A unique property in Orbs’ PoS approach is that its native token, the [ORBS token](https://etherscan.io/token/0xff56cc6b1e6ded347aa0b7676c85ab0b3d08b0fa), is an ERC20 token living on the Ethereum blockchain. This yields a hybrid model in which Orbs validator selection process and governance are done on Ethereum and the Orbs mainnet queries Ethereum’s state whenever it needs to effectuate the decisions made on Ethereum. The ORBS token is the means to participate in the Orbs PoS ecosystem. Within the Orbs ecosystem there is a distinction between staking and delegation.

&nbsp;
### Staking
Staking is the act of depositing ORBS tokens in a staking contract. Currently, there is a single staking contract (described in this document), but in the future, more staking contracts might be used.

&nbsp;
### Delegation
Delegation is the act of appointing a representative (aka. a Guardian) in the Orbs PoS ecosystem. Currently, an Ethereum account has two methods by which it can nominate a Guardian: (1) sending 0.07 ORBS tokens directly to the Guardian’s account, or (2) indicating a Guardian of choice in the delegation contract in Ethereum (a separate contract from the staking contract).

A delegated token has three roles in the Orbs PoS ecosystem:
* Delegator reward. A delegated token entitles the Delegator to a reward. 
* Guardian voting weight. A delegated token entitles the Guardian to whom it was delegated to voting power that can be used in Orbs’ governance. 
* Guardian reward. A delegated token entitles the Guardian to whom it was delegated to a reward.

For more information on Orbs PoS architecture see: 
#### [Orbs PoS Architecture Specification](https://github.com/orbs-network/orbs-spec/tree/master/pos-architecture)

&nbsp;
### Staking vs. Delegation
Delegation and staking are two separate and independent actions. An account can stake without delegating and vice versa. Whether a delegated token is staked or not could theoretically affect all three roles mentioned above.

It is important to note that while the Ethereum blockchain is where delegation and staking happen, it is the Orbs blockchain that processes these delegation and staking events and calculates for each Guardian her total delegation, which dictates the rewards she is entitled to receive and her voting weight. Additionally, the Orbs blockchain computes the rewards for each Delegator.


&nbsp;
## Contract Overview
The staking contract is responsible for managing Stakers and holding their staked (locked) tokens, upgradability (migrations), and handling of emergency situations.

&nbsp;
### Basic Functionalities
The contract offers three basic functionalities. First, any ORBS token holder can stake her tokens, by sending them to the staking contract’s account. Second, when a Staker wishes to pull out her tokens, she can unstake her staked tokens. Unstaking does not happen immediately - a Staker must wait for a cooldown period (by default a month) in order to withdraw her tokens. Finally, once the cooldown period passes, a Staker can withdraw her coins.

&nbsp;
### Migration
This contract is intended to be as immutable as possible, leaving no room for any owner to change things after the fact. Having said that, the contract should provide a path for transitioning to a new staking contract that is targeted to replace or live alongside this staking contract. The straightforward way to move tokens from staking contract A to contract B is by unstaking and withdrawing in contract A and then staking in contract B. However, this forces the staker to undergo the cooldown period. The Migration process handles the movement of tokens from one staking contract to another in a more seamless way (when possible), without the need to wait for a cooldown period.

The first migration functionality is to add a migration destination (ie. a new staking contract). This can only be done by the migration manager. Initially, the migration manager will be a multisig operated by the Orbs core team. The Orbs core team’s service as the migration manager is an administrative function, consistent with other administrative functions that the Orbs core team is fulfilling during the early period after the launch of the Orbs network. As with its other administrative functions, the Orbs core team will act in its capacity as migration manager in consultation with the Orbs network’s community. It is anticipated that, at a later stage, when the network and its governance mechanisms are more developed and robust, the migration manager should be controlled directly by the network’s then-applicable governance.

Once a new staking contract is added, a Staker can voluntarily migrate her tokens to that contract. Note that in order to effectuate the migration, the new staking contract needs to accept the migration -- that is, to pull the tokens from the old contract. (Note that migration destination contracts are required to implement the acceptMigration functionality.)

Note that while the migration manager can add a malicious staking contract, the Stakers themselves are the only ones that can opt-in to migrate their tokens from the current contract to the new one. As Stakers opt-in to new contracts, the migration manager cannot abuse her power to gain access to Stakers funds or prevent them from withdrawing.

&nbsp;
### Emergency
In case a serious bug is found in the contract, it is desired to have an efficient (yet sufficiently decentralized) emergency mechanism. The first emergency functionality is to stop accepting new stake, which can be called only by the emergency manager.  Initially, the emergency manager will be a multisig operated by the Orbs team. The Orbs core team’s service as the emergency manager is an administrative function, consistent with other administrative functions that the Orbs core team is fulfilling during the early period after the launch of the Orbs network. As with its other administrative functions, the Orbs core team will act in its capacity as emergency manager in consultation with the Orbs network’s community. It is anticipated that the Orbs core team’s functioning as emergency manager is temporary and will be discontinued and disabled as described below once the contract has been deployed, tested and found to be robust.  

Then, another functionality is to release all stake without having to undergo the cooldown period. This would allow stakers to withdraw their tokens without having to unstake and await the cooldown period. To speed up the withdrawal process in an emergency event the batch withdraw functionality can be used, allowing a single account (any account) to signal a withdraw tokens action on behalf of many stakers in one transaction. In a batch withdraw, every staker gets her tokens back to her account.

Note that the emergency manager might be able to distort the PoS ecosystem by using the release all stake functionality. The existence of an emergency manager (whether the Orbs core team or any other person or entity)  is a temporary mechanism, which is only intended for the initial period after the deployment of the contract until there is enough use and therefore confidence in the contract. It is anticipated that at a later stage the mechanism will be disabled by assigning emergency manager=0.

All in all there are 3 entities in the system:
* Ordinary ORBS token holders that can stake, unstake, etc.
* A migration manager that, in an administrative capacity, handles migration destination contracts.
* An emergency manager that, in an administrative capacity, can freeze the staking contract and override the cooldown period in the event of a serious bug in the contract.


&nbsp;
## Contract Specification

&nbsp;
### Basic Functionality
The contract offers the following operations:

#### Staking
One can stake (ERC20 `approve()` + `stake()`) any number of Orbs tokens, and it will be aggregated with one’s total number of staked tokens.

#### Unstaking
One can request to `unstake()` one’s tokens, but doing so will enforce a "cooldown period" (set as a global param via the constructor) and one would be able to withdraw one’s tokens only once it ends. Every time one unstakes more tokens, as long as the cooldown period hasn't ended yet - the cooldown period is restarted. Otherwise, in the case that it has already finished - the operation will revert. The rationale is to prevent users from forgetting to withdraw "available" tokens and accidentally resetting their cooldown periods.

#### Withdrawal
Once the cooldown period has ended, one can `withdraw()` one’s tokens.

#### Restaking
One can "revert" an unstaking request, by calling the `restake()` function, which will mark one’s tokens as staked tokens again.

&nbsp;
### Administrative Privileges
There are two limited administrative privileges used in this contract:

**Migration manager** that can, in an administrative capacity during the initial period after the launch of the network:
* Add or remove migration destinations (see below).

* Update the address of the migration manager.

**Emergency manager** that can, in an administrative capacity during the initial period after the deployment of the contract:
* Disable staking operations: in the case that some bug is discovered, prevent users from staking any further tokens. In this case, unstaking and withdrawal should be still enabled (while restaking, for example, is similarly disallowed). This can be set only once, and there is no way to undo it. In this case, migrating the stake to a new contract is still allowed (see below).

* Release all stakes: this is a more impactful operation than the previous one. When activated, not only is any kind of staking disabled, but also users should be able to withdraw all of their staked tokens immediately, whether or not the tokens were already unstaked and the cooldown period has passed. There is also a `withdrawReleasedStakes()` helper function (which is restricted to work only in this state) which can be used in order to withdraw tokens to staker accounts in batches. Upon an emergency release, anyone may call `withdrawReleasedStakes()` in order to transfer staker tokens to their ERC20 account.  If release all stakes was activated, migrating stake to a new contract is disallowed as well (see below). Activation can be done only once, and there is no way to undo it.

* Update the address of the emergency manager.

&nbsp;
### Migration Functionality
The migration flow allows users to opt-in to migrate their staked tokens to a new staking contract. Alternatively, a user can unstake, wait for the cooldown period to end, withdraw and stake in a new contract, but this would imply that the tokens are not staked during the cooldown period.

The Migration process:
1. The migration manager may propose (up to `MAX_APPROVED_STAKING_CONTRACTS`) distinct "migration destination" contracts.

2. Users may decide to migrate their staked tokens to any one of these contracts using the `migrateStakedTokens()` function. Note that the destination contracts only need to implement the `IMigratableStakingContract()` and could differ in many aspects relative to the existing IStakingContract specifications. 

3. Once requested, the existing contract will call ERC20 approve and the `acceptMigration()` function of the new contract (part of the `IMigratableStakingContract` interface), which will move the stake to the new contract. 

What's most important here is that users have to opt-in to the migration process and it is never forced upon them. The migration manager can only affect which contracts are proposed, and it should be totally acceptable for users to decide to reject them all and either stick to the existing staking contract or to `unstake()` and quit.

Note that the function `acceptMigration()` may also be used to stake on behalf of a different user - one user calls the function and another user is accredited for the stake. The function is named `acceptMigration()` and not `stakeOnBehalf()` to prevent phishing attempts where a user, unintendedly, stakes to another account instead of her own.

&nbsp;
### Additional Functionality
The `distributeRewards()` helper function allows staking on behalf of different users in batch (e.g., like calling acceptMigration() multiple times). This function is meant to be called by Orbs network whenever it needs to distribute staking rewards, which will be distributed as new staked tokens (according to the Orbs staking spec). Similarly to the acceptMigration() function, this function can be used to stake in batch and was named this way intentionally in an attempt to prevent confusion (for example it could have been called batchStakeOnBehalf). Using it as a shortcut for batching is totally acceptable as well (e.g., there are no "rewards" specific events). 

Since `distributeRewards()` and `withdrawReleasedStakes()` are batched operations, their caller should provide enough gas for the entire batch (the batch size should be limited as to make sure the block gas limit is respected). In addition, a failure in one operation may fail the entire batch.
