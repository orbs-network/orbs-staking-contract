pragma solidity 0.4.26;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

/// @title An interface for staking contracts.
interface IStakingContract {
    /// @dev Returns the address of the underlying staked token.
    function getToken() external view returns (IERC20);

    /// @dev Stakes ORBS tokens on behalf of msg.sender.
    /// @param _amount uint256 The number of tokens to stake.
    ///
    /// Note: This method assumes that the user has already approved at least the required amount using ERC20 approve.
    function acceptMigration(address _stakerOwner, uint256 _amount) external;
}
