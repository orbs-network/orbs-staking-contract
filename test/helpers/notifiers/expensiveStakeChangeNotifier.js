import StakeChangeNotifier from './stakeChangeNotifier';

/* eslint-disable operator-linebreak */
const ExpensiveStakeChangeNotifierMock =
  artifacts.require('../../../contracts/tests/notifiers/ExpensiveStakeChangeNotifierMock.sol');
/* eslint-enable operator-linebreak */

class ExpensiveStakeChangeNotifier extends StakeChangeNotifier {
  constructor(gasCost) {
    super();

    this.gasCost = gasCost;
  }

  static async new(gasCost) {
    const notifier = new ExpensiveStakeChangeNotifier(gasCost);
    await notifier.deploy();

    return notifier;
  }

  async deploy() {
    this.contract = await ExpensiveStakeChangeNotifierMock.new(this.gasCost);
  }
}

export default ExpensiveStakeChangeNotifier;
