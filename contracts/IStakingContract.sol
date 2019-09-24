pragma solidity 0.4.26;

import "./IMigratableStakingContract.sol";

/// @title An interface for staking contracts.
interface IStakingContract {
    // @dev Stakes ORBS tokens on behalf of msg.sender.
    /// @param _amount uint256 The amount of tokens to stake.
    ///
    /// Note: This method assumes that the user has already approved at least the required amount using ERC20 approve.
    function stake(uint256 _amount) external;

    /// @dev Unstakes ORBS tokens from msg.sender. If successful, this will start the cooldown period, after which
    ///     msg.sender would be able to withdraw all of his tokens.
    /// @param _amount uint256 The amount of tokens to unstake.
    function unstake(uint256 _amount) external;

    /// @dev Requests to withdraw all of staked ORBS tokens back to msg.sender.
    ///
    /// Note: Stake owners can withdraw their ORBS tokens only after previously unstaking them and after the cooldown
    /// period has passed (unless the contract was requested to release all stakes).
    function withdraw() external;

    /// @dev Restakes unstaked ORBS tokens (in or after cooldown) for msg.sender.
    function restake() external;

    /// @dev Distributes staking rewards to a list of addresses by directly adding rewards to their stakes.
    /// @param _totalAmount uint256 The total amount of rewards to distributes.
    /// @param _stakeOwners address[] The addresses of the stake owners.
    /// @param _amounts uint256[] The amounts of the rewards.
    ///
    /// Notes: This method assumes that the user has already approved at least the required amount using ERC20 approve.
    /// Since this is a convenience method, we aren't concerned about reaching block gas limit by using large lists. We
    /// assume that callers will be able to properly batch/paginate their requests.
    function distributeRewards(uint256 _totalAmount, address[] _stakeOwners, uint256[] _amounts) external;

    /// @dev Returns the stake of the specified stake owner (excluding unstaked tokens).
    /// @param _stakeOwner address The address to check.
    function getStakeBalanceOf(address _stakeOwner) external view returns (uint256);

    /// @dev Returns the total amount staked tokens (excluding unstaked tokens).
    function getTotalStakedTokens() external view returns (uint256);

    /// @dev Returns the time that the cooldown period ends (or ended) and the amount of tokens to be released.
    /// @param _stakeOwner address The address to check.
    function getUnstakeStatus(address _stakeOwner) external view returns (uint256 cooldownAmount,
        uint256 cooldownEndTime);

    /// @dev Migrates the stake of msg.sender from this staking contract to a new approved staking contract.
    /// @param _newStakingContract IMigratableStakingContract The new staking contract which supports stake migration.
    /// @param _amount uint256 The amount of tokens to migrate.
    function migrateStakedTokens(IMigratableStakingContract _newStakingContract, uint256 _amount) external;
}
