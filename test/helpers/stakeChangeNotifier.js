const StakeChangeNotifierMock = artifacts.require('../../contracts/tests/StakeChangeNotifierMock.sol');

class StakeChangeNotifier {
  static async new() {
    const notifier = new StakeChangeNotifier();
    await notifier.deploy();

    return notifier;
  }

  async deploy() {
    this.setNotifier(await StakeChangeNotifierMock.new());
  }

  setNotifier(notifier) {
    this.notifier = notifier;
  }

  getAddress() {
    return this.notifier.address;
  }

  async setRevert(shouldRevert) {
    return this.notifier.setRevert(shouldRevert);
  }

  async reset() {
    return this.notifier.reset();
  }

  async getCalledWith() {
    const calledWith = [];

    const length = (await this.notifier.getCalledWithLength.call()).toNumber();
    for (let i = 0; i < length; ++i) {
      calledWith.push(await this.notifier.calledWith.call(i));
    }

    return calledWith;
  }

  static getAddress(obj) {
    if (obj instanceof Object) {
      if (typeof obj.getAddress === 'function') {
        return obj.getAddress();
      }

      return obj.address;
    }

    return obj;
  }
}

export default StakeChangeNotifier;
