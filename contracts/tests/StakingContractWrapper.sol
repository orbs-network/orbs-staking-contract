pragma solidity 0.5.16;

import "../StakingContract.sol";

/// @title A test wrapper for StakingContract.
contract StakingContractWrapper is StakingContract {
    constructor(uint256 _cooldownPeriodInSec, address _migrationManager, address _emergencyManager,
        IERC20 _token) public StakingContract(_cooldownPeriodInSec, _migrationManager, _emergencyManager, _token) {
    }

    function notify(address _stakeOwner, uint256 _amount, bool _sign) external {
        super.notifyStakeChange(_stakeOwner, _amount, _sign);
    }

    function getApprovedStakingContractsLength() external view returns (uint256) {
        return approvedStakingContracts.length;
    }
}
