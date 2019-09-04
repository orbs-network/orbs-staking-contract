import chai from 'chai';
import { BN, expectRevert, constants } from 'openzeppelin-test-helpers';
import StakingContract from './helpers/stakingContract';

const { expect } = chai;

const VERSION = new BN(1);

const TestERC20 = artifacts.require('../../contracts/tests/TestERC20.sol');

contract('StakingContract', (accounts) => {
  const migrationManager = accounts[8];
  const emergencyManager = accounts[9];

  let token;
  beforeEach(async () => {
    token = await TestERC20.new();
  });

  describe('construction', async () => {
    it('should not allow to create with a 0 migration manager', async () => {
      await expectRevert(StakingContract.new(constants.ZERO_ADDRESS, emergencyManager, token.address),
        'StakingContract::ctor - migration manager must not be 0');
    });

    it('should not allow to create with a 0 emergency manager', async () => {
      await expectRevert(StakingContract.new(migrationManager, constants.ZERO_ADDRESS, token.address),
        'StakingContract::ctor - emergency manager must not be 0');
    });

    it('should not allow to create with a 0 token address', async () => {
      await expectRevert(StakingContract.new(migrationManager, emergencyManager, constants.ZERO_ADDRESS),
        'StakingContract::ctor - Orbs token must not be 0');
    });

    it('should report version', async () => {
      const staking = await StakingContract.new(migrationManager, emergencyManager, token.address);

      expect(await staking.getVersion()).to.be.bignumber.eq(VERSION);
    });

    it('should correctly initialize fields', async () => {
      const staking = await StakingContract.new(migrationManager, emergencyManager, token.address);

      expect(await staking.getMigrationManager()).to.eql(migrationManager);
      expect(await staking.getEmergencyManager()).to.eql(emergencyManager);
      expect(await staking.getToken()).to.eql(token.address);
    });
  });
});
