pragma solidity 0.5.16;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "./IStakingContract.sol";
import "./IStakeChangeNotifier.sol";

/// @title Orbs staking smart contract.
contract StakingContract is IStakingContract, IMigratableStakingContract {
    using SafeMath for uint256;

    struct Stake {
        uint256 amount;
        uint256 cooldownAmount;
        uint256 cooldownEndTime;
    }

    // The version of the smart contract.
    uint public constant VERSION = 1;

    // The maximum number of approved staking contracts as migration destinations.
    uint public constant MAX_APPROVED_STAKING_CONTRACTS = 10;

    // The gas limit for stake change notifications.
    uint public constant STAKE_CHANGE_NOTIFICATION_GAS_LIMIT = 2000000;

    // The mapping between stake owners and their data.
    mapping (address => Stake) internal stakes;

    // Total amount of staked tokens (not including unstaked tokes in cooldown or pending withdrawal).
    uint256 internal totalStakedTokens;

    // The period (in seconds) between a stake owner's request to stop staking and being able to withdraw them.
    uint256 public cooldownPeriodInSec;

    // The address responsible for managing migration to a new staking contract.
    address public migrationManager;

    // The address responsible for emergency operations and graceful return of staked tokens back to their owners.
    address public emergencyManager;

    // The list of staking contracts which are approved by this contract. It would be only allowed to migrate a stake to
    // one of these contracts.
    IMigratableStakingContract[] public approvedStakingContracts;

    // The address of the contract responsible for publishing stake change notifications.
    IStakeChangeNotifier public notifier;

    // The address of the ORBS token.
    IERC20 internal token;

    // Represents whether the contract accepts new staking requests. Please note, that even when it's turned off,
    // it'd be still possible to unstake or withdraw tokens.
    //
    // Note: This can be turned off only once by the emergency manager of the contract.
    bool public acceptingNewStakes = true;

    // Represents whether this staking contract allows releasing all unstaked tokens unconditionally. When it's turned
    // on, stake owners could release their staked tokens, without explicitly requesting to unstake them, and their
    // previously unstaked tokens, regardless of the cooldown period. This also stops the contract from accepting new
    // stakes.
    //
    // Note: This can be turned off only once by the emergency manager of the contract.
    bool public releasingAllStakes = false;

    event MigrationManagerUpdated(address indexed migrationManager);
    event MigrationDestinationAdded(IMigratableStakingContract indexed stakingContract);
    event MigrationDestinationRemoved(IMigratableStakingContract indexed stakingContract);
    event EmergencyManagerUpdated(address indexed emergencyManager);
    event StakeChangeNotifierUpdated(IStakeChangeNotifier indexed notifier);
    event StakeChangeNotificationFailed(IStakeChangeNotifier indexed notifier);
    event StoppedAcceptingNewStake();
    event ReleasedAllStakes();

    modifier onlyMigrationManager() {
        require(msg.sender == migrationManager, "StakingContract: caller is not the migration manager");

        _;
    }

    modifier onlyEmergencyManager() {
        require(msg.sender == emergencyManager, "StakingContract: caller is not the emergency manager");

        _;
    }

    modifier onlyWhenAcceptingNewStakes() {
        require(acceptingNewStakes && !releasingAllStakes, "StakingContract: not accepting new stakes");

        _;
    }

    modifier onlyWhenStakesReleased() {
        require(releasingAllStakes, "StakingContract: not releasing all stakes");

        _;
    }

    modifier onlyWhenStakesNotReleased() {
        require(!releasingAllStakes, "StakingContract: releasing all stakes");

        _;
    }

    /// @dev Initializes the staking contract.
    /// @param _cooldownPeriodInSec uint256 The period (in seconds) between a stake owner's request to stop staking and being
    /// able to withdraw them.
    /// @param _migrationManager address The address responsible for managing migration to a new staking contract.
    /// @param _emergencyManager address The address responsible for emergency operations and graceful return of staked
    /// tokens back to their owners.
    /// @param _token IERC20 The address of the ORBS token.
    constructor(uint256 _cooldownPeriodInSec, address _migrationManager, address _emergencyManager, IERC20 _token) public {
        require(_cooldownPeriodInSec > 0, "StakingContract::ctor - cooldown period must be greater than 0");
        require(_migrationManager != address(0), "StakingContract::ctor - migration manager must not be 0");
        require(_emergencyManager != address(0), "StakingContract::ctor - emergency manager must not be 0");
        require(address(_token) != address(0), "StakingContract::ctor - ORBS token must not be 0");

        cooldownPeriodInSec = _cooldownPeriodInSec;
        migrationManager = _migrationManager;
        emergencyManager = _emergencyManager;
        token = _token;
    }

    /// @dev Sets the address of the migration manager.
    /// @param _newMigrationManager address The address of the new migration manager.
    function setMigrationManager(address _newMigrationManager) external onlyMigrationManager {
        require(_newMigrationManager != address(0), "StakingContract::setMigrationManager - address must not be 0");
        require(migrationManager != _newMigrationManager,
            "StakingContract::setMigrationManager - address must be different than the current address");

        migrationManager = _newMigrationManager;

        emit MigrationManagerUpdated(migrationManager);
    }

    /// @dev Sets the address of the emergency manager.
    /// @param _newEmergencyManager address The address of the new emergency manager.
    function setEmergencyManager(address _newEmergencyManager) external onlyEmergencyManager {
        require(_newEmergencyManager != address(0), "StakingContract::setEmergencyManager - address must not be 0");
        require(emergencyManager != _newEmergencyManager,
            "StakingContract::setEmergencyManager - address must be different than the current address");

        emergencyManager = _newEmergencyManager;

        emit EmergencyManagerUpdated(emergencyManager);
    }

    /// @dev Sets the address of the stake change notifier contract.
    /// @param _newNotifier IStakeChangeNotifier The address of the new stake change notifier contract.
    ///
    /// Note: it's allowed to reset the notifier to a zero address.
    function setStakeChangeNotifier(IStakeChangeNotifier _newNotifier) external onlyMigrationManager {
        require(notifier != _newNotifier,
            "StakingContract::setStakeChangeNotifier - address must be different than the current address");

        notifier = _newNotifier;

        emit StakeChangeNotifierUpdated(notifier);
    }

    /// @dev Adds a new contract to the list of approved staking contracts migration destinations.
    /// @param _newStakingContract IMigratableStakingContract The new contract to add.
    function addMigrationDestination(IMigratableStakingContract _newStakingContract) external onlyMigrationManager {
        require(address(_newStakingContract) != address(0),
            "StakingContract::addMigrationDestination - address must not be 0");
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

    /// @dev Removes a contract from the list of approved staking contracts migration destinations.
    /// @param _stakingContract IMigratableStakingContract The contract to remove.
    function removeMigrationDestination(IMigratableStakingContract _stakingContract) external onlyMigrationManager {
        require(address(_stakingContract) != address(0),
            "StakingContract::removeMigrationDestination - address must not be 0");

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

    /// @dev Stakes ORBS tokens on behalf of msg.sender. This method assumes that the user has already approved at least
    /// the required amount using ERC20 approve.
    /// @param _amount uint256 The amount of tokens to stake.
    function stake(uint256 _amount) external onlyWhenAcceptingNewStakes {
        address stakeOwner = msg.sender;

        uint256 totalStakedAmount = stake(stakeOwner, _amount);

        emit Staked(stakeOwner, _amount, totalStakedAmount);

        // Note: we aren't concerned with reentrancy since:
        //   1. At this point, due to the CEI pattern, a reentrant notifier can't affect the effects of this method.
        //   2. The notifier is set and managed by the migration manager.
        notifyStakeChange(stakeOwner);
    }

    /// @dev Unstakes ORBS tokens from msg.sender. If successful, this will start the cooldown period, after which
    /// msg.sender would be able to withdraw all of his tokens.
    /// @param _amount uint256 The amount of tokens to unstake.
    function unstake(uint256 _amount) external {
        require(_amount > 0, "StakingContract::unstake - amount must be greater than 0");

        address stakeOwner = msg.sender;
        Stake storage stakeData = stakes[stakeOwner];
        uint256 stakedAmount = stakeData.amount;
        uint256 cooldownAmount = stakeData.cooldownAmount;
        uint256 cooldownEndTime = stakeData.cooldownEndTime;

        require(_amount <= stakedAmount, "StakingContract::unstake - can't unstake more than the current stake");

        // If any tokens in cooldown are ready for withdrawal - revert. Stake owner should withdraw their unstaked
        // tokens first.
        require(cooldownAmount == 0 || cooldownEndTime > now,
            "StakingContract::unstake - unable to unstake when there are tokens pending withdrawal");

        // Update the amount of tokens in cooldown. Please note that this will also restart the cooldown period of all
        // tokens in cooldown.
        stakeData.amount = stakedAmount.sub(_amount);
        stakeData.cooldownAmount = cooldownAmount.add(_amount);
        stakeData.cooldownEndTime = now.add(cooldownPeriodInSec);

        totalStakedTokens = totalStakedTokens.sub(_amount);

        emit Unstaked(stakeOwner, _amount, stakeData.amount);

        // Note: we aren't concerned with reentrancy since:
        //   1. At this point, due to the CEI pattern, a reentrant notifier can't affect the effects of this method.
        //   2. The notifier is set and managed by the migration manager.
        notifyStakeChange(stakeOwner);
    }

    /// @dev Requests to withdraw all of staked ORBS tokens back to msg.sender. Stake owners can withdraw their ORBS
    /// tokens only after previously unstaking them and after the cooldown period has passed (unless the contract was
    /// requested to release all stakes).
    function withdraw() external {
        address stakeOwner = msg.sender;

        (uint256 withdrawnAmount, uint256 totalStakedAmount) = withdraw(stakeOwner);

        emit Withdrew(stakeOwner, withdrawnAmount, totalStakedAmount);

        // Note: we aren't concerned with reentrancy since:
        //   1. At this point, due to the CEI pattern, a reentrant notifier can't affect the effects of this method.
        //   2. The notifier is set and managed by the migration manager.
        notifyStakeChange(stakeOwner);
    }

    /// @dev Restakes unstaked ORBS tokens (in or after cooldown) for msg.sender.
    function restake() external onlyWhenAcceptingNewStakes {
        address stakeOwner = msg.sender;
        Stake storage stakeData = stakes[stakeOwner];
        uint256 cooldownAmount = stakeData.cooldownAmount;

        require(cooldownAmount > 0, "StakingContract::restake - no unstaked tokens");

        stakeData.amount = stakeData.amount.add(cooldownAmount);
        stakeData.cooldownAmount = 0;
        stakeData.cooldownEndTime = 0;

        totalStakedTokens = totalStakedTokens.add(cooldownAmount);

        emit Restaked(stakeOwner, cooldownAmount, stakeData.amount);

        // Note: we aren't concerned with reentrancy since:
        //   1. At this point, due to the CEI pattern, a reentrant notifier can't affect the effects of this method.
        //   2. The notifier is set and managed by the migration manager.
        notifyStakeChange(stakeOwner);
    }

    /// @dev Stakes ORBS tokens on behalf of msg.sender. This method assumes that the user has already approved at least
    /// the required amount using ERC20 approve.
    /// @param _stakeOwner address The specified stake owner.
    /// @param _amount uint256 The amount of tokens to stake.
    function acceptMigration(address _stakeOwner, uint256 _amount) external onlyWhenAcceptingNewStakes {
        uint256 totalStakedAmount = stake(_stakeOwner, _amount);

        emit AcceptedMigration(_stakeOwner, _amount, totalStakedAmount);

        // Note: we aren't concerned with reentrancy since:
        //   1. At this point, due to the CEI pattern, a reentrant notifier can't affect the effects of this method.
        //   2. The notifier is set and managed by the migration manager.
        notifyStakeChange(_stakeOwner);
    }

    /// @dev Migrates the stake of msg.sender from this staking contract to a new approved staking contract.
    /// @param _newStakingContract IMigratableStakingContract The new staking contract which supports stake migration.
    /// @param _amount uint256 The amount of tokens to migrate.
    function migrateStakedTokens(IMigratableStakingContract _newStakingContract, uint256 _amount) external
        onlyWhenStakesNotReleased {
        require(isApprovedStakingContract(_newStakingContract),
            "StakingContract::migrateStakedTokens - migration destination wasn't approved");
        require(_amount > 0, "StakingContract::migrateStakedTokens - amount must be greater than 0");

        address stakeOwner = msg.sender;
        Stake storage stakeData = stakes[stakeOwner];
        uint256 stakedAmount = stakeData.amount;

        require(stakedAmount > 0, "StakingContract::migrateStakedTokens - no staked tokens");
        require(_amount <= stakedAmount, "StakingContract::migrateStakedTokens - amount exceeds staked token balance");

        stakeData.amount = stakedAmount.sub(_amount);

        totalStakedTokens = totalStakedTokens.sub(_amount);

        require(_newStakingContract.getToken() == token,
            "StakingContract::migrateStakedTokens - staked tokens must be the same");
        require(token.approve(address(_newStakingContract), _amount),
            "StakingContract::migrateStakedTokens - couldn't approve transfer");

        emit MigratedStake(stakeOwner, _amount, stakeData.amount);

        _newStakingContract.acceptMigration(stakeOwner, _amount);
    }

    /// @dev Distributes staking rewards to a list of addresses by directly adding rewards to their stakes. This method
    /// assumes that the user has already approved at least the required amount using ERC20 approve. Since this is a
    /// convenience method, we aren't concerned about reaching block gas limit by using large lists. We assume that
    /// callers will be able to properly batch/paginate their requests.
    /// @param _totalAmount uint256 The total amount of rewards to distributes.
    /// @param _stakeOwners address[] The addresses of the stake owners.
    /// @param _amounts uint256[] The amounts of the rewards.
    function distributeRewards(uint256 _totalAmount, address[] calldata _stakeOwners, uint256[] calldata _amounts) external
        onlyWhenAcceptingNewStakes {
        require(_totalAmount > 0, "StakingContract::distributeRewards - total amount must be greater than 0");

        uint256 stakeOwnersLength = _stakeOwners.length;
        uint256 amountsLength = _amounts.length;

        require(stakeOwnersLength > 0 && amountsLength > 0,
            "StakingContract::distributeRewards - lists can't be empty");
        require(stakeOwnersLength == amountsLength,
            "StakingContract::distributeRewards - lists must be of the same size");

        // Transfer all the tokens to the smart contract and update the stake owners list accordingly.
        require(token.transferFrom(msg.sender, address(this), _totalAmount),
            "StakingContract::distributeRewards - insufficient allowance");

        uint256 expectedTotalAmount = 0;
        for (uint i = 0; i < stakeOwnersLength; ++i) {
            address stakeOwner = _stakeOwners[i];
            uint256 amount = _amounts[i];

            require(stakeOwner != address(0), "StakingContract::distributeRewards - stake owner can't be 0");
            require(amount > 0, "StakingContract::distributeRewards - amount must be greater than 0");

            Stake storage stakeData = stakes[stakeOwner];
            stakeData.amount = stakeData.amount.add(amount);

            expectedTotalAmount = expectedTotalAmount.add(amount);

            emit Staked(stakeOwner, amount, stakeData.amount);
        }

        require(_totalAmount == expectedTotalAmount, "StakingContract::distributeRewards - incorrect total amount");

        totalStakedTokens = totalStakedTokens.add(_totalAmount);

        // We will postpone stake change notifications to after we've finished updating the stakes, in order make sure
        // that any external call is made after every check and effect have took place. Unfortunately, this results in
        // duplicating the loop.
        for (uint i = 0; i < stakeOwnersLength; ++i) {
            notifyStakeChange(_stakeOwners[i]);
        }
    }

    /// @dev Returns the stake of the specified stake owner (excluding unstaked tokens).
    /// @param _stakeOwner address The address to check.
    /// @return uint256 The stake of the stake owner.
    function getStakeBalanceOf(address _stakeOwner) external view returns (uint256) {
        return stakes[_stakeOwner].amount;
    }

    /// @dev Returns the total amount staked tokens (excluding unstaked tokens).
    /// @return uint256 The total staked tokens of all stake owners.
    function getTotalStakedTokens() external view returns (uint256) {
        return totalStakedTokens;
    }

    /// @dev Returns the time that the cooldown period ends (or ended) and the amount of tokens to be released.
    /// @param _stakeOwner address The address to check.
    /// @return cooldownAmount uint256 The total tokens in cooldown.
    /// @return cooldownEndTime uint256 The time when the cooldown period ends (in seconds).
    function getUnstakeStatus(address _stakeOwner) external view returns (uint256 cooldownAmount,
        uint256 cooldownEndTime) {
        Stake memory stakeData = stakes[_stakeOwner];
        cooldownAmount = stakeData.cooldownAmount;
        cooldownEndTime = stakeData.cooldownEndTime;
    }

    /// @dev Returns the address of the underlying staked token.
    /// @return IERC20 The address of the token.
    function getToken() external view returns (IERC20) {
        return token;
    }

    /// @dev Requests the contract to stop accepting new staking requests.
    function stopAcceptingNewStakes() external onlyEmergencyManager onlyWhenAcceptingNewStakes {
        acceptingNewStakes = false;

        emit StoppedAcceptingNewStake();
    }

    /// @dev Requests the contract to release all stakes.
    function releaseAllStakes() external onlyEmergencyManager onlyWhenStakesNotReleased {
        releasingAllStakes = true;

        emit ReleasedAllStakes();
    }

    /// @dev Requests withdraw of released tokens of a list of addresses.
    /// @param _stakeOwners address[] The addresses of the stake owners.
    function withdrawReleasedStakes(address[] calldata _stakeOwners) external onlyWhenStakesReleased {
        uint256 stakeOwnersLength = _stakeOwners.length;
        for (uint i = 0; i < stakeOwnersLength; ++i) {
            address stakeOwner = _stakeOwners[i];

            (uint256 withdrawnAmount, uint256 totalStakedAmount) = withdraw(stakeOwner);

            emit Withdrew(stakeOwner, withdrawnAmount, totalStakedAmount);
        }

        // We will postpone stake change notifications to after we've finished updating the stakes, in order make sure
        // that any external call is made after every check and effect have took place. Unfortunately, this results in
        // duplicating the loop.
        for (uint i = 0; i < stakeOwnersLength; ++i) {
            notifyStakeChange(_stakeOwners[i]);
        }
    }

    /// @dev Returns whether a specific staking contract was approved as a migration destination.
    /// @param _stakingContract IMigratableStakingContract The staking contract to look for.
    /// @return exists bool The approval status.
    function isApprovedStakingContract(IMigratableStakingContract _stakingContract) public view returns (bool exists) {
        (, exists) = findApprovedStakingContractIndex(_stakingContract);
    }

    /// @dev Notifies of stake change event.
    /// @param _stakeOwner address The address of the subject stake owner.
    function notifyStakeChange(address _stakeOwner) internal {
        if (address(notifier) == address(0)) {
            return;
        }

        // In order to handle the case when the stakeChange method reverts, we will invoke it using EVM call and check
        // its returned value.

        // solhint-disable avoid-low-level-calls
        (bool success,) = address(notifier).call.gas(STAKE_CHANGE_NOTIFICATION_GAS_LIMIT)(abi.encodeWithSelector(
            notifier.stakeChange.selector, _stakeOwner));
        if (!success) {
            emit StakeChangeNotificationFailed(notifier);
        }
        // solhint-enable avoid-low-level-calls
    }

    /// @dev Stakes amount of ORBS tokens on behalf of the specified stake owner.
    /// @param _stakeOwner address The specified stake owner.
    /// @param _amount uint256 The amount of tokens to stake.
    /// @return totalStakedAmount uint256 The total stake of the stake owner.
    function stake(address _stakeOwner, uint256 _amount) private returns (uint256 totalStakedAmount) {
        require(_stakeOwner != address(0), "StakingContract::stake - stake owner can't be 0");
        require(_amount > 0, "StakingContract::stake - amount must be greater than 0");

        Stake storage stakeData = stakes[_stakeOwner];
        stakeData.amount = stakeData.amount.add(_amount);

        totalStakedTokens = totalStakedTokens.add(_amount);

        totalStakedAmount = stakeData.amount;

        // Transfer the tokens to the smart contract and update the stake owners list accordingly.
        require(token.transferFrom(msg.sender, address(this), _amount),
            "StakingContract::stake - insufficient allowance");
    }

    /// @dev Requests to withdraw all of staked ORBS tokens back to the specified stake owner. Stake owners can withdraw
    /// their ORBS tokens only after previously unstaking them and after the cooldown period has passed (unless the
    /// contract was requested to release all stakes).
    /// @return withdrawnAmount uint256 The withdrawn token amount.
    /// @return stakedAmount uint256 The remaining staked tokens amount.
    function withdraw(address _stakeOwner) private returns (uint256 withdrawnAmount, uint256 stakedAmount) {
        require(_stakeOwner != address(0), "StakingContract::withdraw - stake owner can't be 0");

        Stake storage stakeData = stakes[_stakeOwner];
        stakedAmount = stakeData.amount;

        withdrawnAmount = stakeData.cooldownAmount;

        if (!releasingAllStakes) {
            require(withdrawnAmount > 0, "StakingContract::withdraw - no unstaked tokens");
            require(stakeData.cooldownEndTime <= now, "StakingContract::withdraw - tokens are still in cooldown");
        } else {
            // If the contract was requested to release all stakes - allow to withdraw all staked and unstaked tokens.
            withdrawnAmount = withdrawnAmount.add(stakedAmount);

            require(withdrawnAmount > 0, "StakingContract::withdraw - no staked or unstaked tokens");

            stakeData.amount = 0;

            totalStakedTokens = totalStakedTokens.sub(stakedAmount);

            stakedAmount = 0;
        }

        stakeData.cooldownAmount = 0;
        stakeData.cooldownEndTime = 0;

        require(token.transfer(_stakeOwner, withdrawnAmount), "StakingContract::withdraw - couldn't transfer stake");
    }

    /// @dev Returns an index of an existing approved staking contract.
    /// @param _stakingContract IMigratableStakingContract The staking contract to look for.
    /// @return index uint The index of the located staking contract (in the case that it was found).
    /// @return exists bool The search result.
    function findApprovedStakingContractIndex(IMigratableStakingContract _stakingContract) private view returns
        (uint index, bool exists) {
        uint length = approvedStakingContracts.length;
        for (index = 0; index < length; ++index) {
            if (approvedStakingContracts[index] == _stakingContract) {
                exists = true;
                return (index, exists);
            }
        }

        exists = false;
    }
}
