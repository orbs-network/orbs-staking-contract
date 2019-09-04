pragma solidity 0.4.26;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";


// @title Orbs staking smart contract.
contract StakingContract {
    using SafeMath for uint256;

    // The version of the smart contract.
    uint public constant VERSION = 1;

    // The period (in seconds) between a validator requesting to stop staking and being able to withdraw them.
    uint256 public cooldownPeriod;

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
    /// @param _cooldownPeriod uint256 The period of time (in seconds) between a validator requesting to stop staking
    /// and being able to withdraw them.
    /// @param _migrationManager address The address responsible for enabling migration to a new staking contract.
    /// @param _emergencyManager address The address responsible for starting emergency processes and gracefully
    ///     handling unstaking operations.
    /// @param _token IERC20 The address of the Orbs token.

    constructor(uint256 _cooldownPeriod, address _migrationManager, address _emergencyManager, IERC20 _token) public {
        require(_cooldownPeriod > 0, "StakingContract::ctor - cooldown period must be greater than 0");
        require(_migrationManager != address(0), "StakingContract::ctor - migration manager must not be 0");
        require(_emergencyManager != address(0), "StakingContract::ctor - emergency manager must not be 0");
        require(_token != address(0), "StakingContract::ctor - Orbs token must not be 0");

        cooldownPeriod = _cooldownPeriod;
        migrationManager = _migrationManager;
        emergencyManager = _emergencyManager;
        token = _token;
    }
}
