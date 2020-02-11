import BaseContract from '../baseContract';

const StakeChangeNotifierMock = artifacts.require('../../../contracts/tests/notifiers/StakeChangeNotifierMock.sol');

class StakeChangeNotifier extends BaseContract {
  static async new() {
    const notifier = new StakeChangeNotifier();
    await notifier.deploy();

    return notifier;
  }

  async deploy() {
    this.contract = await StakeChangeNotifierMock.new();
  }

  async setRevert(shouldRevert) {
    return this.contract.setRevert(shouldRevert);
  }

  async reset() {
    return this.contract.reset();
  }

  async getNotification() {
    const stakeOwners = [];
    const amounts = [];
    const updatedStakes = [];

    const length = (await this.contract.getNotificationsLength.call()).toNumber();
    for (let i = 0; i < length; ++i) {
      stakeOwners.push(await this.contract.stakeOwnersNotifications.call(i));
      const sign = await this.contract.amountsSignsNotifications.call(i);
      const amount = await this.contract.amountsNotifications.call(i);
      amounts.push(sign ? amount : amount.neg());
      updatedStakes.push(await this.contract.updatedStakeAmountsNotifications.call(i));
    }

    return {
      stakeOwners,
      amounts,
      updatedStakes,
    };
  }
}

export default StakeChangeNotifier;
