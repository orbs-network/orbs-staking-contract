const StakingContractWrapper = artifacts.require('../../contracts/tests/StakingContractWrapper.sol');

class StakingContract {
  constructor(cooldownPeriod, migrationManager, emergencyManager, token) {
    this.cooldownPeriod = cooldownPeriod;
    this.migrationManager = migrationManager;
    this.emergencyManager = emergencyManager;
    this.token = token;
  }

  static async new(cooldownPeriod, migrationManager, emergencyManager, token) {
    const staking = new StakingContract(cooldownPeriod, migrationManager, emergencyManager, token);
    await staking.deploy();

    return staking;
  }

  async deploy() {
    this.staking = await StakingContractWrapper.new(this.cooldownPeriod,
      StakingContract.getAddress(this.migrationManager), StakingContract.getAddress(this.emergencyManager),
      StakingContract.getAddress(this.token));
  }

  getAddress() {
    return this.staking.address;
  }

  async getVersion() {
    return this.staking.VERSION.call();
  }

  async getCooldownPeriod() {
    return this.staking.cooldownPeriod.call();
  }

  async getStakeChangeNotifier() {
    return this.staking.notifier.call();
  }

  async setMigrationManager(manager, options = {}) {
    return this.staking.setMigrationManager(StakingContract.getAddress(manager), options);
  }

  async setEmergencyManager(manager, options = {}) {
    return this.staking.setEmergencyManager(StakingContract.getAddress(manager), options);
  }

  async setStakeChangeNotifier(notifier, options = {}) {
    return this.staking.setStakeChangeNotifier(StakingContract.getAddress(notifier), options);
  }

  async getMigrationManager() {
    return this.staking.migrationManager.call();
  }

  async getEmergencyManager() {
    return this.staking.emergencyManager.call();
  }

  async getToken() {
    return this.staking.token.call();
  }

  async notifyStakeChange(stakeOwner) {
    return this.staking.notify(StakingContract.getAddress(stakeOwner));
  }

  async addMigrationDestination(newStakingContract, options = {}) {
    return this.staking.addMigrationDestination(StakingContract.getAddress(newStakingContract), options);
  }

  async removeMigrationDestination(stakingContract, options = {}) {
    return this.staking.removeMigrationDestination(StakingContract.getAddress(stakingContract), options);
  }

  async isApprovedStakingContract(stakingContract) {
    return this.staking.isApprovedStakingContract.call(StakingContract.getAddress(stakingContract));
  }

  async getApprovedStakingContracts() {
    const contracts = [];

    const length = (await this.staking.getApprovedStakingContractsLength.call()).toNumber();
    for (let i = 0; i < length; ++i) {
      contracts.push(await this.staking.approvedStakingContracts.call(i));
    }

    return contracts;
  }

  static getAddress(obj) {
    return obj instanceof Object ? obj.address : obj;
  }

  static getEvents() {
    return {
      staked: 'Staked',
      unstaked: 'Unstaked',
      restaked: 'Restaked',
      withdrew: 'Withdrew',
      acceptedMigration: 'AcceptedMigration',
      migrationManagerUpdated: 'MigrationManagerUpdated',
      migrationDestinationAdded: 'MigrationDestinationAdded',
      migrationDestinationRemoved: 'MigrationDestinationRemoved',
      emergencyManagerUpdated: 'EmergencyManagerUpdated',
      stakeChangeNotifierUpdated: 'StakeChangeNotifierUpdated',
      stakeChangeNotificationFailed: 'StakeChangeNotificationFailed',
    };
  }
}

export default StakingContract;
