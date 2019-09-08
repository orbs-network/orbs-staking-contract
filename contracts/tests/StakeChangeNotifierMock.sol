pragma solidity 0.4.26;

import "../IStakeChangeNotifier.sol";

/// @title A test mockup for IStakeChangeNotifier.
contract StakeChangeNotifierMock is IStakeChangeNotifier {
    address public calledWith;
    bool public shouldRevert;

    modifier notReverting() {
        require(!shouldRevert, "StakeChangeNotifierMock: revert");

        _;
    }

    function setRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }

    function stakeChange(address _stakerOwner) public notReverting {
        calledWith = _stakerOwner;
    }
}
