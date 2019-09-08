import chai from 'chai';
import { BN, expectRevert, expectEvent, constants, time } from 'openzeppelin-test-helpers';
import StakingContract from './helpers/stakingContract';

const { expect } = chai;
const { duration } = time;

const EVENTS = StakingContract.getEvents();
const VERSION = new BN(1);
const MAX_APPROVED_STAKING_CONTRACTS = 10;

const TestERC20 = artifacts.require('../../contracts/tests/TestERC20.sol');
const StakeChangeNotifier = artifacts.require('../../contracts/tests/StakeChangeNotifierMock.sol');
const ReentrantStakeChangeNotifier = artifacts.require('../../contracts/tests/ReentrantStakeChangeNotifierMock.sol');

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
      expect(await staking.getTotalStakedTokens()).to.be.bignumber.eq(new BN(0));
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
        expect(await staking.getMigrationManager()).to.eql(migrationManager);

        const tx = await staking.setMigrationManager(newMigrationManager, { from: sender });

        expectEvent.inLogs(tx.logs, EVENTS.migrationManagerUpdated, { migrationManager: newMigrationManager });

        expect(await staking.getMigrationManager()).to.eql(newMigrationManager);
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
        expect(await staking.getEmergencyManager()).to.eql(emergencyManager);

        const tx = await staking.setEmergencyManager(newEmergencyManager, { from: sender });

        expectEvent.inLogs(tx.logs, EVENTS.emergencyManagerUpdated, { emergencyManager: newEmergencyManager });

        expect(await staking.getEmergencyManager()).to.eql(newEmergencyManager);
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
        expect(await staking.getStakeChangeNotifier()).to.eql(constants.ZERO_ADDRESS);

        const tx = await staking.setStakeChangeNotifier(newNotifier, { from: sender });

        expectEvent.inLogs(tx.logs, EVENTS.stakeChangeNotifierUpdated, { notifier: newNotifier });

        expect(await staking.getStakeChangeNotifier()).to.eql(newNotifier);
      });

      context('already set', async () => {
        beforeEach(async () => {
          await staking.setStakeChangeNotifier(newNotifier, { from: sender });
        });

        it('should allow to reset to 0', async () => {
          expect(await staking.getStakeChangeNotifier()).to.eql(newNotifier);

          const tx = await staking.setStakeChangeNotifier(constants.ZERO_ADDRESS, { from: sender });

          expectEvent.inLogs(tx.logs, EVENTS.stakeChangeNotifierUpdated, { notifier: constants.ZERO_ADDRESS });

          expect(await staking.getStakeChangeNotifier()).to.eql(constants.ZERO_ADDRESS);
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
        notifier = await StakeChangeNotifier.new();
        await staking.setStakeChangeNotifier(notifier, { from: migrationManager });
      });

      it('should succeed', async () => {
        expect(await notifier.calledWith.call()).to.eql(constants.ZERO_ADDRESS);

        await staking.notifyStakeChange(stakeOwner);

        expect(await notifier.calledWith.call()).to.eql(stakeOwner);
      });

      context('reverting', async () => {
        beforeEach(async () => {
          await notifier.setRevert(true);
        });

        it('should handle revert and emit a failing event', async () => {
          expect(await notifier.calledWith.call()).to.eql(constants.ZERO_ADDRESS);

          const tx = await staking.notifyStakeChange(stakeOwner);

          expectEvent.inLogs(tx.logs, EVENTS.stakeChangeNotificationFailed, { notifier: notifier.address });

          expect(await notifier.calledWith.call()).to.eql(constants.ZERO_ADDRESS);
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
          expect(await staking.isApprovedStakingContract(destination)).to.be.false();

          const tx = await staking.addMigrationDestination(destination, { from: sender });

          expectEvent.inLogs(tx.logs, EVENTS.migrationDestinationAdded, { stakingContract: destination });

          expect(await staking.isApprovedStakingContract(destination)).to.be.true();
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

        expect(await staking.isApprovedStakingContract(destination)).to.be.false();
        await staking.addMigrationDestination(destination, { from: sender });
        expect(await staking.isApprovedStakingContract(destination)).to.be.true();

        await staking.removeMigrationDestination(destination, { from: sender });
        expect(await staking.isApprovedStakingContract(destination)).to.be.false();

        await staking.addMigrationDestination(destination, { from: sender });
        expect(await staking.isApprovedStakingContract(destination)).to.be.true();
      });

      it('should remove contracts', async () => {
        for (const destination of migrationDestinations) {
          await staking.addMigrationDestination(destination, { from: sender });
        }

        for (const destination of migrationDestinations) {
          expect(await staking.isApprovedStakingContract(destination)).to.be.true();

          const tx = await staking.removeMigrationDestination(destination, { from: sender });

          expectEvent.inLogs(tx.logs, EVENTS.migrationDestinationRemoved, { stakingContract: destination });

          expect(await staking.isApprovedStakingContract(destination)).to.be.false();
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

  describe('staking', async () => {
    let staking;
    let notifier;
    beforeEach(async () => {
      const cooldown = duration.days(1);
      staking = await StakingContract.new(cooldown, migrationManager, emergencyManager, token);
      notifier = await StakeChangeNotifier.new();
      await staking.setStakeChangeNotifier(notifier, { from: migrationManager });
    });

    context('no stake', async () => {
      it('should allow to stake', async () => {
        const specs = [
          { stakeOwner: accounts[0], stake: new BN(1000) },
          { stakeOwner: accounts[1], stake: new BN(1) },
          { stakeOwner: accounts[2], stake: new BN(10) },
          { stakeOwner: accounts[5], stake: new BN(100000) },
          { stakeOwner: accounts[6], stake: new BN(50) },
        ];
        for (const spec of specs) {
          const { stakeOwner, stake } = spec;
          await token.assign(stakeOwner, stake);
          await token.approve(staking.getAddress(), stake, { from: stakeOwner });

          const prevStakingBalance = await token.balanceOf(staking.getAddress());
          const prevStakeOwnerBalance = await token.balanceOf(stakeOwner);
          const prevTotalStakedTokens = await staking.getTotalStakedTokens();

          const tx = await staking.stake(stake, { from: stakeOwner });

          expectEvent.inLogs(tx.logs, EVENTS.staked, { stakeOwner, amount: stake });
          expect(await notifier.calledWith.call()).to.eql(stakeOwner);

          expect(await token.balanceOf(staking.getAddress())).to.be.bignumber.eq(prevStakingBalance.add(stake));
          expect(await token.balanceOf(stakeOwner)).to.be.bignumber.eq(prevStakeOwnerBalance.sub(stake));
          expect(await staking.getStakeBalanceOf(stakeOwner)).to.be.bignumber.eq(stake);
          const unstakedStatus = await staking.getUnstakeStatus(stakeOwner);
          expect(unstakedStatus.cooldownAmount).to.be.bignumber.eq(new BN(0));
          expect(unstakedStatus.cooldownEndTime).to.be.bignumber.eq(new BN(0));
          expect(await staking.getTotalStakedTokens()).to.be.bignumber.eq(prevTotalStakedTokens.add(stake));
        }
      });

      describe('accept migration', async () => {
        const stake = new BN(12345);
        const stakeOwner = accounts[2];
        const stakeOwner2 = accounts[5];

        beforeEach(async () => {
          await token.assign(stakeOwner, stake);
          await token.approve(staking.getAddress(), stake.add(new BN(1000)), { from: stakeOwner });
        });

        it('should allow to stake on behalf of a different staker', async () => {
          expect(await token.balanceOf(staking.getAddress())).to.be.bignumber.eq(new BN(0));
          expect(await token.balanceOf(stakeOwner)).to.be.bignumber.eq(stake);
          expect(await staking.getStakeBalanceOf(stakeOwner)).to.be.bignumber.eq(new BN(0));
          expect(await token.balanceOf(stakeOwner2)).to.be.bignumber.eq(new BN(0));
          expect(await staking.getStakeBalanceOf(stakeOwner2)).to.be.bignumber.eq(new BN(0));

          const tx = await staking.acceptMigration(stakeOwner2, stake, { from: stakeOwner });

          expectEvent.inLogs(tx.logs, EVENTS.acceptedMigration, { stakeOwner: stakeOwner2, amount: stake });
          expect(await notifier.calledWith.call()).to.eql(stakeOwner2);

          expect(await token.balanceOf(staking.getAddress())).to.be.bignumber.eq(stake);
          expect(await token.balanceOf(stakeOwner)).to.be.bignumber.eq(new BN(0));
          expect(await staking.getStakeBalanceOf(stakeOwner)).to.be.bignumber.eq(new BN(0));
          expect(await token.balanceOf(stakeOwner2)).to.be.bignumber.eq(new BN(0));
          expect(await staking.getStakeBalanceOf(stakeOwner2)).to.be.bignumber.eq(stake);
        });

        it('should not allow to stake more tokens than the staker has', async () => {
          await token.approve(staking.getAddress(), stake.add(new BN(1000)), { from: stakeOwner });

          await expectRevert.unspecified(staking.acceptMigration(stakeOwner2, stake.add(new BN(1)),
            { from: stakeOwner }));
        });

        it('should not allow to stake 0 tokens', async () => {
          await expectRevert(staking.acceptMigration(stakeOwner2, new BN(0), { from: stakeOwner }),
            'StakingContract::stake - amount must be greater than 0');
        });

        it('should not allow to stake more tokens than the staker has on behalf of a different staker', async () => {
          await expectRevert.unspecified(staking.acceptMigration(stakeOwner2, stake.add(new BN(1)),
            { from: stakeOwner }));
        });

        it('should not allow to stake on behalf of a 0 address', async () => {
          await expectRevert(staking.acceptMigration(constants.ZERO_ADDRESS, stake, { from: stakeOwner }),
            "StakingContract::stake - stake owner can't be 0");
        });

        context('reentrant stake change notifier', async () => {
          let reentrantNotifier;
          beforeEach(async () => {
            reentrantNotifier = await ReentrantStakeChangeNotifier.new(staking.getAddress(), token.address);
            await staking.setStakeChangeNotifier(reentrantNotifier, { from: migrationManager });
          });

          it('should effectively stake and deduct tokens twice', async () => {
            await token.assign(reentrantNotifier.address, stake);
            await reentrantNotifier.approve(staking.getAddress(), stake, { from: stakeOwner });
            await reentrantNotifier.setStakeData(stakeOwner2, stake);

            const tx = await staking.acceptMigration(stakeOwner2, stake, { from: stakeOwner });

            expect(tx.logs).to.have.length(2); // Two events for the double stake.
            expectEvent.inLogs(tx.logs, EVENTS.acceptedMigration, { stakeOwner: stakeOwner2, amount: stake });
            expect(await reentrantNotifier.calledWith.call()).to.eql(stakeOwner2);

            // The operation will result in a double stake attribute to stakeOwner2:
            const effectiveStake = stake.mul(new BN(2));
            expect(await token.balanceOf(staking.getAddress())).to.be.bignumber.eq(effectiveStake);
            expect(await staking.getStakeBalanceOf(stakeOwner2)).to.be.bignumber.eq(effectiveStake);
          });

          context('insufficient balance for twice the stake', async () => {
            it('should stake only once', async () => {
              await token.assign(reentrantNotifier.address, stake.sub(new BN(1)));
              await reentrantNotifier.approve(staking.getAddress(), stake, { from: stakeOwner });
              await reentrantNotifier.setStakeData(stakeOwner2, stake);

              const tx = await staking.acceptMigration(stakeOwner2, stake, { from: stakeOwner });

              expectEvent.inLogs(tx.logs, EVENTS.acceptedMigration, { stakeOwner: stakeOwner2, amount: stake });
              expectEvent.inLogs(tx.logs, EVENTS.stakeChangeNotificationFailed,
                { notifier: reentrantNotifier.address });
              expect(await reentrantNotifier.calledWith.call()).to.eql(constants.ZERO_ADDRESS);

              // The operation will result in a single stake attribute to stakeOwner2:
              expect(await token.balanceOf(staking.getAddress())).to.be.bignumber.eq(stake);
              expect(await staking.getStakeBalanceOf(stakeOwner2)).to.be.bignumber.eq(stake);
            });
          });
        });
      });

      describe('batch rewards', async () => {
        const stakers = accounts.slice(0, 20);
        const stakes = [
          new BN(3134), new BN(5052), new BN(1445), new BN(6102), new BN(4667),
          new BN(3522), new BN(2103), new BN(3018), new BN(6111), new BN(3070),
          new BN(2481), new BN(5000), new BN(6105), new BN(5475), new BN(2249),
          new BN(7615), new BN(3087), new BN(1501), new BN(620), new BN(7198),
        ];
        const totalStake = stakes.reduce((sum, s) => sum.add(s), new BN(0));
        const caller = accounts[0];

        beforeEach(async () => {
          await token.assign(caller, totalStake);
          await token.approve(staking.getAddress(), totalStake, { from: caller });
        });

        it('should allow to stake on behalf of different stakers in batch', async () => {
          const tx = await staking.distributeBatchRewards(totalStake, stakers, stakes, { from: caller });

          for (let i = 0; i < stakers.length; ++i) {
            const stakeOwner = stakers[i];
            const stake = stakes[i];

            expectEvent.inLogs(tx.logs, EVENTS.staked, { stakeOwner, amount: stake });

            expect(await token.balanceOf(stakeOwner)).to.be.bignumber.eq(new BN(0));
            expect(await staking.getStakeBalanceOf(stakeOwner)).to.be.bignumber.eq(stake);
          }

          expect(await token.balanceOf(caller)).to.be.bignumber.eq(new BN(0));
          expect(await token.balanceOf(staking.getAddress())).to.be.bignumber.eq(totalStake);
          expect(await staking.getTotalStakedTokens()).to.be.bignumber.eq(totalStake);
        });

        it('should fail batch staking if token balance is insufficient', async () => {
          await token.assign(caller, totalStake.sub(new BN(1)));
          await expectRevert.unspecified(staking.distributeBatchRewards(totalStake, stakers, stakes, { from: caller }));
        });

        it('should fail batch staking if total batch amount is incorrect', async () => {
          await expectRevert(staking.distributeBatchRewards(totalStake.add(new BN(1)), stakers, stakes,
            { from: caller }), 'StakingContract::distributeBatchRewards - incorrect total amount');
          await expectRevert(staking.distributeBatchRewards(totalStake.sub(new BN(1)), stakers, stakes,
            { from: caller }), 'StakingContract::distributeBatchRewards - incorrect total amount');
        });

        it('should fail batch staking if stake owners and amounts lists are in different sizes', async () => {
          await expectRevert(staking.distributeBatchRewards(totalStake, stakers.slice(1), stakes,
            { from: caller }), 'StakingContract::distributeBatchRewards - lists must be of the same size');
          await expectRevert(staking.distributeBatchRewards(totalStake.sub(stakes[0]), stakers, stakes.slice(1),
            { from: caller }), 'StakingContract::distributeBatchRewards - lists must be of the same size');
        });

        it('should fail batch staking if total token amount is 0', async () => {
          await expectRevert(staking.distributeBatchRewards(new BN(0), stakers, stakes, { from: caller }),
            'StakingContract::distributeBatchRewards - total amount must be greater than 0');
        });

        it('should fail batch staking if one of the stake owners is a 0 address', async () => {
          const stakers2 = stakers.slice(0);
          stakers2[5] = constants.ZERO_ADDRESS;
          await expectRevert(staking.distributeBatchRewards(totalStake, stakers2, stakes, { from: caller }),
            "StakingContract::stake - stake owner can't be 0");
        });

        it('should fail batch staking if called with empty lists', async () => {
          await expectRevert(staking.distributeBatchRewards(totalStake, [], [], { from: caller }),
            "StakingContract::distributeBatchRewards - lists can't be empty");
        });
      });
    });

    context('with stake', async () => {
      const stake = new BN(1000);
      const stakeOwner = accounts[4];

      beforeEach(async () => {
        await token.assign(stakeOwner, stake);
        await token.approve(staking.getAddress(), stake, { from: stakeOwner });
        await staking.stake(stake, { from: stakeOwner });
      });

      it('should allow to stake more tokens', async () => {
        const newStake = new BN(100);
        await token.assign(stakeOwner, newStake);
        await token.approve(staking.getAddress(), newStake, { from: stakeOwner });

        const tx = await staking.stake(newStake, { from: stakeOwner });

        expectEvent.inLogs(tx.logs, EVENTS.staked, { stakeOwner, amount: newStake });

        const totalStake = stake.add(newStake);
        expect(await token.balanceOf(staking.getAddress())).to.be.bignumber.eq(totalStake);
        expect(await token.balanceOf(stakeOwner)).to.be.bignumber.eq(new BN(0));
        expect(await staking.getStakeBalanceOf(stakeOwner)).to.be.bignumber.eq(totalStake);
        expect(await staking.getTotalStakedTokens()).to.be.bignumber.eq(totalStake);
      });
    });
  });
});
