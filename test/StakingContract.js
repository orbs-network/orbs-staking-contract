import chai from 'chai';
import { BN, expectRevert, constants } from 'openzeppelin-test-helpers';
import StakingContract from './helpers/stakingContract';

const { expect } = chai;

const VERSION = new BN(1);

const SECOND = new BN(1);
const MINUTE = SECOND.mul(new BN(60));

const TestERC20 = artifacts.require('../../contracts/tests/TestERC20.sol');

contract('StakingContract', (accounts) => {
  const migrationManager = accounts[8];
  const emergencyManager = accounts[9];

  let token;
  beforeEach(async () => {
    token = await TestERC20.new();
  });

  describe('construction', async () => {
    it('should not allow to create with a 0 cooldown', async () => {
      await expectRevert(StakingContract.new(new BN(0), migrationManager, emergencyManager, token.address),
        'StakingContract::ctor - cooldown period must be greater than 0');
    });

    it('should not allow to create with a 0 migration manager', async () => {
      await expectRevert(StakingContract.new(SECOND, constants.ZERO_ADDRESS, emergencyManager, token.address),
        'StakingContract::ctor - migration manager must not be 0');
    });

    it('should not allow to create with a 0 emergency manager', async () => {
      await expectRevert(StakingContract.new(SECOND, migrationManager, constants.ZERO_ADDRESS, token.address),
        'StakingContract::ctor - emergency manager must not be 0');
    });

    it('should not allow to create with a 0 token address', async () => {
      await expectRevert(StakingContract.new(SECOND, migrationManager, emergencyManager, constants.ZERO_ADDRESS),
        'StakingContract::ctor - Orbs token must not be 0');
    });

    it('should report version', async () => {
      const staking = await StakingContract.new(SECOND, migrationManager, emergencyManager, token.address);

      expect(await staking.getVersion()).to.be.bignumber.eq(VERSION);
    });

    it('should correctly initialize fields', async () => {
      const cooldown = MINUTE.mul(new BN(5));
      const staking = await StakingContract.new(cooldown, migrationManager, emergencyManager, token.address);

      expect(await staking.getCooldownPeriod()).to.be.bignumber.eq(cooldown);
      expect(await staking.getMigrationManager()).to.eql(migrationManager);
      expect(await staking.getEmergencyManager()).to.eql(emergencyManager);
      expect(await staking.getToken()).to.eql(token.address);
    });
  });
});
