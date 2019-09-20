import BaseContract from './baseContract';

const StakeChangeNotifierMock = artifacts.require('../../contracts/tests/notifiers/StakeChangeNotifierMock.sol');

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

  async getCalledWith() {
    const calledWith = [];

    const length = (await this.contract.getCalledWithLength.call()).toNumber();
    for (let i = 0; i < length; ++i) {
      calledWith.push(await this.contract.calledWith.call(i));
    }

    return calledWith;
  }
}

export default StakeChangeNotifier;
