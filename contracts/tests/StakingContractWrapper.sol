pragma solidity 0.4.26;

import "../StakingContract.sol";

/// @title A test wrapper for StakingContract.
contract StakingContractWrapper is StakingContract {
    constructor(uint256 _cooldownPeriod, address _migrationManager, address _emergencyManager,
        IERC20 _token) public StakingContract(_cooldownPeriod, _migrationManager, _emergencyManager, _token) {
    }

    function getApprovedStakingContractsLength() external view returns (uint256) {
        return approvedStakingContracts.length;
    }
}
