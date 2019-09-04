pragma solidity 0.4.26;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";


// @title Orbs staking smart contract.
contract StakingContract {
    using SafeMath for uint256;

    // The version of the smart contract.
    uint public constant VERSION = 1;

    // The address responsible for enabling migration to a new staking contract.
    address public migrationManager;

    // The address responsible for starting emergency processes and gracefully handling unstaking operations.
    address public emergencyManager;

    // The address of the ORBS token.
    IERC20 public token;

    modifier onlyMigrationManager() {
        require(msg.sender == migrationManager, "StakingContract: caller is not the migration manager");

        _;
    }

    modifier onlyEmergencyManager() {
        require(msg.sender == emergencyManager, "StakingContract: caller is not the emergency manager");

        _;
    }

    /// @dev Initializes the staking contract.
    constructor(address _migrationManager, address _emergencyManager, IERC20 _token) public {
        require(_migrationManager != address(0), "StakingContract::ctor - migration manager must not be 0");
        require(_emergencyManager != address(0), "StakingContract::ctor - emergency manager must not be 0");
        require(_token != address(0), "StakingContract::ctor - Orbs token must not be 0");

        migrationManager = _migrationManager;
        emergencyManager = _emergencyManager;
        token = _token;
    }
}
