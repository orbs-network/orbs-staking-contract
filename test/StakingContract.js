import chai from 'chai';
import { BN, expectRevert, expectEvent, constants, time } from '@openzeppelin/test-helpers';
import StakingContract from './helpers/stakingContract';
import StakeChangeNotifier from './helpers/notifiers/stakeChangeNotifier';
import ReentrantStakeChangeNotifier from './helpers/notifiers/reentrantStakeChangeNotifier';

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

      expect(await staking.getCooldownPeriodInSec()).to.be.bignumber.eq(cooldown);
      expect(await staking.getStakeChangeNotifier()).to.eql(constants.ZERO_ADDRESS);
      expect(await staking.getMigrationManager()).to.eql(migrationManager);
      expect(await staking.getEmergencyManager()).to.eql(emergencyManager);
      expect(await staking.getToken()).to.eql(token.address);
      expect(await staking.getTotalStakedTokens()).to.be.bignumber.eq(new BN(0));
      expect(await staking.acceptingNewStakes()).to.be.true();
      expect(await staking.releasingAllStakes()).to.be.false();
    });
  });

  describe('setting of the migration manager', async () => {
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

    context('as a regular account', async () => {
      it('should not allow to set', async () => {
        const sender = accounts[1];
        const newMigrationManager = accounts[2];
        await expectRevert(staking.setMigrationManager(newMigrationManager, { from: sender }),
          'StakingContract: caller is not the migration manager');
      });
    });

    context('as a migration manager', async () => {
      it('should set to a new address', async () => {
        const newMigrationManager = accounts[3];
        await testSetMigrationManager(staking, migrationManager, newMigrationManager);
      });

      it('should not allow changing to 0', async () => {
        await expectRevert(staking.setMigrationManager(constants.ZERO_ADDRESS, { from: migrationManager }),
          'StakingContract::setMigrationManager - address must not be 0');
      });

      it('should not allow changing to the same address', async () => {
        await expectRevert(staking.setMigrationManager(migrationManager, { from: migrationManager }),
          'StakingContract::setMigrationManager - address must be different than the current address');
      });
    });
  });

  describe('setting of the emergency manager', async () => {
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

    context('as a regular account', async () => {
      const sender = accounts[1];

      it('should not allow to set', async () => {
        const newEmergencyManager = accounts[3];
        await expectRevert(staking.setEmergencyManager(newEmergencyManager, { from: sender }),
          'StakingContract: caller is not the emergency manager');
      });
    });

    context('as an emergency manager', async () => {
      const sender = emergencyManager;

      it('should set to a new address', async () => {
        const newEmergencyManager = accounts[3];
        await testSetEmergencyManager(staking, emergencyManager, newEmergencyManager);
      });

      it('should not allow changing to 0', async () => {
        await expectRevert(staking.setEmergencyManager(constants.ZERO_ADDRESS, { from: sender }),
          'StakingContract::setEmergencyManager - address must not be 0');
      });

      it('should not allow changing to the same address', async () => {
        await expectRevert(staking.setEmergencyManager(emergencyManager, { from: sender }),
          'StakingContract::setEmergencyManager - address must be different than the current address');
      });
    });
  });

  describe('setting of the stake change notifier', async () => {
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

    context('as a regular account', async () => {
      const sender = accounts[1];

      it('should not allow to set', async () => {
        const newNotifier = accounts[3];
        await expectRevert(staking.setStakeChangeNotifier(newNotifier, { from: sender }),
          'StakingContract: caller is not the migration manager');
      });
    });

    context('as a migration manager', async () => {
      const sender = migrationManager;

      it('should set to a new address', async () => {
        const newNotifier = accounts[3];
        await testSetStakeChangeNotifier(staking, constants.ZERO_ADDRESS, newNotifier);
      });

      context('when already set', async () => {
        const newNotifier = accounts[2];

        beforeEach(async () => {
          await staking.setStakeChangeNotifier(newNotifier, { from: sender });
        });

        it('should allow resetting to 0', async () => {
          await testSetStakeChangeNotifier(staking, newNotifier, constants.ZERO_ADDRESS);
        });

        it('should not allow changing to the same address', async () => {
          await expectRevert(staking.setStakeChangeNotifier(newNotifier, { from: sender }),
            'StakingContract::setStakeChangeNotifier - address must be different than the current address');
        });
      });
    });
  });

  describe('notifications', async () => {
    let staking;
    beforeEach(async () => {
      const cooldown = duration.minutes(5);
      staking = await StakingContract.new(cooldown, migrationManager, emergencyManager, token);
    });

    describe('stake change ', async () => {
      context('without a notifier', async () => {
        it('should succeed', async () => {
          const stakeOwner = accounts[6];
          const amount = new BN(123);
          const tx = await staking.stakeChange(stakeOwner, amount);
          expect(tx.logs).to.be.empty();
        });
      });

      context('with an EOA notifier', async () => {
        const notifier = accounts[1];
        beforeEach(async () => {
          await staking.setStakeChangeNotifier(notifier, { from: migrationManager });
        });

        it('should revert', async () => {
          const stakeOwner = accounts[5];
          const amount = new BN(123);
          await expectRevert.unspecified(staking.stakeChange(stakeOwner, amount));
        });
      });

      context('with a contract notifier', async () => {
        let notifier;
        beforeEach(async () => {
          notifier = await StakeChangeNotifier.new();
          await staking.setStakeChangeNotifier(notifier, { from: migrationManager });
        });

        it('should succeed', async () => {
          let { stakeOwners, amounts } = await notifier.getNotification();
          expect(stakeOwners).to.be.empty();
          expect(amounts).to.be.empty();

          const stakeOwner = accounts[3];
          const amount = new BN(1000);
          await staking.stakeChange(stakeOwner, amount);

          ({ stakeOwners, amounts } = await notifier.getNotification());
          expect(stakeOwners).to.eql([stakeOwner]);
          expect(amounts).to.eqlBN([amount]);
        });

        context('with a reverting notifier', async () => {
          beforeEach(async () => {
            await notifier.setRevert(true);
          });

          it('should revert', async () => {
            const { stakeOwners, amounts } = await notifier.getNotification();
            expect(stakeOwners).to.be.empty();
            expect(amounts).to.be.empty();

            const stakeOwner = accounts[3];
            const amount = new BN(123);
            await expectRevert(staking.stakeChange(stakeOwner, amount), 'StakeChangeNotifierMock: revert');
          });
        });
      });
    });

    describe('stake migration ', async () => {
      context('without a notifier', async () => {
        it('should succeed', async () => {
          const stakeOwner = accounts[6];
          const amount = new BN(123);
          const tx = await staking.stakeMigration(stakeOwner, amount);
          expect(tx.logs).to.be.empty();
        });
      });

      context('with an EOA notifier', async () => {
        const notifier = accounts[1];
        beforeEach(async () => {
          await staking.setStakeChangeNotifier(notifier, { from: migrationManager });
        });

        it('should revert', async () => {
          const stakeOwner = accounts[5];
          const amount = new BN(123);
          await expectRevert.unspecified(staking.stakeMigration(stakeOwner, amount));
        });
      });

      context('with a contract notifier', async () => {
        let notifier;
        beforeEach(async () => {
          notifier = await StakeChangeNotifier.new();
          await staking.setStakeChangeNotifier(notifier, { from: migrationManager });
        });

        it('should succeed', async () => {
          let { stakeOwners, amounts } = await notifier.getNotification();
          expect(stakeOwners).to.be.empty();
          expect(amounts).to.be.empty();

          const stakeOwner = accounts[3];
          const amount = new BN(1000);
          await staking.stakeMigration(stakeOwner, amount);

          ({ stakeOwners, amounts } = await notifier.getNotification());
          expect(stakeOwners).to.eql([stakeOwner]);
          expect(amounts).to.eqlBN([amount]);
        });

        context('with a reverting notifier', async () => {
          beforeEach(async () => {
            await notifier.setRevert(true);
          });

          it('should revert', async () => {
            const { stakeOwners, amounts } = await notifier.getNotification();
            expect(stakeOwners).to.be.empty();
            expect(amounts).to.be.empty();

            const stakeOwner = accounts[3];
            const amount = new BN(123);
            await expectRevert(staking.stakeMigration(stakeOwner, amount), 'StakeChangeNotifierMock: revert');
          });
        });
      });
    });
  });

  describe('adding/removal of migration destinations', async () => {
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

    context('as a regular account', async () => {
      const sender = accounts[1];
      const destination = migrationDestinations[0];

      it('should not allow adding a new contract', async () => {
        await expectRevert(staking.addMigrationDestination(destination, { from: sender }),
          'StakingContract: caller is not the migration manager');
      });

      it('should not allow removing of any contract', async () => {
        await expectRevert(staking.addMigrationDestination(destination, { from: sender }),
          'StakingContract: caller is not the migration manager');
      });
    });

    context('as a migration manager', async () => {
      const sender = migrationManager;

      it('should add new staking contracts', async () => {
        for (const destination of migrationDestinations) {
          await testAddMigrationDestination(staking, destination);
        }

        expect(await staking.getApprovedStakingContracts()).to.eql(migrationDestinations);
      });

      it('should not allow adding a 0 address', async () => {
        await expectRevert(staking.addMigrationDestination(constants.ZERO_ADDRESS, { from: sender }),
          'StakingContract::addMigrationDestination - address must not be 0');
      });

      it('should not allow adding a duplicate contract', async () => {
        const destination = migrationDestinations[0];

        await staking.addMigrationDestination(destination, { from: sender });
        await expectRevert(staking.addMigrationDestination(destination, { from: sender }),
          "StakingContract::addMigrationDestination - can't add a duplicate staking contract");
      });

      it(`should not allow adding more than ${MAX_APPROVED_STAKING_CONTRACTS} contracts`, async () => {
        for (const destination of migrationDestinations) {
          await staking.addMigrationDestination(destination, { from: sender });
        }

        expect(await staking.getApprovedStakingContracts()).to.have.lengthOf(MAX_APPROVED_STAKING_CONTRACTS);

        await expectRevert(staking.addMigrationDestination(accounts[20], { from: sender }),
          "StakingContract::addMigrationDestination - can't add more staking contracts");
      });

      it('should not allow adding again a previously removed contract', async () => {
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

      it('should not allow adding a 0 address', async () => {
        await expectRevert(staking.removeMigrationDestination(constants.ZERO_ADDRESS, { from: sender }),
          'StakingContract::removeMigrationDestination - address must not be 0');
      });

      it('should revert when trying to remove a non-existing contract', async () => {
        const destination = migrationDestinations[0];
        await staking.addMigrationDestination(destination, { from: sender });
        expect(await staking.getApprovedStakingContracts()).to.eql([destination]);

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
      const totalStakedAmount = prevState.stakeOwnerStake.add(stake);

      await notifier.reset();

      if (from === stakeOwner) {
        const tx = await staking.stake(stake, { from });
        expectEvent.inLogs(tx.logs, EVENTS.staked, { stakeOwner, amount: stake, totalStakedAmount });
      } else {
        const tx = await staking.acceptMigration(stakeOwner, stake, { from });
        expectEvent.inLogs(tx.logs, EVENTS.acceptedMigration, { stakeOwner, amount: stake, totalStakedAmount });
      }

      const { stakeOwners, amounts } = await notifier.getNotification();
      expect(stakeOwners).to.eql([stakeOwner]);
      expect(amounts).to.eqlBN([stake]);

      const currentState = await getState();

      expect(currentState.stakingBalance).to.be.bignumber.eq(prevState.stakingBalance.add(stake));
      expect(currentState.fromBalance).to.be.bignumber.eq(prevState.fromBalance.sub(stake));
      expect(currentState.stakeOwnerStake).to.be.bignumber.eq(totalStakedAmount);
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

    context('without a stake', async () => {
      it('should allow staking', async () => {
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

      describe('accepting migration', async () => {
        const stake = new BN(12345);
        const stakeOwner = accounts[2];
        const stakeOwner2 = accounts[5];

        beforeEach(async () => {
          await token.assign(stakeOwner, stake);
          await token.approve(staking.getAddress(), stake.add(new BN(1000)), { from: stakeOwner });
        });

        it('should allow staking on behalf of a different staker', async () => {
          await testStaking(staking, notifier, stakeOwner2, stake, stakeOwner);
        });

        it('should not allow staking more tokens than the staker has', async () => {
          await token.approve(staking.getAddress(), stake.add(new BN(1000)), { from: stakeOwner });

          await expectRevert.unspecified(staking.acceptMigration(stakeOwner2, stake.add(new BN(1)),
            { from: stakeOwner }));
        });

        it('should not allow staking 0 tokens', async () => {
          await expectRevert(staking.acceptMigration(stakeOwner2, new BN(0), { from: stakeOwner }),
            'StakingContract::stake - amount must be greater than 0');
        });

        it('should not allow staking more tokens than the staker has on behalf of a different staker', async () => {
          await expectRevert.unspecified(staking.acceptMigration(stakeOwner2, stake.add(new BN(1)),
            { from: stakeOwner }));
        });

        it('should not allow staking on behalf of a 0 address', async () => {
          await expectRevert(staking.acceptMigration(constants.ZERO_ADDRESS, stake, { from: stakeOwner }),
            "StakingContract::stake - stake owner can't be 0");
        });

        context('with a reentrant notifier', async () => {
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
            expectEvent.inLogs(tx.logs, EVENTS.acceptedMigration, {
              stakeOwner: stakeOwner2,
              amount: stake,
              totalStakedAmount: stake,
            });

            const { stakeOwners, amounts } = await reentrantNotifier.getNotification();
            expect(stakeOwners).to.eql([stakeOwner2, stakeOwner2]);
            expect(amounts).to.eqlBN([stake, stake]);

            // The operation will result in a double stake attribute to stakeOwner2:
            const effectiveStake = stake.mul(new BN(2));
            expect(await token.balanceOf(staking.getAddress())).to.be.bignumber.eq(effectiveStake);
            expect(await staking.getStakeBalanceOf(stakeOwner2)).to.be.bignumber.eq(effectiveStake);
          });

          context('with an insufficient token balance', async () => {
            it('should revert', async () => {
              await token.assign(reentrantNotifier.getAddress(), stake.sub(new BN(1)));
              await reentrantNotifier.approve(staking, stake, { from: stakeOwner });
              await reentrantNotifier.setStakeData(stakeOwner2, stake);

              await expectRevert(staking.acceptMigration(stakeOwner2, stake, { from: stakeOwner }),
                'SafeMath: subtraction overflow');

              expect(await token.balanceOf(staking.getAddress())).to.be.bignumber.eq(new BN(0));
              expect(await staking.getStakeBalanceOf(stakeOwner2)).to.be.bignumber.eq(new BN(0));
            });
          });
        });
      });

      describe('distributing rewards', async () => {
        const stakers = accounts.slice(1, 21);
        const stakes = [
          new BN(3134), new BN(5052), new BN(1445), new BN(6102), new BN(4667),
          new BN(3522), new BN(2103), new BN(3018), new BN(6111), new BN(3070),
          new BN(2481), new BN(5000), new BN(6105), new BN(5475), new BN(2249),
          new BN(7615), new BN(3087), new BN(1501), new BN(620), new BN(7198),
        ];
        const totalStake = stakes.reduce((sum, s) => sum.add(s), new BN(0));
        const caller = accounts[0];

        beforeEach(async () => {
          const callerBalance = totalStake.mul(new BN(2));
          await token.assign(caller, callerBalance);
          await token.approve(staking.getAddress(), callerBalance, { from: caller });
        });

        it('should allow staking on behalf of different stakers in batch', async () => {
          const callerBalance = await token.balanceOf(caller);

          const tx = await staking.distributeRewards(totalStake, stakers, stakes, { from: caller });

          const { stakeOwners, amounts } = await notifier.getNotification();
          expect(stakeOwners).to.eql(stakers);
          expect(amounts).to.eqlBN(stakes);

          for (let i = 0; i < stakers.length; ++i) {
            const stakeOwner = stakers[i];
            const stake = stakes[i];

            expectEvent.inLogs(tx.logs, EVENTS.staked, { stakeOwner, amount: stake, totalStakedAmount: stake });

            expect(await token.balanceOf(stakeOwner)).to.be.bignumber.eq(new BN(0));
            expect(await staking.getStakeBalanceOf(stakeOwner)).to.be.bignumber.eq(stake);
          }

          expect(await token.balanceOf(caller)).to.be.bignumber.eq(callerBalance.sub(totalStake));
          expect(await token.balanceOf(staking.getAddress())).to.be.bignumber.eq(totalStake);
          expect(await staking.getTotalStakedTokens()).to.be.bignumber.eq(totalStake);
        });

        it('should fail batch staking if token balance is insufficient', async () => {
          await token.assign(caller, totalStake.sub(new BN(1)));
          await expectRevert.unspecified(staking.distributeRewards(totalStake, stakers, stakes, { from: caller }));
        });

        it('should fail batch staking if total batch amount is incorrect', async () => {
          await expectRevert(staking.distributeRewards(totalStake.add(new BN(1)), stakers, stakes,
            { from: caller }), 'StakingContract::distributeRewards - incorrect total amount');
          await expectRevert(staking.distributeRewards(totalStake.sub(new BN(1)), stakers, stakes,
            { from: caller }), 'StakingContract::distributeRewards - incorrect total amount');
        });

        it('should fail batch staking if stake owners and amounts lists are in different sizes', async () => {
          await expectRevert(staking.distributeRewards(totalStake, stakers.slice(1), stakes,
            { from: caller }), 'StakingContract::distributeRewards - lists must be of the same size');
          await expectRevert(staking.distributeRewards(totalStake.sub(stakes[0]), stakers, stakes.slice(1),
            { from: caller }), 'StakingContract::distributeRewards - lists must be of the same size');
        });

        it('should fail batch staking if total token amount is 0', async () => {
          await expectRevert(staking.distributeRewards(new BN(0), stakers, stakes, { from: caller }),
            'StakingContract::distributeRewards - total amount must be greater than 0');
        });

        it('should fail batch staking if one of the stake owners is a 0 address', async () => {
          const stakers2 = stakers.slice(0);
          stakers2[5] = constants.ZERO_ADDRESS;
          await expectRevert(staking.distributeRewards(totalStake, stakers2, stakes, { from: caller }),
            "StakingContract::distributeRewards - stake owner can't be 0");
        });

        it('should fail batch staking if one of the stake amounts is a 0', async () => {
          const stakes2 = stakes.slice(0);
          stakes2[5] = new BN(0);
          await expectRevert(staking.distributeRewards(totalStake, stakers, stakes2, { from: caller }),
            'StakingContract::distributeRewards - amount must be greater than 0');
        });

        it('should fail batch staking if called with empty lists', async () => {
          await expectRevert(staking.distributeRewards(totalStake, [], [], { from: caller }),
            "StakingContract::distributeRewards - lists can't be empty");
        });

        it('should fail batch staking if unable to transfer', async () => {
          await token.setFailTransfer(true);

          await expectRevert(staking.distributeRewards(totalStake, stakers, stakes, { from: caller }),
            'StakingContract::distributeRewards - insufficient allowance');
        });

        context('with a reentrant notifier', async () => {
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

            await staking.distributeRewards(totalStake, stakers, stakes, { from: caller });

            // The notifier should have been called in this order:
            //     S[0], luckyStaker, S[1], luckyStaker, ... S[19], luckyStaker
            const zippedStakers = stakers.reduce((res, s) => {
              res.push(s);
              res.push(luckyStaker);
              return res;
            }, []);
            const zippedStakes = stakes.reduce((res, s) => {
              res.push(s);
              res.push(luckyStake);
              return res;
            }, []);

            const { stakeOwners, amounts } = await reentrantNotifier.getNotification();
            expect(stakeOwners).to.eql(zippedStakers);
            expect(amounts).to.eqlBN(zippedStakes);

            // The operation will result in an additional stake for luckyStaker (once per bathc member):
            expect(await token.balanceOf(staking.getAddress())).to.be.bignumber.eq(totalStake.add(additionalStake));
            expect(await staking.getStakeBalanceOf(luckyStaker)).to.be.bignumber.eq(originalStake.add(additionalStake));
          });

          context('with an insufficient token balance', async () => {
            it('should revert', async () => {
              const luckyStakerIndex = 5;
              const luckyStaker = stakers[luckyStakerIndex];
              const luckyStake = new BN(100);
              const additionalStake = luckyStake.mul(new BN(stakers.length));

              await token.assign(reentrantNotifier.getAddress(), additionalStake.sub(new BN(1)));
              await reentrantNotifier.approve(staking, additionalStake, { from: caller });
              await reentrantNotifier.setStakeData(luckyStaker, luckyStake);

              await expectRevert.unspecified(staking.distributeRewards(totalStake, stakers, stakes, { from: caller }));
            });
          });
        });
      });
    });

    context('with a stake', async () => {
      const stake = new BN(1000);
      const stakeOwner = accounts[4];

      beforeEach(async () => {
        await token.assign(stakeOwner, stake);
        await token.approve(staking.getAddress(), stake, { from: stakeOwner });
        await staking.stake(stake, { from: stakeOwner });
      });

      it('should allow staking more tokens', async () => {
        const newStake = new BN(100);
        await token.assign(stakeOwner, newStake);
        await token.approve(staking.getAddress(), newStake, { from: stakeOwner });

        await testStaking(staking, notifier, stakeOwner, newStake, stakeOwner);
      });

      context('with unstaked tokens', async () => {
        const unstakeAmount = new BN(100);
        beforeEach(async () => {
          await staking.unstake(unstakeAmount, { from: stakeOwner });
        });

        it('should allow staking', async () => {
          const newStake = new BN(100);
          await token.assign(stakeOwner, newStake);
          await token.approve(staking.getAddress(), newStake, { from: stakeOwner });

          await testStaking(staking, notifier, stakeOwner, newStake, stakeOwner);
        });

        context('with pending withdrawal', async () => {
          beforeEach(async () => {
            const unstakedStatus = await staking.getUnstakeStatus(stakeOwner);
            await time.increaseTo(unstakedStatus.cooldownEndTime.add(duration.seconds(1)));
            expect(await time.latest()).to.be.bignumber.gt(unstakedStatus.cooldownEndTime);
          });

          it('should allow staking', async () => {
            const newStake = new BN(200);
            await token.assign(stakeOwner, newStake);
            await token.approve(staking.getAddress(), newStake, { from: stakeOwner });

            await testStaking(staking, notifier, stakeOwner, newStake, stakeOwner);
          });

          context('after full withdrawal', async () => {
            beforeEach(async () => {
              await staking.withdraw({ from: stakeOwner });
            });

            it('should allow staking', async () => {
              const newStake = new BN(500);
              await token.assign(stakeOwner, newStake);
              await token.approve(staking.getAddress(), newStake, { from: stakeOwner });

              await testStaking(staking, notifier, stakeOwner, newStake, stakeOwner);
            });
          });
        });
      });
    });

    const testNotAllowStake = (msg) => {
      it('should not allow staking tokens', async () => {
        const stakeOwner = accounts[4];
        const stake = new BN(500);
        await token.assign(stakeOwner, stake);
        await token.approve(staking.getAddress(), stake, { from: stakeOwner });

        await expectRevert(staking.stake(stake, { from: stakeOwner }), msg);
      });

      it('should not allow staking tokens on behalf of a different staker', async () => {
        const stakeOwner = accounts[4];
        const stakeOwner2 = accounts[5];
        const stake = new BN(500);
        await token.assign(stakeOwner, stake);
        await token.approve(staking.getAddress(), stake, { from: stakeOwner });

        await expectRevert(staking.acceptMigration(stakeOwner2, stake, { from: stakeOwner }), msg);
      });

      it('should not allow staking on behalf of different stakers in batch', async () => {
        const stakers = accounts.slice(0, 3);
        const stakes = [new BN(100), new BN(1000), new BN(1000)];
        const totalStake = stakes.reduce((sum, s) => sum.add(s), new BN(0));
        const caller = accounts[0];

        await token.assign(caller, totalStake);
        await token.approve(staking.getAddress(), totalStake, { from: caller });

        await expectRevert(staking.distributeRewards(totalStake, stakers, stakes, { from: caller }), msg);
      });
    };

    context('when stopped accepting new stake', async () => {
      beforeEach(async () => {
        await staking.stopAcceptingNewStakes({ from: emergencyManager });
      });

      testNotAllowStake('StakingContract: not accepting new stakes');
    });

    context('when released all stake', async () => {
      beforeEach(async () => {
        await staking.releaseAllStakes({ from: emergencyManager });
      });

      testNotAllowStake('StakingContract: not accepting new stakes');
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
      const totalStakedAmount = prevState.stakeOwnerStake.sub(unstakeAmount);

      await notifier.reset();

      const tx = await staking.unstake(unstakeAmount, { from: stakeOwner });
      expectEvent.inLogs(tx.logs, EVENTS.unstaked, { stakeOwner, amount: unstakeAmount, totalStakedAmount });

      const { stakeOwners, amounts } = await notifier.getNotification();
      expect(stakeOwners).to.eql([stakeOwner]);
      expect(amounts).to.eqlBN([unstakeAmount.neg()]);

      const currentState = await getState();

      const now = await time.latest();
      expect(currentState.stakingBalance).to.be.bignumber.eq(prevState.stakingBalance);
      expect(currentState.stakeOwnerBalance).to.be.bignumber.eq(prevState.stakeOwnerBalance);
      expect(currentState.stakeOwnerStake).to.be.bignumber.eq(totalStakedAmount);
      expect(currentState.stakeOwnerUnstakedStatus.cooldownAmount).to.be.bignumber
        .eq(prevState.stakeOwnerUnstakedStatus.cooldownAmount.add(unstakeAmount));
      expect(currentState.stakeOwnerUnstakedStatus.cooldownEndTime).to.be.bignumber
        .closeTo(now.add(await staking.getCooldownPeriodInSec()), TIME_ERROR);
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

    context('without a stake', async () => {
      const stakeOwner = accounts[1];

      it('should not allow unstaking', async () => {
        await expectRevert(staking.unstake(new BN(1), { from: stakeOwner }),
          "StakingContract::unstake - can't unstake more than the current stake");
      });
    });

    context('with a stake', async () => {
      const stake = new BN(1000);
      const stakeOwner = accounts[4];

      beforeEach(async () => {
        await token.assign(stakeOwner, stake);
        await token.approve(staking.getAddress(), stake, { from: stakeOwner });
        await staking.stake(stake, { from: stakeOwner });
        await notifier.reset();
      });

      it('should allow partially unstaking of tokens', async () => {
        await testUnstaking(staking, notifier, stakeOwner, new BN(100));

        // Skip some time ahead in order to make sure that the following operation properly resets cooldown end time.
        await time.increase(duration.hours(6));

        await testUnstaking(staking, notifier, stakeOwner, new BN(500));
      });

      it('should allow unstaking of all tokens', async () => {
        await testUnstaking(staking, notifier, stakeOwner, stake);
      });

      it('should not allow unstaking of 0 tokens', async () => {
        await expectRevert(staking.unstake(new BN(0), { from: stakeOwner }),
          'StakingContract::unstake - amount must be greater than 0');
      });

      it('should not allow unstaking more tokens than the staker has staked', async () => {
        await expectRevert(staking.unstake(stake.add(new BN(1)), { from: stakeOwner }),
          "StakingContract::unstake - can't unstake more than the current stake");
      });

      context('with a pending withdrawal', async () => {
        const unstakeAmount = stake.sub(new BN(100));
        beforeEach(async () => {
          await staking.unstake(unstakeAmount, { from: stakeOwner });

          const unstakedStatus = await staking.getUnstakeStatus(stakeOwner);
          await time.increaseTo(unstakedStatus.cooldownEndTime.add(duration.seconds(1)));
          expect(await time.latest()).to.be.bignumber.gt(unstakedStatus.cooldownEndTime);
        });

        it('should not allow unstaking of more tokens', async () => {
          await expectRevert(staking.unstake(new BN(1), { from: stakeOwner }),
            'StakingContract::unstake - unable to unstake when there are tokens pending withdrawal');
        });

        context('after a full withdrawal', async () => {
          beforeEach(async () => {
            await staking.withdraw({ from: stakeOwner });
          });

          it('should allow unstaking of more tokens', async () => {
            const newStake = new BN(123);
            await token.assign(stakeOwner, newStake);
            await token.approve(staking.getAddress(), newStake, { from: stakeOwner });
            await staking.stake(newStake, { from: stakeOwner });
            await notifier.reset();

            await testUnstaking(staking, notifier, stakeOwner, newStake);
          });
        });
      });

      context('when stopped accepting new stake', async () => {
        beforeEach(async () => {
          await staking.stopAcceptingNewStakes({ from: emergencyManager });
        });

        it('should allow unstaking', async () => {
          await testUnstaking(staking, notifier, stakeOwner, stake);
        });
      });

      context('when released all stake', async () => {
        beforeEach(async () => {
          await staking.releaseAllStakes({ from: emergencyManager });
        });

        it('should allow unstaking', async () => {
          await testUnstaking(staking, notifier, stakeOwner, stake);
        });
      });
    });
  });

  describe('withdrawal', async () => {
    const testWithdrawal = async (staking, notifier, stakeOwner) => {
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

      let withdrawnAmount = prevState.stakeOwnerUnstakedStatus.cooldownAmount;
      let totalStakedAmount = prevState.stakeOwnerStake;
      let newtotalStakedTokens = prevState.totalStakedTokens;
      let stakedAmountDiff = new BN(0);
      if (await staking.releasingAllStakes()) {
        withdrawnAmount = withdrawnAmount.add(prevState.stakeOwnerStake);
        totalStakedAmount = totalStakedAmount.sub(prevState.stakeOwnerStake);
        newtotalStakedTokens = newtotalStakedTokens.sub(prevState.stakeOwnerStake);
        stakedAmountDiff = withdrawnAmount.neg();
      }

      const tx = await staking.withdraw({ from: stakeOwner });
      expectEvent.inLogs(tx.logs, EVENTS.withdrew, { stakeOwner, amount: withdrawnAmount, totalStakedAmount });

      const { stakeOwners, amounts } = await notifier.getNotification();
      expect(stakeOwners).to.eql([stakeOwner]);
      expect(amounts).to.eqlBN([stakedAmountDiff]);

      const currentState = await getState();

      expect(currentState.stakingBalance).to.be.bignumber.eq(prevState.stakingBalance.sub(withdrawnAmount));
      expect(currentState.stakeOwnerBalance).to.be.bignumber.eq(prevState.stakeOwnerBalance.add(withdrawnAmount));
      expect(currentState.stakeOwnerStake).to.be.bignumber.eq(totalStakedAmount);
      expect(currentState.stakeOwnerUnstakedStatus.cooldownAmount).to.be.bignumber.eq(new BN(0));
      expect(currentState.stakeOwnerUnstakedStatus.cooldownEndTime).to.be.bignumber.eq(new BN(0));
      expect(currentState.totalStakedTokens).to.be.bignumber.eq(newtotalStakedTokens);
    };

    let staking;
    let notifier;
    const cooldown = duration.days(1);
    beforeEach(async () => {
      staking = await StakingContract.new(cooldown, migrationManager, emergencyManager, token);
      notifier = await StakeChangeNotifier.new();
      await staking.setStakeChangeNotifier(notifier, { from: migrationManager });
    });

    context('without a stake', async () => {
      const stakeOwner = accounts[3];

      it('should not allow withdrawal', async () => {
        await expectRevert(staking.withdraw({ from: stakeOwner }),
          'StakingContract::withdraw - no unstaked tokens');
      });

      context('when released all stake', async () => {
        beforeEach(async () => {
          await staking.releaseAllStakes({ from: emergencyManager });
        });

        it('should not allow withdrawal', async () => {
          await expectRevert(staking.withdraw({ from: stakeOwner }),
            'StakingContract::withdraw - no staked or unstaked tokens');
        });
      });
    });

    context('with a stake', async () => {
      const stake = new BN(1000);
      const stakeOwner = accounts[4];

      beforeEach(async () => {
        await token.assign(stakeOwner, stake);
        await token.approve(staking.getAddress(), stake, { from: stakeOwner });
        await staking.stake(stake, { from: stakeOwner });
        await notifier.reset();
      });

      it('should not allow withdrawal', async () => {
        await expectRevert(staking.withdraw({ from: stakeOwner }),
          'StakingContract::withdraw - no unstaked tokens');
      });

      context('with an unstaked stake', async () => {
        const unstakeAmount = new BN(100);
        beforeEach(async () => {
          await staking.unstake(unstakeAmount, { from: stakeOwner });
          await notifier.reset();
        });

        it('should not allow withdrawal', async () => {
          await expectRevert(staking.withdraw({ from: stakeOwner }),
            'StakingContract::withdraw - tokens are still in cooldown');
        });

        context('with a pending withdrawal', async () => {
          beforeEach(async () => {
            const unstakedStatus = await staking.getUnstakeStatus(stakeOwner);
            await time.increaseTo(unstakedStatus.cooldownEndTime.add(duration.seconds(1)));
            expect(await time.latest()).to.be.bignumber.gt(unstakedStatus.cooldownEndTime);
          });

          it('should allow withdrawal of all unstaked tokens', async () => {
            await testWithdrawal(staking, notifier, stakeOwner);
          });

          it('should not allow withdrawal if unable to transfer', async () => {
            await token.setFailTransfer(true);

            await expectRevert(staking.withdraw({ from: stakeOwner }),
              "StakingContract::withdraw - couldn't transfer stake");
          });

          context('after full withdrawal', async () => {
            beforeEach(async () => {
              await staking.withdraw({ from: stakeOwner });
            });

            it('should not allow withdrawal', async () => {
              await expectRevert(staking.withdraw({ from: stakeOwner }),
                'StakingContract::withdraw - no unstaked tokens');
            });
          });

          context('when stopped accepting new stake', async () => {
            beforeEach(async () => {
              await staking.stopAcceptingNewStakes({ from: emergencyManager });
            });

            it('should allow withdrawal', async () => {
              await testWithdrawal(staking, notifier, stakeOwner);
            });
          });
        });
      });

      context('when released all stake', async () => {
        beforeEach(async () => {
          await staking.releaseAllStakes({ from: emergencyManager });
        });

        it('should allow withdrawal of all unstaked tokens', async () => {
          await testWithdrawal(staking, notifier, stakeOwner);
        });
      });
    });
  });

  describe('restaking', async () => {
    const testRestaking = async (staking, notifier, stakeOwner) => {
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
      const unstakedAmount = prevState.stakeOwnerUnstakedStatus.cooldownAmount;
      const totalStakedAmount = prevState.stakeOwnerStake.add(unstakedAmount);

      await notifier.reset();

      const tx = await staking.restake({ from: stakeOwner });
      expectEvent.inLogs(tx.logs, EVENTS.restaked, { stakeOwner, amount: unstakedAmount, totalStakedAmount });

      const { stakeOwners, amounts } = await notifier.getNotification();
      expect(stakeOwners).to.eql([stakeOwner]);
      expect(amounts).to.eqlBN([unstakedAmount]);

      const currentState = await getState();

      expect(currentState.stakingBalance).to.be.bignumber.eq(prevState.stakingBalance);
      expect(currentState.stakeOwnerBalance).to.be.bignumber.eq(prevState.stakeOwnerBalance);
      expect(currentState.stakeOwnerStake).to.be.bignumber.eq(totalStakedAmount);
      expect(currentState.stakeOwnerUnstakedStatus.cooldownAmount).to.be.bignumber.eq(new BN(0));
      expect(currentState.stakeOwnerUnstakedStatus.cooldownEndTime).to.be.bignumber.eq(new BN(0));
      expect(currentState.totalStakedTokens).to.be.bignumber.eq(prevState.totalStakedTokens.add(unstakedAmount));
    };

    let staking;
    let notifier;
    const cooldown = duration.days(1);
    beforeEach(async () => {
      staking = await StakingContract.new(cooldown, migrationManager, emergencyManager, token);
      notifier = await StakeChangeNotifier.new();
      await staking.setStakeChangeNotifier(notifier, { from: migrationManager });
    });

    context('without a stake', async () => {
      const stakeOwner = accounts[3];

      it('should not allow restaking', async () => {
        await expectRevert(staking.restake({ from: stakeOwner }),
          'StakingContract::restake - no unstaked tokens');
      });
    });

    context('with a stake', async () => {
      const stake = new BN(1000);
      const stakeOwner = accounts[4];

      beforeEach(async () => {
        await token.assign(stakeOwner, stake);
        await token.approve(staking.getAddress(), stake, { from: stakeOwner });
        await staking.stake(stake, { from: stakeOwner });
        await notifier.reset();
      });

      it('should not allow restaking', async () => {
        await expectRevert(staking.restake({ from: stakeOwner }),
          'StakingContract::restake - no unstaked tokens');
      });

      context('with an unstaked stake', async () => {
        const unstakeAmount = new BN(100);
        beforeEach(async () => {
          await staking.unstake(unstakeAmount, { from: stakeOwner });
          await notifier.reset();
        });

        it('should allow restaking', async () => {
          await testRestaking(staking, notifier, stakeOwner);
        });

        context('pending withdrawal', async () => {
          beforeEach(async () => {
            const unstakedStatus = await staking.getUnstakeStatus(stakeOwner);
            await time.increaseTo(unstakedStatus.cooldownEndTime.add(duration.seconds(1)));
            expect(await time.latest()).to.be.bignumber.gt(unstakedStatus.cooldownEndTime);
          });

          it('should allow restaking', async () => {
            await testRestaking(staking, notifier, stakeOwner);
          });

          context('fully withdrawn', async () => {
            beforeEach(async () => {
              await staking.withdraw({ from: stakeOwner });
            });

            it('should not allow restaking', async () => {
              await expectRevert(staking.restake({ from: stakeOwner }),
                'StakingContract::restake - no unstaked tokens');
            });
          });
        });

        context('stopped accepting new stake', async () => {
          beforeEach(async () => {
            await staking.stopAcceptingNewStakes({ from: emergencyManager });
          });

          it('should not allow restaking', async () => {
            await expectRevert(staking.restake({ from: stakeOwner }),
              'StakingContract: not accepting new stakes');
          });
        });

        context('released all stake', async () => {
          beforeEach(async () => {
            await staking.releaseAllStakes({ from: emergencyManager });
          });

          it('should not allow restaking', async () => {
            await expectRevert(staking.restake({ from: stakeOwner }),
              'StakingContract: not accepting new stakes');
          });
        });
      });
    });
  });

  describe('migration to new staking contracts', async () => {
    const testMigration = async (staking, notifier, stakeOwner, amount, migrationDestination, migrationNotifier) => {
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

      const prevState = await getState();
      const totalStakedAmount = prevState.stakeOwnerStake.sub(amount);

      const tx = await staking.migrateStakedTokens(migrationDestination, amount, { from: stakeOwner });
      expectEvent.inLogs(tx.logs, EVENTS.migratedStake, { stakeOwner, amount, totalStakedAmount });

      let { stakeOwners, amounts } = await notifier.getNotification();
      expect(stakeOwners).to.eql([stakeOwner]);
      expect(amounts).to.eqlBN([amount]);

      ({ stakeOwners, amounts } = await migrationNotifier.getNotification());
      expect(stakeOwners).to.eql([stakeOwner]);
      expect(amounts).to.eqlBN([amount]);

      const currentState = await getState();

      expect(currentState.stakingBalance).to.be.bignumber.eq(prevState.stakingBalance.sub(amount));
      expect(currentState.stakeOwnerBalance).to.be.bignumber.eq(prevState.stakeOwnerBalance);
      expect(currentState.stakeOwnerStake).to.be.bignumber.eq(totalStakedAmount);
      expect(currentState.stakeOwnerUnstakedStatus.cooldownAmount).to.be.bignumber
        .eq(prevState.stakeOwnerUnstakedStatus.cooldownAmount);
      expect(currentState.stakeOwnerUnstakedStatus.cooldownEndTime).to.be.bignumber
        .eq(prevState.stakeOwnerUnstakedStatus.cooldownEndTime);
      expect(currentState.totalStakedTokens).to.be.bignumber.eq(prevState.totalStakedTokens.sub(amount));
      expect(currentState.migrationStakingBalance).to.be.bignumber.eq(prevState.migrationStakingBalance.add(amount));
      expect(currentState.migrationStakeOwnerStake).to.be.bignumber.eq(prevState.migrationStakeOwnerStake.add(amount));
      expect(currentState.migrationTotalStakedTokens).to.be.bignumber
        .eq(prevState.migrationTotalStakedTokens.add(amount));
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

    context('without a stake', async () => {
      const stakeOwner = accounts[3];

      it('should not allow migration', async () => {
        const migrationDestination = migrationDestinations[0];
        await expectRevert(staking.migrateStakedTokens(migrationDestination, new BN(1), { from: stakeOwner }),
          'StakingContract::migrateStakedTokens - no staked tokens');
      });
    });

    context('with a stake', async () => {
      const stake = new BN(1000);
      const stakeOwner = accounts[4];

      beforeEach(async () => {
        await token.assign(stakeOwner, stake);
        await token.approve(staking.getAddress(), stake, { from: stakeOwner });
        await staking.stake(stake, { from: stakeOwner });
        await notifier.reset();
      });

      it('should allow migration', async () => {
        await testMigration(staking, notifier, stakeOwner, stake, migrationDestinations[0], migrationNotifiers[0]);
      });

      it('should allow partial migration', async () => {
        const remainder = new BN(100);
        await testMigration(staking, notifier, stakeOwner, stake.sub(remainder), migrationDestinations[0],
          migrationNotifiers[0]);
        await notifier.reset();
        await testMigration(staking, notifier, stakeOwner, remainder, migrationDestinations[1],
          migrationNotifiers[1]);
      });

      it('should only allow migration to an approved migration destination', async () => {
        const notApprovedMigrationDestination = accounts[8];
        await expectRevert(staking.migrateStakedTokens(notApprovedMigrationDestination, new BN(1),
          { from: stakeOwner }), "StakingContract::migrateStakedTokens - migration destination wasn't approved");

        for (let i = 0; i < migrationDestinations.length; ++i) {
          const migrationDestination = migrationDestinations[i];
          const migrationNotifier = migrationNotifiers[i];
          const tx = await staking.migrateStakedTokens(migrationDestination, stake, { from: stakeOwner });
          expectEvent.inLogs(tx.logs, EVENTS.migratedStake, {
            stakeOwner, amount: stake, totalStakedAmount: new BN(0),
          });

          let { stakeOwners, amounts } = await notifier.getNotification();
          expect(stakeOwners).to.eql([stakeOwner]);
          expect(amounts).to.eqlBN([stake]);

          ({ stakeOwners, amounts } = await migrationNotifier.getNotification());
          expect(stakeOwners).to.eql([stakeOwner]);
          expect(amounts).to.eqlBN([stake]);

          await token.assign(stakeOwner, stake);
          await token.approve(staking.getAddress(), stake, { from: stakeOwner });
          await staking.stake(stake, { from: stakeOwner });
          await notifier.reset();
        }
      });

      it('should not allow migration to a staking contract with a different token', async () => {
        const token2 = await TestERC20.new();
        const migrationDestination = await StakingContract.new(cooldown, migrationManager, emergencyManager, token2);
        await staking.addMigrationDestination(migrationDestination, { from: migrationManager });

        await expectRevert(staking.migrateStakedTokens(migrationDestination, new BN(1), { from: stakeOwner }),
          'StakingContract::migrateStakedTokens - staked tokens must be the same');
      });

      it('should not allow migration if unable to approve', async () => {
        await token.setFailApprove(true);

        await expectRevert(staking.migrateStakedTokens(migrationDestinations[0], new BN(1), { from: stakeOwner }),
          "StakingContract::migrateStakedTokens - couldn't approve transfer");
      });

      it('should not allow migration of 0 tokens', async () => {
        await expectRevert(staking.migrateStakedTokens(migrationDestinations[0], new BN(0), { from: stakeOwner }),
          'StakingContract::migrateStakedTokens - amount must be greater than 0');
      });

      it('should not allow migration of more than staked tokens', async () => {
        await expectRevert(staking.migrateStakedTokens(migrationDestinations[0], stake.add(new BN(1)),
          { from: stakeOwner }), 'StakingContract::migrateStakedTokens - amount exceeds staked token balance');
      });

      context('with an unstaked stake', async () => {
        const unstakeAmount = new BN(100);
        beforeEach(async () => {
          await staking.unstake(unstakeAmount, { from: stakeOwner });
          await notifier.reset();
        });

        it('should only migrate tokens not in cooldown', async () => {
          await testMigration(staking, notifier, stakeOwner, stake.sub(unstakeAmount), migrationDestinations[2],
            migrationNotifiers[2]);
        });

        context('with a pending withdrawal', async () => {
          beforeEach(async () => {
            const unstakedStatus = await staking.getUnstakeStatus(stakeOwner);
            await time.increaseTo(unstakedStatus.cooldownEndTime.add(duration.seconds(1)));
            expect(await time.latest()).to.be.bignumber.gt(unstakedStatus.cooldownEndTime);
          });

          it('should only migrate tokens not in cooldown', async () => {
            await testMigration(staking, notifier, stakeOwner, stake.sub(unstakeAmount), migrationDestinations[2],
              migrationNotifiers[2]);
          });

          context('after a full withdrawal', async () => {
            beforeEach(async () => {
              await staking.withdraw({ from: stakeOwner });
              await notifier.reset();
            });

            it('should only migrate tokens not in cooldown', async () => {
              await testMigration(staking, notifier, stakeOwner, stake.sub(unstakeAmount), migrationDestinations[1],
                migrationNotifiers[1]);
            });
          });
        });
      });

      context('when stopped accepting new stake', async () => {
        beforeEach(async () => {
          await staking.stopAcceptingNewStakes({ from: emergencyManager });
        });

        it('should allow migration', async () => {
          await testMigration(staking, notifier, stakeOwner, stake, migrationDestinations[1], migrationNotifiers[1]);
        });
      });

      context('when released all stake', async () => {
        beforeEach(async () => {
          await staking.releaseAllStakes({ from: emergencyManager });
        });

        it('should not allow migration', async () => {
          await expectRevert(staking.migrateStakedTokens(migrationDestinations[0], stake, { from: stakeOwner }),
            'StakingContract: releasing all stakes');
        });
      });
    });
  });

  describe('emergency operations', async () => {
    let staking;
    beforeEach(async () => {
      const cooldown = duration.minutes(5);
      staking = await StakingContract.new(cooldown, migrationManager, emergencyManager, token);
    });

    context('as a regular account', async () => {
      const sender = accounts[0];

      it('should not allow requesting to stop accepting new stake', async () => {
        await expectRevert(staking.stopAcceptingNewStakes({ from: sender }),
          'StakingContract: caller is not the emergency manager');
      });

      it('should not allow requesting to release all stakes', async () => {
        await expectRevert(staking.releaseAllStakes({ from: sender }),
          'StakingContract: caller is not the emergency manager');
      });

      it('should not allow batch withdrawal of all stakes', async () => {
        await expectRevert(staking.withdrawReleasedStakes(accounts),
          'StakingContract: not releasing all stakes');
      });
    });

    context('as an emergency manager', async () => {
      const sender = emergencyManager;

      context('when stopped accepting new stake', async () => {
        beforeEach(async () => {
          const tx = await staking.stopAcceptingNewStakes({ from: sender });
          expectEvent.inLogs(tx.logs, EVENTS.stoppedAcceptingNewStake);
          expect(await staking.acceptingNewStakes()).to.be.false();
        });

        it('should stop accepting new stakes', async () => {
          const stakeOwner = accounts[3];
          const stake = new BN(333);
          await token.assign(stakeOwner, stake);
          await token.approve(staking.getAddress(), stake, { from: stakeOwner });

          await expectRevert(staking.stake(stake, { from: stakeOwner }), 'StakingContract: not accepting new stakes');
        });

        it('should not allow requesting to stop accepting new stakes again', async () => {
          await expectRevert(staking.stopAcceptingNewStakes({ from: sender }),
            'StakingContract: not accepting new stakes');
        });

        it('should allow requesting to release all stakes', async () => {
          await staking.releaseAllStakes({ from: sender });
        });
      });

      context('with an unstaked tokens', async () => {
        const stake = new BN(1000);
        const unstakeAmount = new BN(100);
        const stakeOwner = accounts[4];

        beforeEach(async () => {
          await token.assign(stakeOwner, stake);
          await token.approve(staking.getAddress(), stake, { from: stakeOwner });
          await staking.stake(stake, { from: stakeOwner });
          await staking.unstake(unstakeAmount, { from: stakeOwner });
        });

        context('when released all stake', async () => {
          beforeEach(async () => {
            const tx = await staking.releaseAllStakes({ from: sender });
            expectEvent.inLogs(tx.logs, EVENTS.releasedAllStakes);
            expect(await staking.releasingAllStakes()).to.be.true();
          });

          it('should allow withdrawal of all staked and unstaked tokens', async () => {
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

            await staking.withdraw({ from: stakeOwner });

            const currentState = await getState();

            expect(currentState.stakingBalance).to.be.bignumber.eq(prevState.stakingBalance.sub(stake));
            expect(currentState.stakeOwnerBalance).to.be.bignumber.eq(prevState.stakeOwnerBalance.add(stake));
            expect(currentState.stakeOwnerStake).to.be.bignumber.eq(new BN(0));
            expect(currentState.stakeOwnerUnstakedStatus.cooldownAmount).to.be.bignumber.eq(new BN(0));
            expect(currentState.stakeOwnerUnstakedStatus.cooldownEndTime).to.be.bignumber.eq(new BN(0));
            expect(currentState.totalStakedTokens).to.be.bignumber.eq(new BN(0));
          });

          it('should not allow requesting to stop accepting new stake', async () => {
            await expectRevert(staking.stopAcceptingNewStakes({ from: sender }),
              'StakingContract: not accepting new stakes');
          });

          it('should not allow requesting again to release all stakes', async () => {
            await expectRevert(staking.releaseAllStakes({ from: sender }),
              'StakingContract: releasing all stakes');
          });
        });
      });

      describe('batch withdraw', async () => {
        let notifier;
        beforeEach(async () => {
          notifier = await StakeChangeNotifier.new();
          await staking.setStakeChangeNotifier(notifier, { from: migrationManager });
        });

        context('with an unstaked stakes', async () => {
          const caller = accounts[10];
          const stakers = accounts.slice(0, 10);
          const stakeAmounts = [
            new BN(2481), new BN(5000), new BN(6105), new BN(5475), new BN(2249),
            new BN(7615), new BN(3087), new BN(1501), new BN(620), new BN(7198),
          ];
          const unstakeAmounts = [
            new BN(481), new BN(1000), new BN(105), new BN(475), new BN(249),
            new BN(615), new BN(87), new BN(501), new BN(20), new BN(198),
          ];

          beforeEach(async () => {
            for (let i = 0; i < stakers.length; ++i) {
              const staker = stakers[i];
              const stakedAmount = stakeAmounts[i];
              const unstakedAmount = unstakeAmounts[i];

              await token.assign(staker, stakedAmount);
              await token.approve(staking.getAddress(), stakedAmount, { from: staker });
              await staking.stake(stakedAmount, { from: staker });
              await staking.unstake(unstakedAmount, { from: staker });
            }
          });

          it('should not allow batch withdrawal of all stakes', async () => {
            await expectRevert(staking.withdrawReleasedStakes(accounts),
              'StakingContract: not releasing all stakes');
          });

          context('when released all stake', async () => {
            beforeEach(async () => {
              const tx = await staking.releaseAllStakes({ from: sender });
              expectEvent.inLogs(tx.logs, EVENTS.releasedAllStakes);
              expect(await staking.releasingAllStakes()).to.be.true();
            });

            it('should allow batch withdrawal of all stakes', async () => {
              const getStakeOwnerState = async (stakeOwner) => {
                return {
                  stakeOwnerBalance: await token.balanceOf(stakeOwner),
                  stakeOwnerStake: await staking.getStakeBalanceOf(stakeOwner),
                  stakeOwnerUnstakedStatus: await staking.getUnstakeStatus(stakeOwner),
                };
              };

              const getState = async () => {
                return {
                  stakingBalance: await token.balanceOf(staking.getAddress()),
                  totalStakedTokens: await staking.getTotalStakedTokens(),
                };
              };

              const prevState = await getState();
              const prevStakeOwnersStates = [];
              for (let i = 0; i < stakers.length; ++i) {
                const stakeOwner = stakers[i];
                prevStakeOwnersStates.push(await getStakeOwnerState(stakeOwner));
              }

              await notifier.reset();

              const tx = await staking.withdrawReleasedStakes(stakers, { from: caller });

              const { stakeOwners, amounts } = await notifier.getNotification();
              expect(stakeOwners).to.eql(stakers);
              expect(amounts).to.eqlBN(prevStakeOwnersStates.map((s) => s.stakeOwnerStake.neg()));

              let totalWithdrawn = new BN(0);
              let totalReleasedStake = new BN(0);

              for (let i = 0; i < stakers.length; ++i) {
                const staker = stakers[i];
                const stakedAmount = stakeAmounts[i];
                const unstakedAmount = unstakeAmounts[i];

                expectEvent.inLogs(tx.logs, EVENTS.withdrew, {
                  stakeOwner: staker,
                  amount: stakedAmount,
                  totalStakedAmount: new BN(0),
                });

                const prevStakeOwnersState = prevStakeOwnersStates[i];
                const currentStakeOwnerState = await getStakeOwnerState(staker);

                expect(currentStakeOwnerState.stakeOwnerBalance).to.be.bignumber
                  .eq(prevStakeOwnersState.stakeOwnerBalance.add(stakedAmount));
                expect(currentStakeOwnerState.stakeOwnerStake).to.be.bignumber.eq(new BN(0));
                expect(currentStakeOwnerState.stakeOwnerUnstakedStatus.cooldownAmount).to.be.bignumber.eq(new BN(0));
                expect(currentStakeOwnerState.stakeOwnerUnstakedStatus.cooldownEndTime).to.be.bignumber.eq(new BN(0));

                totalWithdrawn = totalWithdrawn.add(stakedAmount);
                totalReleasedStake = totalReleasedStake.add(stakedAmount.sub(unstakedAmount));
              }

              const currentState = await getState();

              expect(currentState.stakingBalance).to.be.bignumber.eq(prevState.stakingBalance.sub(totalWithdrawn));
              expect(currentState.totalStakedTokens).to.be.bignumber
                .eq(prevState.totalStakedTokens.sub(totalReleasedStake));
            });

            it('should revert when trying to withdraw for a 0 address', async () => {
              const stakersWithZeroAddress = stakers.slice();
              stakersWithZeroAddress[3] = constants.ZERO_ADDRESS;

              await expectRevert(staking.withdrawReleasedStakes(stakersWithZeroAddress, { from: caller }),
                "StakingContract::withdraw - stake owner can't be 0");
            });

            it('should revert when trying to withdraw for an address without any stake', async () => {
              const notStaker = accounts[25];
              expect(await staking.getStakeBalanceOf(notStaker)).to.be.bignumber.eq(new BN(0));

              const stakersWithNoStaker = stakers.slice();
              stakersWithNoStaker[8] = notStaker;

              await expectRevert(staking.withdrawReleasedStakes(stakersWithNoStaker, { from: caller }),
                'StakingContract::withdraw - no staked or unstaked tokens');
            });
          });
        });
      });
    });
  });
});
