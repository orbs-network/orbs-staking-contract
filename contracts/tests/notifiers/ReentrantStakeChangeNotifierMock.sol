pragma solidity 0.5.16;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../StakingContract.sol";
import "./StakeChangeNotifierMock.sol";

/// @title A reentrancy test mockup for IStakeChangeNotifier. The purpose of this contract is to simulate the case when
/// the migration manager has set a notifier which tries to reenter back to the staking contract.
contract ReentrantStakeChangeNotifierMock is StakeChangeNotifierMock {
    StakingContract public staking;
    IERC20 public token;
    address public stakeOwner;
    uint256 public amount;
    bool public attacking;

    constructor(StakingContract _staking, IERC20 _token) public {
        staking = _staking;
        token = _token;
    }

    function setStakeData(address _stakeOwner, uint256 _amount) external {
        stakeOwner = _stakeOwner;
        amount = _amount;
    }

    function approve(address _spender, uint256 _amount) external {
        require(token.approve(_spender, _amount),
            "ReentrantStakeChangeNotifierMock::approve - couldn't approve transfer");
    }

    function stakeChange(address _stakerOwner, uint256 _amount, bool _sign) public {
        if (attacking) {
            attacking = false;
            super.stakeChange(_stakerOwner, _amount, _sign);

            return;
        }

        attacking = true;
        super.stakeChange(_stakerOwner, _amount, _sign);

        staking.acceptMigration(stakeOwner, amount);
    }
}
