pragma solidity 0.4.26;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract TestERC20 is ERC20 {
    bool public failApprove;
    bool public failTransfer;

    function setFailApprove(bool _failApprove) external {
        failApprove = _failApprove;
    }

    function setFailTransfer(bool _failTransfer) external {
        failTransfer = _failTransfer;
    }

    function assign(address _account, uint256 _value) external {
        _burn(_account, balanceOf(_account));
        _mint(_account, _value);
    }

    function approve(address spender, uint256 value) public returns (bool) {
        if (failApprove) {
            return false;
        }

        return super.approve(spender, value);
    }

    function transfer(address to, uint256 value) public returns (bool) {
        if (failTransfer) {
            return false;
        }

        return super.transfer(to, value);
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        if (failTransfer) {
            return false;
        }

        return super.transferFrom(from, to, value);
    }
}
