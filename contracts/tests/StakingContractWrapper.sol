pragma solidity 0.4.26;

import "../StakingContract.sol";


/// @title A test wrapper for StakingContract.
contract StakingContractWrapper is StakingContract {
    constructor(uint256 _cooldownPeriod, address _migrationManager, address _emergencyManager,
        IERC20 _token) StakingContract(_cooldownPeriod, _migrationManager, _emergencyManager, _token) public {
    }

    function notify(address _stakeOwner) public {
        super.notifyStakeChange(_stakeOwner);
    }

    function getApprovedStakingContractsLength() public view returns(uint256) {
        return approvedStakingContracts.length;
    }
}
