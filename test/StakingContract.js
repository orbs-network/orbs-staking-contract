import chai from 'chai';
import { BN, expectRevert, expectEvent, constants, time } from 'openzeppelin-test-helpers';
import StakingContract from './helpers/stakingContract';
import StakeChangeNotifier from './helpers/stakeChangeNotifier';
import ReentrantStakeChangeNotifier from './helpers/reentrantStakeChangeNotifier';

const { expect } = chai;
const { duration } = time;

const EVENTS = StakingContract.getEvents();
const VERSION = new BN(1);
const MAX_APPROVED_STAKING_CONTRACTS = 10;
const TIME_ERROR = duration.seconds(10);

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
    const testSetMigrationManager = async (staking, from, to) => {
      expect(await staking.getMigrationManager()).to.eql(from);

      const tx = await staking.setMigrationManager(to, { from });
      expectEvent.inLogs(tx.logs, EVENTS.migrationManagerUpdated, { migrationManager: to });

      expect(await staking.getMigrationManager()).to.eql(to);
    };

    let staking;
    beforeEach(async () => {
      const cooldown = duration.minutes(5);
      staking = await StakingContract.new(cooldown, migrationManager, emergencyManager, token);
    });

    context('regular account', async () => {
      it('should not allow to set', async () => {
        const sender = accounts[1];
        const newMigrationManager = accounts[2];
        await expectRevert(staking.setMigrationManager(newMigrationManager, { from: sender }),
          'StakingContract: caller is not the migration manager');
      });
    });

    context('migration manager', async () => {
      it('should set to a new address', async () => {
        const newMigrationManager = accounts[3];
        await testSetMigrationManager(staking, migrationManager, newMigrationManager);
      });

      it('should not allow to change to 0', async () => {
        await expectRevert(staking.setMigrationManager(constants.ZERO_ADDRESS, { from: migrationManager }),
          'StakingContract::setMigrationManager - address must not be 0');
      });

      it('should not allow to change to the same address', async () => {
        await expectRevert(staking.setMigrationManager(migrationManager, { from: migrationManager }),
          'StakingContract::setMigrationManager - new address must be different');
      });
    });
  });

  describe('setting the emergency manager', async () => {
    const testSetEmergencyManager = async (staking, from, to) => {
      expect(await staking.getEmergencyManager()).to.eql(from);

      const tx = await staking.setEmergencyManager(to, { from });
      expectEvent.inLogs(tx.logs, EVENTS.emergencyManagerUpdated, { emergencyManager: to });

      expect(await staking.getEmergencyManager()).to.eql(to);
    };

    let staking;
    beforeEach(async () => {
      const cooldown = duration.minutes(5);
      staking = await StakingContract.new(cooldown, migrationManager, emergencyManager, token);
    });

    context('regular account', async () => {
      const sender = accounts[1];

      it('should not allow to set', async () => {
        const newEmergencyManager = accounts[3];
        await expectRevert(staking.setEmergencyManager(newEmergencyManager, { from: sender }),
          'StakingContract: caller is not the emergency manager');
      });
    });

    context('emergency manager', async () => {
      const sender = emergencyManager;

      it('should set to a new address', async () => {
        const newEmergencyManager = accounts[3];
        await testSetEmergencyManager(staking, emergencyManager, newEmergencyManager);
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

  describe('stake change notifier management', async () => {
    const testSetStakeChangeNotifier = async (staking, from, to) => {
      expect(await staking.getStakeChangeNotifier()).to.eql(from);

      const tx = await staking.setStakeChangeNotifier(to, { from: migrationManager });
      expectEvent.inLogs(tx.logs, EVENTS.stakeChangeNotifierUpdated, { notifier: to });

      expect(await staking.getStakeChangeNotifier()).to.eql(to);
    };

    let staking;
    beforeEach(async () => {
      const cooldown = duration.minutes(5);
      staking = await StakingContract.new(cooldown, migrationManager, emergencyManager, token);
    });

    context('regular account', async () => {
      const sender = accounts[1];

      it('should not allow to set', async () => {
        const newNotifier = accounts[3];
        await expectRevert(staking.setStakeChangeNotifier(newNotifier, { from: sender }),
          'StakingContract: caller is not the migration manager');
      });
    });

    context('migration manager', async () => {
      const sender = migrationManager;

      it('should set to a new address', async () => {
        const newNotifier = accounts[3];
        await testSetStakeChangeNotifier(staking, constants.ZERO_ADDRESS, newNotifier);
      });

      context('already set', async () => {
        const newNotifier = accounts[2];

        beforeEach(async () => {
          await staking.setStakeChangeNotifier(newNotifier, { from: sender });
        });

        it('should allow to reset to 0', async () => {
          await testSetStakeChangeNotifier(staking, newNotifier, constants.ZERO_ADDRESS);
        });

        it('should not allow to change to the same address', async () => {
          await expectRevert(staking.setStakeChangeNotifier(newNotifier, { from: sender }),
            'StakingContract::setStakeChangeNotifier - new address must be different');
        });
      });
    });
  });

  describe('stake change notification', async () => {
    const testSetStakeChangeNotifier = async (staking, notifier, from, to) => {
      expect(await notifier.getCalledWith()).to.have.members(from);

      await staking.notifyStakeChange(to);

      expect(await notifier.getCalledWith()).to.have.members([to]);
    };

    let staking;
    beforeEach(async () => {
      const cooldown = duration.minutes(5);
      staking = await StakingContract.new(cooldown, migrationManager, emergencyManager, token);
    });

    context('no notifier', async () => {
      it('should succeed', async () => {
        const stakeOwner = accounts[6];
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
        const stakeOwner = accounts[5];
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
        const stakeOwner = accounts[3];
        await testSetStakeChangeNotifier(staking, notifier, [], stakeOwner);
      });

      context('reverting', async () => {
        beforeEach(async () => {
          await notifier.setRevert(true);
        });

        it('should handle revert and emit a failing event', async () => {
          expect(await notifier.getCalledWith()).to.be.empty();

          const stakeOwner = accounts[3];
          const tx = await staking.notifyStakeChange(stakeOwner);
          expectEvent.inLogs(tx.logs, EVENTS.stakeChangeNotificationFailed, { notifier: notifier.getAddress() });

          expect(await notifier.getCalledWith()).to.be.empty();
        });
      });
    });
  });

  describe('migration destinations management', async () => {
    const testAddMigrationDestination = async (staking, destination) => {
      expect(await staking.isApprovedStakingContract(destination)).to.be.false();

      const tx = await staking.addMigrationDestination(destination, { from: migrationManager });
      expectEvent.inLogs(tx.logs, EVENTS.migrationDestinationAdded, { stakingContract: destination });

      expect(await staking.isApprovedStakingContract(destination)).to.be.true();
    };

    const testRemoveMigrationDestination = async (staking, destination) => {
      expect(await staking.isApprovedStakingContract(destination)).to.be.true();

      const tx = await staking.removeMigrationDestination(destination, { from: migrationManager });
      expectEvent.inLogs(tx.logs, EVENTS.migrationDestinationRemoved, { stakingContract: destination });

      expect(await staking.isApprovedStakingContract(destination)).to.be.false();
    };

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
          await testAddMigrationDestination(staking, destination);
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

        await testAddMigrationDestination(staking, destination);
        await testRemoveMigrationDestination(staking, destination);
        await testAddMigrationDestination(staking, destination);
      });

      it('should remove contracts', async () => {
        for (const destination of migrationDestinations) {
          await staking.addMigrationDestination(destination, { from: sender });
        }

        for (const destination of migrationDestinations) {
          await testRemoveMigrationDestination(staking, destination);
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
    const testStaking = async (staking, notifier, stakeOwner, stake, from) => {
      const getState = async () => {
        const state = {
          stakingBalance: await token.balanceOf(staking.getAddress()),
          fromBalance: await token.balanceOf(from),
          stakeOwnerStake: await staking.getStakeBalanceOf(stakeOwner),
          stakeOwnerUnstakedStatus: await staking.getUnstakeStatus(stakeOwner),
          totalStakedTokens: await staking.getTotalStakedTokens(),
        };

        if (from !== stakeOwner) {
          state.stakeOwnerBalance = await token.balanceOf(stakeOwner);
          state.fromStake = await staking.getStakeBalanceOf(from);
          state.fromUnstakedStatus = await staking.getUnstakeStatus(from);
        }

        return state;
      };

      const prevState = await getState();

      await notifier.reset();

      if (from === stakeOwner) {
        const tx = await staking.stake(stake, { from });
        expectEvent.inLogs(tx.logs, EVENTS.staked, { stakeOwner, amount: stake });
      } else {
        const tx = await staking.acceptMigration(stakeOwner, stake, { from });
        expectEvent.inLogs(tx.logs, EVENTS.acceptedMigration, { stakeOwner, amount: stake });
      }

      expect(await notifier.getCalledWith()).to.have.members([stakeOwner]);

      const currentState = await getState();

      expect(currentState.stakingBalance).to.be.bignumber.eq(prevState.stakingBalance.add(stake));
      expect(currentState.fromBalance).to.be.bignumber.eq(prevState.fromBalance.sub(stake));
      expect(currentState.stakeOwnerStake).to.be.bignumber.eq(prevState.stakeOwnerStake.add(stake));
      expect(currentState.stakeOwnerUnstakedStatus.cooldownAmount).to.be.bignumber
        .eq(prevState.stakeOwnerUnstakedStatus.cooldownAmount);
      expect(currentState.stakeOwnerUnstakedStatus.cooldownEndTime).to.be.bignumber
        .eq(prevState.stakeOwnerUnstakedStatus.cooldownEndTime);
      expect(currentState.totalStakedTokens).to.be.bignumber.eq(prevState.totalStakedTokens.add(stake));

      if (from !== stakeOwner) {
        expect(currentState.stakeOwnerBalance).to.be.bignumber.eq(prevState.stakeOwnerBalance);
        expect(currentState.fromStake).to.be.bignumber.eq(prevState.fromStake);
        expect(currentState.fromUnstakedStatus.cooldownAmount).to.be.bignumber
          .eq(prevState.fromUnstakedStatus.cooldownAmount);
        expect(currentState.fromUnstakedStatus.cooldownEndTime).to.be.bignumber
          .eq(prevState.fromUnstakedStatus.cooldownEndTime);
      }
    };

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

          await testStaking(staking, notifier, stakeOwner, stake, stakeOwner);
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
          await testStaking(staking, notifier, stakeOwner2, stake, stakeOwner);
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
            reentrantNotifier = await ReentrantStakeChangeNotifier.new(staking, token);
            await staking.setStakeChangeNotifier(reentrantNotifier, { from: migrationManager });
          });

          it('should effectively stake and deduct tokens twice', async () => {
            await token.assign(reentrantNotifier.getAddress(), stake);
            await reentrantNotifier.approve(staking, stake, { from: stakeOwner });
            await reentrantNotifier.setStakeData(stakeOwner2, stake);

            const tx = await staking.acceptMigration(stakeOwner2, stake, { from: stakeOwner });

            expect(tx.logs).to.have.length(2); // Two events for the double stake.
            expectEvent.inLogs(tx.logs, EVENTS.acceptedMigration, { stakeOwner: stakeOwner2, amount: stake });
            expect(await reentrantNotifier.getCalledWith()).to.have.members([stakeOwner2, stakeOwner2]);

            // The operation will result in a double stake attribute to stakeOwner2:
            const effectiveStake = stake.mul(new BN(2));
            expect(await token.balanceOf(staking.getAddress())).to.be.bignumber.eq(effectiveStake);
            expect(await staking.getStakeBalanceOf(stakeOwner2)).to.be.bignumber.eq(effectiveStake);
          });

          context('insufficient balance for twice the stake', async () => {
            it('should stake only once', async () => {
              await token.assign(reentrantNotifier.getAddress(), stake.sub(new BN(1)));
              await reentrantNotifier.approve(staking, stake, { from: stakeOwner });
              await reentrantNotifier.setStakeData(stakeOwner2, stake);

              const tx = await staking.acceptMigration(stakeOwner2, stake, { from: stakeOwner });
              expectEvent.inLogs(tx.logs, EVENTS.acceptedMigration, { stakeOwner: stakeOwner2, amount: stake });
              expectEvent.inLogs(tx.logs, EVENTS.stakeChangeNotificationFailed,
                { notifier: reentrantNotifier.getAddress() });
              expect(await reentrantNotifier.getCalledWith()).to.be.empty();

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

          expect(await notifier.getCalledWith()).to.have.members(stakers);

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

        context('reentrant stake change notifier', async () => {
          let reentrantNotifier;
          beforeEach(async () => {
            reentrantNotifier = await ReentrantStakeChangeNotifier.new(staking, token);
            await staking.setStakeChangeNotifier(reentrantNotifier, { from: migrationManager });
          });

          it('should effectively batch stake and deduct tokens multiple times', async () => {
            const luckyStakerIndex = 9;
            const luckyStaker = stakers[luckyStakerIndex];
            const originalStake = stakes[luckyStakerIndex];
            const luckyStake = new BN(100);
            const additionalStake = luckyStake.mul(new BN(stakers.length));

            await token.assign(reentrantNotifier.getAddress(), additionalStake);
            await reentrantNotifier.approve(staking, additionalStake, { from: caller });
            await reentrantNotifier.setStakeData(luckyStaker, luckyStake);

            await staking.distributeBatchRewards(totalStake, stakers, stakes, { from: caller });

            // The notifier should have been called in this order:
            //     S[0], luckyStaker, S[1], luckyStaker, ... S[19], luckyStaker
            const zipped = stakers.reduce((res, s) => {
              res.push(s);
              res.push(luckyStaker);
              return res;
            }, []);
            expect(await reentrantNotifier.getCalledWith()).to.have.members(zipped);

            // The operation will result in an additional stake for luckyStaker (once per bathc member):
            expect(await token.balanceOf(staking.getAddress())).to.be.bignumber.eq(totalStake.add(additionalStake));
            expect(await staking.getStakeBalanceOf(luckyStaker)).to.be.bignumber.eq(originalStake.add(additionalStake));
          });

          context('insufficient balance for twice the stake', async () => {
            it('should batch stake only once', async () => {
              const luckyStakerIndex = 5;
              const luckyStaker = stakers[luckyStakerIndex];
              const originalStake = stakes[luckyStakerIndex];
              const luckyStake = new BN(100);
              const additionalStake = luckyStake.mul(new BN(stakers.length));

              await token.assign(reentrantNotifier.getAddress(), additionalStake.sub(new BN(1)));
              await reentrantNotifier.approve(staking, additionalStake, { from: caller });
              await reentrantNotifier.setStakeData(luckyStaker, luckyStake);

              await staking.distributeBatchRewards(totalStake, stakers, stakes, { from: caller });

              // The notifier should have been called in this order:
              //     S[0], luckyStaker, S[1], luckyStaker, ... S[18], luckyStaker
              const zipped = stakers.reduce((res, s) => {
                res.push(s);
                res.push(luckyStaker);
                return res;
              }, []);
              zipped.pop();
              zipped.pop();
              expect(await reentrantNotifier.getCalledWith()).to.have.members(zipped);

              // The operation will result in an additional stake for luckyStaker, but not including the last addition,
              // since the rouge notifier won't have enough tokens to accomplish it.
              const effectiveStake = additionalStake.sub(luckyStake);
              expect(await token.balanceOf(staking.getAddress())).to.be.bignumber.eq(totalStake.add(effectiveStake));
              expect(await staking.getStakeBalanceOf(luckyStaker)).to.be.bignumber
                .eq(originalStake.add(effectiveStake));
            });
          });
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

        await testStaking(staking, notifier, stakeOwner, newStake, stakeOwner);
      });

      context('with unstaked tokens', async () => {
        beforeEach(async () => {
          const unstaked = new BN(100);
          await staking.unstake(unstaked, { from: stakeOwner });
        });

        it('should allow to stake', async () => {
          const newStake = new BN(100);
          await token.assign(stakeOwner, newStake);
          await token.approve(staking.getAddress(), newStake, { from: stakeOwner });

          await testStaking(staking, notifier, stakeOwner, newStake, stakeOwner);
        });

        context('pending withdrawal', async () => {
          beforeEach(async () => {
            const unstakedStatus = await staking.getUnstakeStatus(stakeOwner);
            await time.increaseTo(unstakedStatus.cooldownEndTime.add(duration.seconds(1)));
            expect(await time.latest()).to.be.bignumber.gt(unstakedStatus.cooldownEndTime);
          });

          it('should allow to stake', async () => {
            const newStake = new BN(200);
            await token.assign(stakeOwner, newStake);
            await token.approve(staking.getAddress(), newStake, { from: stakeOwner });

            await testStaking(staking, notifier, stakeOwner, newStake, stakeOwner);
          });

          context('fully withdrawn', async () => {
            beforeEach(async () => {
              await staking.withdraw({ from: stakeOwner });
            });

            it('should allow to stake', async () => {
              const newStake = new BN(500);
              await token.assign(stakeOwner, newStake);
              await token.approve(staking.getAddress(), newStake, { from: stakeOwner });

              await testStaking(staking, notifier, stakeOwner, newStake, stakeOwner);
            });
          });
        });
      });
    });

    context.skip('stopped accepting new stake', async () => {
      it('should not allow to stake tokens', async () => {
      });
    });

    context.skip('released all stake', async () => {
      it('should not allow to stake tokens', async () => {
      });
    });
  });

  describe('unstaking', async () => {
    const testUnstaking = async (staking, notifier, stakeOwner, unstakeAmount) => {
      const getState = async () => {
        return {
          stakingBalance: await token.balanceOf(staking.getAddress()),
          stakeOwnerBalance: await token.balanceOf(stakeOwner),
          stakeOwnerStake: await staking.getStakeBalanceOf(stakeOwner),
          stakeOwnerUnstakedStatus: await staking.getUnstakeStatus(stakeOwner),
          totalStakedTokens: await staking.getTotalStakedTokens(),
        };
      };

      const prevState = await getState();

      await notifier.reset();

      const tx = await staking.unstake(unstakeAmount, { from: stakeOwner });
      expectEvent.inLogs(tx.logs, EVENTS.unstaked, { stakeOwner, amount: unstakeAmount });
      expect(await notifier.getCalledWith()).to.have.members([stakeOwner]);

      const currentState = await getState();

      const now = await time.latest();
      expect(currentState.stakingBalance).to.be.bignumber.eq(prevState.stakingBalance);
      expect(currentState.stakeOwnerBalance).to.be.bignumber.eq(prevState.stakeOwnerBalance);
      expect(currentState.stakeOwnerStake).to.be.bignumber.eq(prevState.stakeOwnerStake.sub(unstakeAmount));
      expect(currentState.stakeOwnerUnstakedStatus.cooldownAmount).to.be.bignumber
        .eq(prevState.stakeOwnerUnstakedStatus.cooldownAmount.add(unstakeAmount));
      expect(currentState.stakeOwnerUnstakedStatus.cooldownEndTime).to.be.bignumber
        .closeTo(now.add(await staking.getCooldownPeriod()), TIME_ERROR);
      expect(currentState.totalStakedTokens).to.be.bignumber.eq(prevState.totalStakedTokens.sub(unstakeAmount));
    };

    let staking;
    let notifier;
    const cooldown = duration.days(1);
    beforeEach(async () => {
      staking = await StakingContract.new(cooldown, migrationManager, emergencyManager, token);
      notifier = await StakeChangeNotifier.new();
      await staking.setStakeChangeNotifier(notifier, { from: migrationManager });
    });

    context('no stake', async () => {
      const stakeOwner = accounts[1];

      it('should not allow to unstake', async () => {
        await expectRevert(staking.unstake(new BN(1), { from: stakeOwner }),
          "StakingContract::unstake - can't unstake more than the current stake");
      });
    });

    context('with stake', async () => {
      const stake = new BN(1000);
      const stakeOwner = accounts[4];

      beforeEach(async () => {
        await token.assign(stakeOwner, stake);
        await token.approve(staking.getAddress(), stake, { from: stakeOwner });
        await staking.stake(stake, { from: stakeOwner });
        await notifier.reset();
      });

      it('should allow to partially unstake tokens', async () => {
        await testUnstaking(staking, notifier, stakeOwner, new BN(100));

        // Skip some time ahead in order to make sure that the following operation properly resets cooldown end time.
        await time.increase(duration.hours(6));

        await testUnstaking(staking, notifier, stakeOwner, new BN(500));
      });

      it('should allow to unstake all tokens', async () => {
        await testUnstaking(staking, notifier, stakeOwner, stake);
      });

      it('should not allow to unstake 0 tokens', async () => {
        await expectRevert(staking.unstake(new BN(0), { from: stakeOwner }),
          'StakingContract::unstake - amount must be greater than 0');
      });

      it('should not allow to unstake more tokens than the staker has staked', async () => {
        await expectRevert(staking.unstake(stake.add(new BN(1)), { from: stakeOwner }),
          "StakingContract::unstake - can't unstake more than the current stake");
      });

      context('pending withdrawal', async () => {
        beforeEach(async () => {
          await staking.unstake(stake.sub(new BN(100)), { from: stakeOwner });

          const unstakedStatus = await staking.getUnstakeStatus(stakeOwner);
          await time.increaseTo(unstakedStatus.cooldownEndTime.add(duration.seconds(1)));
          expect(await time.latest()).to.be.bignumber.gt(unstakedStatus.cooldownEndTime);
        });

        it('should not allow to unstake more tokens', async () => {
          await expectRevert(staking.unstake(new BN(1), { from: stakeOwner }),
            'StakingContract::unstake - unable to unstake when there are tokens pending withdrawal');
        });

        context('fully withdrawn', async () => {
          beforeEach(async () => {
            await staking.withdraw({ from: stakeOwner });
          });

          it('should allow to unstake more tokens', async () => {
            const newStake = new BN(123);
            await token.assign(stakeOwner, newStake);
            await token.approve(staking.getAddress(), newStake, { from: stakeOwner });
            await staking.stake(newStake, { from: stakeOwner });
            await notifier.reset();

            await testUnstaking(staking, notifier, stakeOwner, newStake);
          });
        });
      });

      context.skip('stopped accepting new stake', async () => {
        it('should allow to unstake tokens', async () => {
        });
      });

      context.skip('released all stake', async () => {
        it('should allow to unstake tokens', async () => {
        });
      });
    });
  });

  describe('withdrawl', async () => {
    let staking;
    let notifier;
    const cooldown = duration.days(1);
    beforeEach(async () => {
      staking = await StakingContract.new(cooldown, migrationManager, emergencyManager, token);
      notifier = await StakeChangeNotifier.new();
      await staking.setStakeChangeNotifier(notifier, { from: migrationManager });
    });

    context('no stake', async () => {
      const stakeOwner = accounts[3];

      it('should not allow to withdraw', async () => {
        await expectRevert(staking.withdraw({ from: stakeOwner }),
          'StakingContract::withdraw - no unstaked tokens');
      });
    });

    context('with stake', async () => {
      const stake = new BN(1000);
      const stakeOwner = accounts[4];

      beforeEach(async () => {
        await token.assign(stakeOwner, stake);
        await token.approve(staking.getAddress(), stake, { from: stakeOwner });
        await staking.stake(stake, { from: stakeOwner });
        await notifier.reset();
      });

      it('should not allow to withdraw', async () => {
        await expectRevert(staking.withdraw({ from: stakeOwner }),
          'StakingContract::withdraw - no unstaked tokens');
      });

      context('with unstaked stake', async () => {
        const unstaked = new BN(100);
        beforeEach(async () => {
          await staking.unstake(unstaked, { from: stakeOwner });
          await notifier.reset();
        });

        it('should not allow to withdraw', async () => {
          await expectRevert(staking.withdraw({ from: stakeOwner }),
            'StakingContract::withdraw - tokens are still in cooldown');
        });

        context('pending withdrawal', async () => {
          beforeEach(async () => {
            const unstakedStatus = await staking.getUnstakeStatus(stakeOwner);
            await time.increaseTo(unstakedStatus.cooldownEndTime.add(duration.seconds(1)));
            expect(await time.latest()).to.be.bignumber.gt(unstakedStatus.cooldownEndTime);
          });

          it('should allow to withdraw all tokens', async () => {
            const prevStakingBalance = await token.balanceOf(staking.getAddress());
            const prevStakeOwnerBalance = await token.balanceOf(stakeOwner);
            const prevTotalStakedTokens = await staking.getTotalStakedTokens();

            const tx = await staking.withdraw({ from: stakeOwner });
            expectEvent.inLogs(tx.logs, EVENTS.withdrew, { stakeOwner, amount: unstaked });
            expect(await notifier.getCalledWith()).to.have.members([stakeOwner]);

            expect(await token.balanceOf(staking.getAddress())).to.be.bignumber.eq(prevStakingBalance.sub(unstaked));
            expect(await token.balanceOf(stakeOwner)).to.be.bignumber.eq(prevStakeOwnerBalance.add(unstaked));
            expect(await staking.getTotalStakedTokens()).to.be.bignumber.eq(prevTotalStakedTokens);
            const unstakedStatus = await staking.getUnstakeStatus(stakeOwner);
            expect(unstakedStatus.cooldownAmount).to.be.bignumber.eq(new BN(0));
            expect(unstakedStatus.cooldownEndTime).to.be.bignumber.eq(new BN(0));
          });

          context('fully withdrawn', async () => {
            beforeEach(async () => {
              await staking.withdraw({ from: stakeOwner });
            });

            it('should not allow to withdraw', async () => {
              await expectRevert(staking.withdraw({ from: stakeOwner }),
                'StakingContract::withdraw - no unstaked tokens');
            });
          });

          context.skip('stopped accepting new stake', async () => {
            it('should allow to withdraw tokens', async () => {
            });
          });
        });
      });

      context.skip('released all stake', async () => {
        it('should allow to unstake tokens', async () => {
        });
      });
    });
  });

  describe('restaking', async () => {
    let staking;
    let notifier;
    const cooldown = duration.days(1);
    beforeEach(async () => {
      staking = await StakingContract.new(cooldown, migrationManager, emergencyManager, token);
      notifier = await StakeChangeNotifier.new();
      await staking.setStakeChangeNotifier(notifier, { from: migrationManager });
    });

    context('no stake', async () => {
      const stakeOwner = accounts[3];

      it('should not allow to restake', async () => {
        await expectRevert(staking.restake({ from: stakeOwner }),
          'StakingContract::restake - no unstaked tokens');
      });
    });

    context('with stake', async () => {
      const stake = new BN(1000);
      const stakeOwner = accounts[4];

      beforeEach(async () => {
        await token.assign(stakeOwner, stake);
        await token.approve(staking.getAddress(), stake, { from: stakeOwner });
        await staking.stake(stake, { from: stakeOwner });
        await notifier.reset();
      });

      it('should not allow to restake', async () => {
        await expectRevert(staking.restake({ from: stakeOwner }),
          'StakingContract::restake - no unstaked tokens');
      });

      context('with unstaked stake', async () => {
        const unstaked = new BN(100);
        beforeEach(async () => {
          await staking.unstake(unstaked, { from: stakeOwner });
          await notifier.reset();
        });

        it('should allow to restake', async () => {
          const prevStakingBalance = await token.balanceOf(staking.getAddress());
          const prevStakeOwnerBalance = await token.balanceOf(stakeOwner);
          const prevStakeOwnerStake = await staking.getStakeBalanceOf(stakeOwner);
          const prevTotalStakedTokens = await staking.getTotalStakedTokens();
          const prevUnstakedStatus = await staking.getUnstakeStatus(stakeOwner);
          expect(prevUnstakedStatus.cooldownAmount).to.be.bignumber.eq(unstaked);
          expect(prevUnstakedStatus.cooldownEndTime).to.be.bignumber.not.eq(new BN(0));

          const tx = await staking.restake({ from: stakeOwner });
          expectEvent.inLogs(tx.logs, EVENTS.restaked, { stakeOwner, amount: unstaked });
          expect(await notifier.getCalledWith()).to.have.members([stakeOwner]);

          expect(await token.balanceOf(staking.getAddress())).to.be.bignumber.eq(prevStakingBalance);
          expect(await token.balanceOf(stakeOwner)).to.be.bignumber.eq(prevStakeOwnerBalance);
          expect(await staking.getStakeBalanceOf(stakeOwner)).to.be.bignumber.eq(prevStakeOwnerStake.add(unstaked));
          expect(await staking.getTotalStakedTokens()).to.be.bignumber.eq(prevTotalStakedTokens.add(unstaked));
          const unstakedStatus = await staking.getUnstakeStatus(stakeOwner);
          expect(unstakedStatus.cooldownAmount).to.be.bignumber.eq(new BN(0));
          expect(unstakedStatus.cooldownEndTime).to.be.bignumber.eq(new BN(0));
        });

        context('pending withdrawal', async () => {
          beforeEach(async () => {
            const unstakedStatus = await staking.getUnstakeStatus(stakeOwner);
            await time.increaseTo(unstakedStatus.cooldownEndTime.add(duration.seconds(1)));
            expect(await time.latest()).to.be.bignumber.gt(unstakedStatus.cooldownEndTime);
          });

          it('should allow to restake', async () => {
            const prevStakingBalance = await token.balanceOf(staking.getAddress());
            const prevStakeOwnerBalance = await token.balanceOf(stakeOwner);
            const prevStakeOwnerStake = await staking.getStakeBalanceOf(stakeOwner);
            const prevTotalStakedTokens = await staking.getTotalStakedTokens();
            const prevUnstakedStatus = await staking.getUnstakeStatus(stakeOwner);
            expect(prevUnstakedStatus.cooldownAmount).to.be.bignumber.eq(unstaked);
            expect(prevUnstakedStatus.cooldownEndTime).to.be.bignumber.not.eq(new BN(0));

            const tx = await staking.restake({ from: stakeOwner });
            expectEvent.inLogs(tx.logs, EVENTS.restaked, { stakeOwner, amount: unstaked });
            expect(await notifier.getCalledWith()).to.have.members([stakeOwner]);

            expect(await token.balanceOf(staking.getAddress())).to.be.bignumber.eq(prevStakingBalance);
            expect(await token.balanceOf(stakeOwner)).to.be.bignumber.eq(prevStakeOwnerBalance);
            expect(await staking.getStakeBalanceOf(stakeOwner)).to.be.bignumber.eq(prevStakeOwnerStake.add(unstaked));
            expect(await staking.getTotalStakedTokens()).to.be.bignumber.eq(prevTotalStakedTokens.add(unstaked));
            const unstakedStatus = await staking.getUnstakeStatus(stakeOwner);
            expect(unstakedStatus.cooldownAmount).to.be.bignumber.eq(new BN(0));
            expect(unstakedStatus.cooldownEndTime).to.be.bignumber.eq(new BN(0));
          });

          context('fully withdrawn', async () => {
            beforeEach(async () => {
              await staking.withdraw({ from: stakeOwner });
            });

            it('should not allow to restake', async () => {
              await expectRevert(staking.restake({ from: stakeOwner }),
                'StakingContract::restake - no unstaked tokens');
            });
          });
        });

        context.skip('stopped accepting new stake', async () => {
          it('should not allow to restake', async () => {
          });
        });

        context.skip('released all stake', async () => {
          it('should not allow to restake', async () => {
          });
        });
      });
    });
  });

  describe('migration', async () => {
    const testMigration = async (staking, notifier, stakeOwner, migrationDestination, migrationNotifier) => {
      const getState = async () => {
        return {
          stakingBalance: await token.balanceOf(staking.getAddress()),
          stakeOwnerBalance: await token.balanceOf(stakeOwner),
          stakeOwnerStake: await staking.getStakeBalanceOf(stakeOwner),
          stakeOwnerUnstakedStatus: await staking.getUnstakeStatus(stakeOwner),
          totalStakedTokens: await staking.getTotalStakedTokens(),
          migrationStakingBalance: await token.balanceOf(migrationDestination.getAddress()),
          migrationStakeOwnerStake: await migrationDestination.getStakeBalanceOf(stakeOwner),
          migrationTotalStakedTokens: await migrationDestination.getTotalStakedTokens(),
          migrationUnstakedStatus: await migrationDestination.getUnstakeStatus(stakeOwner),
        };
      };

      const stake = await staking.getStakeBalanceOf(stakeOwner);
      const prevState = await getState();

      const tx = await staking.migrateStakedTokens(migrationDestination, { from: stakeOwner });
      expectEvent.inLogs(tx.logs, EVENTS.migratedStake, { stakeOwner, amount: stake });
      expect(await notifier.getCalledWith()).to.be.empty();
      expect(await migrationNotifier.getCalledWith()).to.have.members([stakeOwner]);

      const currentState = await getState();

      expect(currentState.stakingBalance).to.be.bignumber.eq(prevState.stakingBalance.sub(stake));
      expect(currentState.stakeOwnerBalance).to.be.bignumber.eq(prevState.stakeOwnerBalance);
      expect(currentState.stakeOwnerStake).to.be.bignumber.eq(prevState.stakeOwnerStake.sub(stake));
      expect(currentState.stakeOwnerUnstakedStatus.cooldownAmount).to.be.bignumber
        .eq(prevState.stakeOwnerUnstakedStatus.cooldownAmount);
      expect(currentState.stakeOwnerUnstakedStatus.cooldownEndTime).to.be.bignumber
        .eq(prevState.stakeOwnerUnstakedStatus.cooldownEndTime);
      expect(currentState.totalStakedTokens).to.be.bignumber.eq(prevState.totalStakedTokens.sub(stake));
      expect(currentState.migrationStakingBalance).to.be.bignumber.eq(prevState.migrationStakingBalance.add(stake));
      expect(currentState.migrationStakeOwnerStake).to.be.bignumber.eq(prevState.migrationStakeOwnerStake.add(stake));
      expect(currentState.migrationTotalStakedTokens).to.be.bignumber
        .eq(prevState.migrationTotalStakedTokens.add(stake));
      expect(currentState.migrationUnstakedStatus.cooldownAmount).to.be.bignumber
        .eq(prevState.migrationUnstakedStatus.cooldownAmount);
      expect(currentState.migrationUnstakedStatus.cooldownEndTime).to.be.bignumber
        .eq(prevState.migrationUnstakedStatus.cooldownEndTime);
    };

    let staking;
    let notifier;
    const cooldown = duration.days(1);
    let migrationDestinations;
    let migrationNotifiers;
    beforeEach(async () => {
      staking = await StakingContract.new(cooldown, migrationManager, emergencyManager, token);
      notifier = await StakeChangeNotifier.new();
      await staking.setStakeChangeNotifier(notifier, { from: migrationManager });

      migrationDestinations = [];
      migrationNotifiers = [];

      for (let i = 0; i < 3; ++i) {
        const migrationDestination = await StakingContract.new(cooldown, migrationManager, emergencyManager, token);
        const migrationNotifier = await StakeChangeNotifier.new();
        await migrationDestination.setStakeChangeNotifier(migrationNotifier, { from: migrationManager });
        await staking.addMigrationDestination(migrationDestination, { from: migrationManager });

        migrationDestinations.push(migrationDestination);
        migrationNotifiers.push(migrationNotifier);
      }
    });

    context('no stake', async () => {
      const stakeOwner = accounts[3];

      it('should not allow to migrate', async () => {
        const migrationDestination = migrationDestinations[0];
        await expectRevert(staking.migrateStakedTokens(migrationDestination, { from: stakeOwner }),
          'StakingContract::migrateStakedTokens - no staked tokens');
      });
    });

    context('with stake', async () => {
      const stake = new BN(1000);
      const stakeOwner = accounts[4];

      beforeEach(async () => {
        await token.assign(stakeOwner, stake);
        await token.approve(staking.getAddress(), stake, { from: stakeOwner });
        await staking.stake(stake, { from: stakeOwner });
        await notifier.reset();
      });

      it('should allow to migrate', async () => {
        await testMigration(staking, notifier, stakeOwner, migrationDestinations[0], migrationNotifiers[0]);
      });

      it('should only allow to migrate to an approved migration destination', async () => {
        const notApprovedMigrationDestination = accounts[8];
        await expectRevert(staking.migrateStakedTokens(notApprovedMigrationDestination, { from: stakeOwner }),
          "StakingContract::migrateStakedTokens - migration destination wasn't approved");

        for (let i = 0; i < migrationDestinations.length; ++i) {
          const migrationDestination = migrationDestinations[i];
          const migrationNotifier = migrationNotifiers[i];
          const tx = await staking.migrateStakedTokens(migrationDestination, { from: stakeOwner });
          expectEvent.inLogs(tx.logs, EVENTS.migratedStake, { stakeOwner, amount: stake });
          expect(await notifier.getCalledWith()).to.be.empty();
          expect(await migrationNotifier.getCalledWith()).to.have.members([stakeOwner]);

          await token.assign(stakeOwner, stake);
          await token.approve(staking.getAddress(), stake, { from: stakeOwner });
          await staking.stake(stake, { from: stakeOwner });
          await notifier.reset();
        }
      });

      it('should not allow to migrate to a staking contract with a different token', async () => {
        const token2 = await TestERC20.new();
        const migrationDestination = await StakingContract.new(cooldown, migrationManager, emergencyManager, token2);
        await staking.addMigrationDestination(migrationDestination, { from: migrationManager });

        await expectRevert(staking.migrateStakedTokens(migrationDestination, { from: stakeOwner }),
          'StakingContract::migrateStakedTokens - staked tokens must be the same');
      });

      context('with unstaked stake', async () => {
        const unstaked = new BN(100);
        beforeEach(async () => {
          await staking.unstake(unstaked, { from: stakeOwner });
          await notifier.reset();
        });

        it('should only migrate tokens not in cooldown', async () => {
          await testMigration(staking, notifier, stakeOwner, migrationDestinations[2], migrationNotifiers[2]);
        });

        context('pending withdrawal', async () => {
          beforeEach(async () => {
            const unstakedStatus = await staking.getUnstakeStatus(stakeOwner);
            await time.increaseTo(unstakedStatus.cooldownEndTime.add(duration.seconds(1)));
            expect(await time.latest()).to.be.bignumber.gt(unstakedStatus.cooldownEndTime);
          });

          it('should only migrate tokens not in cooldown', async () => {
            await testMigration(staking, notifier, stakeOwner, migrationDestinations[2], migrationNotifiers[2]);
          });

          context('fully withdrawn', async () => {
            beforeEach(async () => {
              await staking.withdraw({ from: stakeOwner });
              await notifier.reset();
            });

            it('should only migrate tokens not in cooldown', async () => {
              await testMigration(staking, notifier, stakeOwner, migrationDestinations[1], migrationNotifiers[1]);
            });
          });
        });
      });

      context.skip('stopped accepting new stake', async () => {
        it('should allow to migrate', async () => {
        });
      });

      context.skip('released all stake', async () => {
        it('should not allow to migrate', async () => {
        });
      });
    });
  });
});
