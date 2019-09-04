const TruffleStakingContract = artifacts.require('../../contracts/StakingContract.sol');

class StakingContract {
  constructor(migrationManager, emergencyManager, token) {
    this.migrationManager = migrationManager;
    this.emergencyManager = emergencyManager;
    this.token = token;
  }

  static async new(migrationManager, emergencyManager, token) {
    const staking = new StakingContract(migrationManager, emergencyManager, token);
    await staking.deploy();

    return staking;
  }

  async deploy() {
    this.staking = await TruffleStakingContract.new(this.migrationManager, this.emergencyManager, this.token);
  }

  getAddress() {
    return this.staking.address;
  }

  async getVersion() {
    return this.staking.VERSION.call();
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
}

export default StakingContract;
