pragma solidity 0.4.26;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./IStakingContract.sol";
import "./IStakeChangeNotifier.sol";

/// @title Orbs staking smart contract.
contract StakingContract is IStakingContract {
    using SafeMath for uint256;

    // The version of the smart contract.
    uint public constant VERSION = 1;

    // The maximum number of approved staking contracts.
    uint public constant MAX_APPROVED_STAKING_CONTRACTS = 10;

    // The period (in seconds) between a validator requesting to stop staking and being able to withdraw them.
    uint256 public cooldownPeriod;

    // The address responsible for enabling migration to a new staking contract.
    address public migrationManager;

    // The address responsible for starting emergency processes and gracefully handling unstaking operations.
    address public emergencyManager;

    // A list of staking contracts which are approved by this contract. Migrating stake will be only allowed to one of
    // these contracts.
    IStakingContract[] public approvedStakingContracts;

    // The address of the contract responsible for notifying of stake change events.
    IStakeChangeNotifier public notifier;

    // The address of the ORBS token.
    IERC20 public token;

    event MigrationManagerUpdated(address indexed migrationManager);
    event MigrationDestinationAdded(address indexed stakingContract);
    event MigrationDestinationRemoved(address indexed stakingContract);
    event EmergencyManagerUpdated(address indexed emergencyManager);
    event StakeChangeNotifierUpdated(address indexed notifier);
    event StakeChangeNotificationFailed(address indexed notifier);

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
    /// @param _token IERC20 The address of the ORBS token.
    constructor(uint256 _cooldownPeriod, address _migrationManager, address _emergencyManager, IERC20 _token) public {
        require(_cooldownPeriod > 0, "StakingContract::ctor - cooldown period must be greater than 0");
        require(_migrationManager != address(0), "StakingContract::ctor - migration manager must not be 0");
        require(_emergencyManager != address(0), "StakingContract::ctor - emergency manager must not be 0");
        require(_token != address(0), "StakingContract::ctor - ORBS token must not be 0");

        cooldownPeriod = _cooldownPeriod;
        migrationManager = _migrationManager;
        emergencyManager = _emergencyManager;
        token = _token;
    }

    /// @dev Sets the address of the migration manager.
    /// @param _newMigrationManager address The address of the new migration manager.
    function setMigrationManager(address _newMigrationManager) external onlyMigrationManager {
        require(_newMigrationManager != address(0), "StakingContract::setMigrationManager - address must not be 0");
        require(migrationManager != _newMigrationManager,
            "StakingContract::setMigrationManager - new address must be different");

        migrationManager = _newMigrationManager;

        emit MigrationManagerUpdated(migrationManager);
    }

    /// @dev Sets the address of the emergency manager.
    /// @param _newEmergencyManager address The address of the new emergency manager.
    function setEmergencyManager(address _newEmergencyManager) external onlyEmergencyManager {
        require(_newEmergencyManager != address(0), "StakingContract::setEmergencyManager - address must not be 0");
        require(emergencyManager != _newEmergencyManager,
            "StakingContract::setEmergencyManager - new address must be different");

        emergencyManager = _newEmergencyManager;

        emit EmergencyManagerUpdated(emergencyManager);
    }

    /// @dev Sets the stake change notifier contract.
    /// @param _newNotifier IStakeChangeNotifier The address of the new stake change notifier contract.
    ///
    /// Note: it's allowed to reset the notifier to a zero address.
    function setStakeChangeNotifier(IStakeChangeNotifier _newNotifier) external onlyMigrationManager {
        require(notifier != _newNotifier, "StakingContract::setStakeChangeNotifier - new address must be different");

        notifier = _newNotifier;

        emit StakeChangeNotifierUpdated(notifier);
    }

    /// @dev Adds a new contract to the list of approved staking contracts.
    /// @param _newStakingContract IStakingContract The new contract to add.
    function addMigrationDestination(IStakingContract _newStakingContract) external onlyMigrationManager {
        require(_newStakingContract != address(0), "StakingContract::addMigrationDestination - address must not be 0");
        require(approvedStakingContracts.length + 1 <= MAX_APPROVED_STAKING_CONTRACTS,
            "StakingContract::addMigrationDestination - can't add more staking contracts");

        // Check for duplicates.
        for (uint i = 0; i < approvedStakingContracts.length; ++i) {
            require(approvedStakingContracts[i] != _newStakingContract,
                "StakingContract::addMigrationDestination - can't add a duplicate staking contract");
        }

        approvedStakingContracts.push(_newStakingContract);
        emit MigrationDestinationAdded(_newStakingContract);
    }

    /// @dev Removes a contract from the list of approved staking contracts.
    /// @param _stakingContract IStakingContract The contract to remove.
    function removeMigrationDestination(IStakingContract _stakingContract) external onlyMigrationManager {
        require(_stakingContract != address(0), "StakingContract::removeMigrationDestination - address must not be 0");

        // Check for existence.
        (uint i, bool exists) = findApprovedStakingContractIndex(_stakingContract);
        require(exists, "StakingContract::removeMigrationDestination - staking contract doesn't exist");

        while (i < approvedStakingContracts.length - 1) {
            approvedStakingContracts[i] = approvedStakingContracts[i + 1];
            i++;
        }

        delete approvedStakingContracts[i];
        approvedStakingContracts.length--;

        emit MigrationDestinationRemoved(_stakingContract);
    }

    /// @dev Returns whether a specific staking contract was approved.
    /// @param _stakingContract IStakingContract The staking contract to look for.
    function isApprovedStakingContract(IStakingContract _stakingContract) public view returns (bool) {
        (, bool exists) = findApprovedStakingContractIndex(_stakingContract);
        return exists;
    }

    /// @dev Notifies of stake change event.
    /// @param _stakeOwner address The address of the subject stake owner.
    function notifyStakeChange(address _stakeOwner) internal {
        if (notifier == address(0)) {
            return;
        }

        // In order to handle the case when the stakeChange method reverts, we will invoke it using EVM call and check
        // its returned value.

        // solhint-disable avoid-low-level-calls
        if (!address(notifier).call(abi.encodeWithSelector(notifier.stakeChange.selector, _stakeOwner))) {
            emit StakeChangeNotificationFailed(notifier);
        }
        // solhint-enable avoid-low-level-calls
    }

    /// @dev Returns an index of an existing approved staking contract.
    /// @param _stakingContract IStakingContract The staking contract to look for.
    function findApprovedStakingContractIndex(IStakingContract _stakingContract) private view returns(uint, bool) {
        uint length = approvedStakingContracts.length;
        uint i;
        for (i = 0; i < length; ++i) {
            if (approvedStakingContracts[i] == _stakingContract) {
                return (i, true);
            }
        }

        return (i, false);
    }
}
