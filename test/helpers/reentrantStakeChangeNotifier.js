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
    this.contract = await StakeChangeNotifierMock.new(ReentrantStakeChangeNotifier.getAddress(this.staking),
      ReentrantStakeChangeNotifier.getAddress(this.token));
  }

  async setStakeData(stakeOwner, amount) {
    return this.contract.setStakeData(ReentrantStakeChangeNotifier.getAddress(stakeOwner), amount);
  }

  async approve(spender, amount, options = {}) {
    return this.contract.approve(ReentrantStakeChangeNotifier.getAddress(spender), amount, options);
  }
}

export default ReentrantStakeChangeNotifier;
