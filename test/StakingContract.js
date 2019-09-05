import chai from 'chai';
import { BN, expectRevert, expectEvent, constants } from 'openzeppelin-test-helpers';
import StakingContract from './helpers/stakingContract';

const { expect } = chai;

const VERSION = new BN(1);

const SECOND = new BN(1);
const MINUTE = SECOND.mul(new BN(60));

const EVENTS = {
  migrationManagerUpdated: 'MigrationManagerUpdated',
  emergencyManagerUpdated: 'EmergencyManagerUpdated',
  stakeChangeNotifierUpdated: 'StakeChangeNotifierUpdated',
  stakeChangeNotificationFailed: 'StakeChangeNotificationFailed',
};

const TestERC20 = artifacts.require('../../contracts/tests/TestERC20.sol');
const StakeChangeNotifierMock = artifacts.require('../../contracts/tests/StakeChangeNotifierMock.sol');

contract('StakingContract', (accounts) => {
  const migrationManager = accounts[8];
  const emergencyManager = accounts[9];

  let token;
  beforeEach(async () => {
    token = await TestERC20.new();
  });

  describe('construction', async () => {
    it('should not allow to create with a 0 cooldown', async () => {
      await expectRevert(StakingContract.new(new BN(0), migrationManager, emergencyManager, token),
        'StakingContract::ctor - cooldown period must be greater than 0');
    });

    it('should not allow to create with a 0 migration manager', async () => {
      await expectRevert(StakingContract.new(SECOND, constants.ZERO_ADDRESS, emergencyManager, token),
        'StakingContract::ctor - migration manager must not be 0');
    });

    it('should not allow to create with a 0 emergency manager', async () => {
      await expectRevert(StakingContract.new(SECOND, migrationManager, constants.ZERO_ADDRESS, token),
        'StakingContract::ctor - emergency manager must not be 0');
    });

    it('should not allow to create with a 0 token address', async () => {
      await expectRevert(StakingContract.new(SECOND, migrationManager, emergencyManager, constants.ZERO_ADDRESS),
        'StakingContract::ctor - Orbs token must not be 0');
    });

    it('should report version', async () => {
      const staking = await StakingContract.new(SECOND, migrationManager, emergencyManager, token);

      expect(await staking.getVersion()).to.be.bignumber.eq(VERSION);
    });

    it('should correctly initialize fields', async () => {
      const cooldown = MINUTE.mul(new BN(5));
      const staking = await StakingContract.new(cooldown, migrationManager, emergencyManager, token);

      expect(await staking.getCooldownPeriod()).to.be.bignumber.eq(cooldown);
      expect(await staking.getStakeChangeNotifier()).to.eql(constants.ZERO_ADDRESS);
      expect(await staking.getMigrationManager()).to.eql(migrationManager);
      expect(await staking.getEmergencyManager()).to.eql(emergencyManager);
      expect(await staking.getToken()).to.eql(token.address);
    });
  });

  describe('setting the migration manager', async () => {
    const newMigrationManager = accounts[3];

    let staking;
    beforeEach(async () => {
      const cooldown = MINUTE.mul(new BN(5));
      staking = await StakingContract.new(cooldown, migrationManager, emergencyManager, token);
    });

    context('regular account', async () => {
      const sender = accounts[1];

      it('should not allow to set', async () => {
        await expectRevert(staking.setMigrationManager(newMigrationManager, { from: sender }),
          'StakingContract: caller is not the migration manager');
      });
    });

    context('migration manager', async () => {
      const sender = migrationManager;

      it('should set to a new address', async () => {
        let tx;
        await expect(async () => {
          tx = await staking.setMigrationManager(newMigrationManager, { from: sender });
        }).to.alter(async () => staking.getMigrationManager(), {
          from: migrationManager, to: newMigrationManager,
        });

        expectEvent.inLogs(tx.logs, EVENTS.migrationManagerUpdated, { newMigrationManager });
      });

      it('should not allow to change to 0', async () => {
        await expectRevert(staking.setMigrationManager(constants.ZERO_ADDRESS, { from: sender }),
          'StakingContract::setMigrationManager - address must not be 0');
      });

      it('should not allow to change to the same address', async () => {
        await expectRevert(staking.setMigrationManager(migrationManager, { from: sender }),
          'StakingContract::setMigrationManager - new address must be different');
      });
    });
  });

  describe('setting the emergency manager', async () => {
    const newEmergencyManager = accounts[3];

    let staking;
    beforeEach(async () => {
      const cooldown = MINUTE.mul(new BN(5));
      staking = await StakingContract.new(cooldown, migrationManager, emergencyManager, token);
    });

    context('regular account', async () => {
      const sender = accounts[1];

      it('should not allow to set', async () => {
        await expectRevert(staking.setEmergencyManager(newEmergencyManager, { from: sender }),
          'StakingContract: caller is not the emergency manager');
      });
    });

    context('emergency manager', async () => {
      const sender = emergencyManager;

      it('should set to a new address', async () => {
        let tx;
        await expect(async () => {
          tx = await staking.setEmergencyManager(newEmergencyManager, { from: sender });
        }).to.alter(async () => staking.getEmergencyManager(), {
          from: emergencyManager, to: newEmergencyManager,
        });

        expectEvent.inLogs(tx.logs, EVENTS.emergencyManagerUpdated, { newEmergencyManager });
      });

      it('should not allow to change to 0', async () => {
        await expectRevert(staking.setEmergencyManager(constants.ZERO_ADDRESS, { from: sender }),
          'StakingContract::setEmergencyManager - address must not be 0');
      });

      it('should not allow to change to the same address', async () => {
        await expectRevert(staking.setEmergencyManager(emergencyManager, { from: sender }),
          'StakingContract::setEmergencyManager - new address must be different');
      });
    });
  });

  describe('setting the stake change notifier', async () => {
    const newNotifier = accounts[3];

    let staking;
    beforeEach(async () => {
      const cooldown = MINUTE.mul(new BN(5));
      staking = await StakingContract.new(cooldown, migrationManager, emergencyManager, token);
    });

    context('regular account', async () => {
      const sender = accounts[1];

      it('should not allow to set', async () => {
        await expectRevert(staking.setStakeChangeNotifier(newNotifier, { from: sender }),
          'StakingContract: caller is not the migration manager');
      });
    });

    context('migration manager', async () => {
      const sender = migrationManager;

      it('should set to a new address', async () => {
        let tx;
        await expect(async () => {
          tx = await staking.setStakeChangeNotifier(newNotifier, { from: sender });
        }).to.alter(async () => staking.getStakeChangeNotifier(), {
          from: constants.ZERO_ADDRESS, to: newNotifier,
        });

        expectEvent.inLogs(tx.logs, EVENTS.stakeChangeNotifierUpdated, { newNotifier });
      });

      context('already set', async () => {
        beforeEach(async () => {
          await staking.setStakeChangeNotifier(newNotifier, { from: sender });
        });

        it('should allow to reset to 0', async () => {
          let tx;
          await expect(async () => {
            tx = await staking.setStakeChangeNotifier(constants.ZERO_ADDRESS, { from: sender });
          }).to.alter(async () => staking.getStakeChangeNotifier(), {
            from: newNotifier, to: constants.ZERO_ADDRESS,
          });

          expectEvent.inLogs(tx.logs, EVENTS.stakeChangeNotifierUpdated, { newNotifier: constants.ZERO_ADDRESS });
        });

        it('should not allow to change to the same address', async () => {
          await expectRevert(staking.setStakeChangeNotifier(newNotifier, { from: sender }),
            'StakingContract::setStakeChangeNotifier - new address must be different');
        });
      });
    });
  });

  describe('stake change notification', async () => {
    const stakeOwner = accounts[6];

    let staking;
    beforeEach(async () => {
      const cooldown = MINUTE.mul(new BN(5));
      staking = await StakingContract.new(cooldown, migrationManager, emergencyManager, token);
    });

    context('no notifier', async () => {
      it('should succeed', async () => {
        const tx = await staking.notifyStakeChange(stakeOwner);
        expect(tx.logs).to.be.empty();
      });
    });

    context('EOA notifier', async () => {
      const notifier = accounts[1];
      beforeEach(async () => {
        await staking.setStakeChangeNotifier(notifier, { from: migrationManager });
      });

      it('should emit a failing event', async () => {
        const tx = await staking.notifyStakeChange(stakeOwner);
        expect(tx.logs).to.be.empty();
      });
    });

    context('contract notifier', async () => {
      let notifier;
      beforeEach(async () => {
        notifier = await StakeChangeNotifierMock.new();
        await staking.setStakeChangeNotifier(notifier, { from: migrationManager });
      });

      it('should succeed', async () => {
        await expect(async () => staking.notifyStakeChange(stakeOwner))
          .to.alter(async () => notifier.calledWith.call(), {
            from: constants.ZERO_ADDRESS, to: stakeOwner,
          });
      });

      context('reverting', async () => {
        beforeEach(async () => {
          await notifier.setRevert(true);
        });

        it('should handle revert and emit a failing event', async () => {
          let tx;
          await expect(async () => {
            tx = await staking.notifyStakeChange(stakeOwner);
          }).not.to.alter(async () => notifier.calledWith.call());

          expectEvent.inLogs(tx.logs, EVENTS.stakeChangeNotificationFailed, { notifier: notifier.address });
        });
      });
    });
  });
});
