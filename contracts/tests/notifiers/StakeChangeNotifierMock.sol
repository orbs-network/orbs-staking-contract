pragma solidity 0.5.16;

import "../../IStakeChangeNotifier.sol";

/// @title A test mockup for IStakeChangeNotifier.
contract StakeChangeNotifierMock is IStakeChangeNotifier {
    address[] public stakeOwnersNotifications;
    uint256[] public amountsNotifications;
    bool[] public amountsSignsNotifications;

    bool public shouldRevert;

    modifier notReverting() {
        require(!shouldRevert, "StakeChangeNotifierMock: revert");

        _;
    }

    function setRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }

    function reset() external {
        delete stakeOwnersNotifications;
        delete amountsNotifications;
        delete amountsSignsNotifications;
    }

    function getNotificationsLength() external view returns (uint256) {
        uint256 stakeOwnersNotificationsLength = stakeOwnersNotifications.length;
        assert(stakeOwnersNotificationsLength == amountsNotifications.length);
        assert(stakeOwnersNotificationsLength == amountsSignsNotifications.length);

        return stakeOwnersNotificationsLength;
    }

    function stakeChange(address _stakerOwner, uint256 _amount, bool _sign) public notReverting {
        stakeOwnersNotifications.push(_stakerOwner);
        amountsNotifications.push(_amount);
        amountsSignsNotifications.push(_sign);
    }
}
