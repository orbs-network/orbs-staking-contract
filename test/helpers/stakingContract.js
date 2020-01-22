import BaseContract from './baseContract';

const StakingContractWrapper = artifacts.require('../../contracts/tests/StakingContractWrapper.sol');

class StakingContract extends BaseContract {
  constructor(cooldownPeriodInSec, migrationManager, emergencyManager, token) {
    super();

    this.cooldownPeriodInSec = cooldownPeriodInSec;
    this.migrationManager = migrationManager;
    this.emergencyManager = emergencyManager;
    this.token = token;
  }

  static async new(cooldownPeriodInSec, migrationManager, emergencyManager, token) {
    const staking = new StakingContract(cooldownPeriodInSec, migrationManager, emergencyManager, token);
    await staking.deploy();

    return staking;
  }

  async deploy() {
    this.contract = await StakingContractWrapper.new(this.cooldownPeriodInSec,
      StakingContract.getAddress(this.migrationManager), StakingContract.getAddress(this.emergencyManager),
      StakingContract.getAddress(this.token));
  }

  async getVersion() {
    return this.contract.VERSION.call();
  }

  async getCooldownPeriodInSec() {
    return this.contract.cooldownPeriodInSec.call();
  }

  async getStakeBalanceOf(stakeOwner) {
    return this.contract.getStakeBalanceOf.call(StakingContract.getAddress(stakeOwner));
  }

  async getTotalStakedTokens() {
    return this.contract.getTotalStakedTokens.call();
  }

  async getUnstakeStatus(stakeOwner) {
    const unstakedStatus = await this.contract.getUnstakeStatus.call(StakingContract.getAddress(stakeOwner));
    return {
      cooldownAmount: unstakedStatus[0],
      cooldownEndTime: unstakedStatus[1],
    };
  }

  async getStakeChangeNotifier() {
    return this.contract.notifier.call();
  }

  async getMigrationManager() {
    return this.contract.migrationManager.call();
  }

  async getEmergencyManager() {
    return this.contract.emergencyManager.call();
  }

  async getToken() {
    return this.contract.getToken.call();
  }

  async getApprovedStakingContracts() {
    const contracts = [];

    const length = (await this.contract.getApprovedStakingContractsLength.call()).toNumber();
    for (let i = 0; i < length; ++i) {
      contracts.push(await this.contract.approvedStakingContracts.call(i));
    }

    return contracts;
  }

  async acceptingNewStakes() {
    return this.contract.acceptingNewStakes.call();
  }

  async releasingAllStakes() {
    return this.contract.releasingAllStakes.call();
  }

  async setMigrationManager(manager, options = {}) {
    return this.contract.setMigrationManager(StakingContract.getAddress(manager), options);
  }

  async setEmergencyManager(manager, options = {}) {
    return this.contract.setEmergencyManager(StakingContract.getAddress(manager), options);
  }

  async setStakeChangeNotifier(notifier, options = {}) {
    return this.contract.setStakeChangeNotifier(StakingContract.getAddress(notifier), options);
  }

  async notifyStakeChange(stakeOwner) {
    return this.contract.notify(StakingContract.getAddress(stakeOwner));
  }

  async addMigrationDestination(newStakingContract, options = {}) {
    return this.contract.addMigrationDestination(StakingContract.getAddress(newStakingContract), options);
  }

  async removeMigrationDestination(stakingContract, options = {}) {
    return this.contract.removeMigrationDestination(StakingContract.getAddress(stakingContract), options);
  }

  async isApprovedStakingContract(stakingContract) {
    return this.contract.isApprovedStakingContract.call(StakingContract.getAddress(stakingContract));
  }

  async stake(amount, options = {}) {
    return this.contract.stake(amount, options);
  }

  async unstake(amount, options = {}) {
    return this.contract.unstake(amount, options);
  }

  async withdraw(options = {}) {
    return this.contract.withdraw(options);
  }

  async restake(options = {}) {
    return this.contract.restake(options);
  }

  async acceptMigration(stakeOwner, amount, options = {}) {
    return this.contract.acceptMigration(StakingContract.getAddress(stakeOwner), amount, options);
  }

  async migrateStakedTokens(stakingContract, amount, options = {}) {
    return this.contract.migrateStakedTokens(StakingContract.getAddress(stakingContract), amount, options);
  }

  async distributeRewards(totalStake, stakeOwners, amounts, options = {}) {
    return this.contract.distributeRewards(totalStake, stakeOwners.map((s) => StakingContract.getAddress(s)),
      amounts, options);
  }

  async stopAcceptingNewStakes(options = {}) {
    return this.contract.stopAcceptingNewStakes(options);
  }

  async releaseAllStakes(options = {}) {
    return this.contract.releaseAllStakes(options);
  }

  async withdrawReleasedStakes(stakeOwners) {
    return this.contract.withdrawReleasedStakes(stakeOwners.map((s) => StakingContract.getAddress(s)));
  }

  static getEvents() {
    return {
      staked: 'Staked',
      unstaked: 'Unstaked',
      restaked: 'Restaked',
      withdrew: 'Withdrew',
      acceptedMigration: 'AcceptedMigration',
      migratedStake: 'MigratedStake',
      migrationManagerUpdated: 'MigrationManagerUpdated',
      migrationDestinationAdded: 'MigrationDestinationAdded',
      migrationDestinationRemoved: 'MigrationDestinationRemoved',
      emergencyManagerUpdated: 'EmergencyManagerUpdated',
      stakeChangeNotifierUpdated: 'StakeChangeNotifierUpdated',
      stakeChangeNotificationFailed: 'StakeChangeNotificationFailed',
      stoppedAcceptingNewStake: 'StoppedAcceptingNewStake',
      releasedAllStakes: 'ReleasedAllStakes',
    };
  }

  static getStakeChangeNotificationGasLimit() {
    return 2000000;
  }
}

export default StakingContract;
