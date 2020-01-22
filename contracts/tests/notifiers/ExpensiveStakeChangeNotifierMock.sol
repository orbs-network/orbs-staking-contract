pragma solidity 0.5.16;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../IStakingContract.sol";
import "./StakeChangeNotifierMock.sol";

/// @title An expensive test mockup for IStakeChangeNotifier. The purpose of this contract is to simulate the case when
/// the migration manager has set a notifier which consumes more than the STAKE_CHANGE_NOTIFICATION_GAS_LIMIT gas.
contract ExpensiveStakeChangeNotifierMock is StakeChangeNotifierMock {
    uint256 public gasCost;
    uint256 public constant TRANSACTION_GAS_COST = 21000;

    constructor(uint256 _gasCost) public {
        gasCost = _gasCost;
    }

    function stakeChange(address) public {
        uint256 remainingGas = gasleft() + TRANSACTION_GAS_COST - gasCost;

        while (remainingGas <= gasleft()) {
            // Deploy a dummy contract to waste some gas.
            new Dummy();
        }
    }
}

contract Dummy {
}
