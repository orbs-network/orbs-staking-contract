import chai from 'chai';
import { BN, expectRevert, expectEvent, constants, time } from 'openzeppelin-test-helpers';
import StakingContract from './helpers/stakingContract';

const { expect } = chai;
const { duration } = time;

const EVENTS = StakingContract.getEvents();
const VERSION = new BN(1);
const MAX_APPROVED_STAKING_CONTRACTS = 10;

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
      await expectRevert(StakingContract.new(duration.seconds(1), constants.ZERO_ADDRESS, emergencyManager, token),
        'StakingContract::ctor - migration manager must not be 0');
    });

    it('should not allow to create with a 0 emergency manager', async () => {
      await expectRevert(StakingContract.new(duration.seconds(1), migrationManager, constants.ZERO_ADDRESS, token),
        'StakingContract::ctor - emergency manager must not be 0');
    });

    it('should not allow to create with a 0 token address', async () => {
      await expectRevert(StakingContract.new(duration.seconds(1), migrationManager, emergencyManager,
        constants.ZERO_ADDRESS), 'StakingContract::ctor - ORBS token must not be 0');
    });

    it('should report version', async () => {
      const staking = await StakingContract.new(duration.seconds(1), migrationManager, emergencyManager, token);

      expect(await staking.getVersion()).to.be.bignumber.eq(VERSION);
    });

    it('should correctly initialize fields', async () => {
      const cooldown = duration.minutes(5);
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
      const cooldown = duration.minutes(5);
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

        expectEvent.inLogs(tx.logs, EVENTS.migrationManagerUpdated, { migrationManager: newMigrationManager });
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
      const cooldown = duration.minutes(5);
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

        expectEvent.inLogs(tx.logs, EVENTS.emergencyManagerUpdated, { emergencyManager: newEmergencyManager });
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
      const cooldown = duration.minutes(5);
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

        expectEvent.inLogs(tx.logs, EVENTS.stakeChangeNotifierUpdated, { notifier: newNotifier });
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

          expectEvent.inLogs(tx.logs, EVENTS.stakeChangeNotifierUpdated, { notifier: constants.ZERO_ADDRESS });
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
      const cooldown = duration.minutes(5);
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

  describe('management migration destinations', async () => {
    const migrationDestinations = accounts.slice(0, MAX_APPROVED_STAKING_CONTRACTS);

    let staking;
    beforeEach(async () => {
      const cooldown = duration.minutes(5);
      staking = await StakingContract.new(cooldown, migrationManager, emergencyManager, token);
    });

    context('regular account', async () => {
      const sender = accounts[1];
      const destination = migrationDestinations[0];

      it('should not allow to add a new contract', async () => {
        await expectRevert(staking.addMigrationDestination(destination, { from: sender }),
          'StakingContract: caller is not the migration manager');
      });

      it('should not allow to remove any contract', async () => {
        await expectRevert(staking.addMigrationDestination(destination, { from: sender }),
          'StakingContract: caller is not the migration manager');
      });
    });

    context('migration manager', async () => {
      const sender = migrationManager;

      it('should add new staking contracts', async () => {
        for (const destination of migrationDestinations) {
          let tx;
          await expect(async () => {
            tx = await staking.addMigrationDestination(destination, { from: sender });
          }).to.alter(async () => staking.isApprovedStakingContract(destination), {
            from: false, to: true,
          });

          expectEvent.inLogs(tx.logs, EVENTS.migrationDestinationAdded, { stakingContract: destination });
        }

        expect(await staking.getApprovedStakingContracts()).to.have.members(migrationDestinations);
      });

      it('should not allow to add a 0 address', async () => {
        await expectRevert(staking.addMigrationDestination(constants.ZERO_ADDRESS, { from: sender }),
          'StakingContract::addMigrationDestination - address must not be 0');
      });

      it('should not allow to add a duplicate contract', async () => {
        const destination = migrationDestinations[0];

        await staking.addMigrationDestination(destination, { from: sender });
        await expectRevert(staking.addMigrationDestination(destination, { from: sender }),
          "StakingContract::addMigrationDestination - can't add a duplicate staking contract");
      });

      it(`should not allow to add more than ${MAX_APPROVED_STAKING_CONTRACTS} contracts`, async () => {
        for (const destination of migrationDestinations) {
          await staking.addMigrationDestination(destination, { from: sender });
        }

        expect(await staking.getApprovedStakingContracts()).to.have.lengthOf(MAX_APPROVED_STAKING_CONTRACTS);

        await expectRevert(staking.addMigrationDestination(accounts[20], { from: sender }),
          "StakingContract::addMigrationDestination - can't add more staking contracts");
      });

      it('should not allow to add again a previously removed contract', async () => {
        const destination = migrationDestinations[0];

        await expect(async () => staking.addMigrationDestination(destination, { from: sender }))
          .to.alter(async () => staking.isApprovedStakingContract(destination), {
            from: false, to: true,
          });

        await expect(async () => staking.removeMigrationDestination(destination, { from: sender }))
          .to.alter(async () => staking.isApprovedStakingContract(destination), {
            from: true, to: false,
          });

        await expect(async () => staking.addMigrationDestination(destination, { from: sender }))
          .to.alter(async () => staking.isApprovedStakingContract(destination), {
            from: false, to: true,
          });
      });

      it('should remove contracts', async () => {
        for (const destination of migrationDestinations) {
          await staking.addMigrationDestination(destination, { from: sender });
        }

        for (const destination of migrationDestinations) {
          let tx;
          await expect(async () => {
            tx = await staking.removeMigrationDestination(destination, { from: sender });
          }).to.alter(async () => staking.isApprovedStakingContract(destination), {
            from: true, to: false,
          });

          expectEvent.inLogs(tx.logs, EVENTS.migrationDestinationRemoved, { stakingContract: destination });
        }

        expect(await staking.getApprovedStakingContracts()).to.be.empty();
      });

      it('should not allow to add a 0 address', async () => {
        await expectRevert(staking.removeMigrationDestination(constants.ZERO_ADDRESS, { from: sender }),
          'StakingContract::removeMigrationDestination - address must not be 0');
      });

      it('should revert when trying to remove a non-existing contract', async () => {
        const destination = migrationDestinations[0];
        await staking.addMigrationDestination(destination, { from: sender });
        expect(await staking.getApprovedStakingContracts()).to.have.members([destination]);

        await expectRevert(staking.removeMigrationDestination(accounts[20], { from: sender }),
          "StakingContract::removeMigrationDestination - staking contract doesn't exist");
      });
    });
  });
});
