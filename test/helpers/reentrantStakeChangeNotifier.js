import StakeChangeNotifier from './stakeChangeNotifier';

const StakeChangeNotifierMock = artifacts.require('../../contracts/tests/ReentrantStakeChangeNotifierMock.sol');

class ReentrantStakeChangeNotifier extends StakeChangeNotifier {
  constructor(staking, token) {
    super();

    this.staking = staking;
    this.token = token;
  }

  static async new(staking, token) {
    const notifier = new ReentrantStakeChangeNotifier(staking, token);
    await notifier.deploy();

    return notifier;
  }

  async deploy() {
    this.setNotifier(await StakeChangeNotifierMock.new(StakeChangeNotifier.getAddress(this.staking),
      StakeChangeNotifier.getAddress(this.token)));
  }

  async setStakeData(stakeOwner, amount) {
    return this.notifier.setStakeData(StakeChangeNotifier.getAddress(stakeOwner), amount);
  }

  async approve(spender, amount, options = {}) {
    return this.notifier.approve(StakeChangeNotifier.getAddress(spender), amount, options);
  }
}

export default ReentrantStakeChangeNotifier;
