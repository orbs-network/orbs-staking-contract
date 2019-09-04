pragma solidity 0.4.26;


// @title An interface for notifying of stake change events (e.g., stake, unstake, partial unstake, restate, etc.).
interface IStakeChangeNotifier {
    function stakeChange(address _staker) external;
}
