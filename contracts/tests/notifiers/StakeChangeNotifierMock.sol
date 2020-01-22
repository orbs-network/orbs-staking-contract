pragma solidity 0.5.16;

import "../../IStakeChangeNotifier.sol";

/// @title A test mockup for IStakeChangeNotifier.
contract StakeChangeNotifierMock is IStakeChangeNotifier {
    address[] public calledWith;
    bool public shouldRevert;

    modifier notReverting() {
        require(!shouldRevert, "StakeChangeNotifierMock: revert");

        _;
    }

    function setRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }

    function reset() external {
        delete calledWith;
    }

    function getCalledWithLength() external view returns (uint256) {
        return calledWith.length;
    }

    function stakeChange(address _stakerOwner) public notReverting {
        calledWith.push(_stakerOwner);
    }
}
