pragma solidity 0.4.26;

/// @title An interface for staking contracts.
interface IStakingContract {
    /// @dev Stakes amount of ORBS tokens on behalf of msg.sender.
    /// @param _amount uint256 The number of tokens to stake.
    ///
    /// Note: This method assumes that the user has already approved at least the required amount using ERC20 approve.
    function acceptMigration(address _stakerOwner, uint256 _amount) external;
}
