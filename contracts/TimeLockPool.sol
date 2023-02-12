// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./base/BasePool.sol";
import "./interfaces/ITimeLockPool.sol";

import "hardhat/console.sol";


contract TimeLockPool is BasePool, ITimeLockPool, Ownable {
    using Math for uint256;
    using SafeERC20 for IERC20;

    uint256 public immutable maxBonus;
    uint256 public immutable maxLockDuration;
    uint256 public constant MIN_LOCK_DURATION = 10 minutes;
    bool public isAllowPositionStaking = true;
    bool public isAllowDeposits = true;
    bool public isAdminUnlock = false;
    uint256 startTime = 1676584800;
    uint256 daysSinceStart = 0;
    uint256[] public curve;
    uint256 public unit;

    error MaxBonusError();
    error ShortCurveError();
    error CurveIncreaseError();

    mapping(address => Deposit[]) public depositsOf;
    mapping(address => PositionDeposit[]) public positionDepositsOf;
    mapping(uint256 => PositionDeposit) public positionOwnerOf;
    mapping(uint256 => uint256[]) public expiringPositions;

    struct Deposit {
        uint256 amount;
        uint64 start;
        uint64 end;
    }

    struct PositionDeposit {
        uint256 tokenId;
        uint256 shares;
        uint64 end;
        address owner;
    }
    constructor(
        string memory _name,
        string memory _symbol,
        address _depositToken,
        address _depositOldPosition,
        address _rewardToken,
        address _escrowPool,
        uint256 _escrowPortion,
        uint256 _escrowDuration,
        uint256 _maxBonus,
        uint256 _maxLockDuration,
        uint256[] memory _curve
    ) BasePool(_name, _symbol, _depositToken, _depositOldPosition, _rewardToken, _escrowPool, _escrowPortion, _escrowDuration) {
        require(_maxLockDuration >= MIN_LOCK_DURATION, "TimeLockPool.constructor: max lock duration must be greater or equal to mininmum lock duration");
        maxBonus = _maxBonus;
        maxLockDuration = _maxLockDuration;
        checkCurve(_curve);
        for (uint i=0; i < _curve.length; i++) {
            if (_curve[i] > _maxBonus) {
                revert MaxBonusError();
            }
            curve.push(_curve[i]);
        }
        unit = _maxLockDuration / (curve.length - 1);

    }

    event Deposited(uint256 amount, uint256 duration, address indexed receiver, address indexed from);
    event Withdrawn(uint256 indexed depositId, address indexed receiver, address indexed from, uint256 amount);
    event DepositedPosition(uint256 amount, uint64 end, uint256 duration, uint256 mintAmount, address indexed _receiver, address indexed from);
    event CurveChanged(address indexed sender);


    function deposit(uint256 _amount, uint256 _duration, address _receiver) external override {
        require(isAllowDeposits, "Cannot deposit now");
        require(_amount > 0, "TimeLockPool.deposit: cannot deposit 0");
        // Don't allow locking > maxLockDuration
        uint256 duration = _duration.min(maxLockDuration);
        // Enforce min lockup duration to prevent flash loan or MEV transaction ordering
        duration = duration.max(MIN_LOCK_DURATION);

        depositToken.safeTransferFrom(_msgSender(), address(this), _amount);

        depositsOf[_receiver].push(Deposit({
            amount: _amount,
            start: uint64(block.timestamp),
            end: uint64(block.timestamp) + uint64(duration)
        }));

        uint256 mintAmount = _amount * getMultiplier(duration) / 1e18;

        _mint(_receiver, mintAmount);
        emit Deposited(_amount, duration, _receiver, _msgSender());
    }

    function depositPositions(uint256 tokenId, uint256 _duration, address _receiver) external {
        require(isAllowDeposits, "Cannot deposit now");
        require(isAllowPositionStaking, "Position Staking is not allowed");
        require(depositOldPosition != address(0), "Position NFT contract must be set");
        require(stakePosition.ownerOf(tokenId) == _receiver, "Need to be owner of token to stake");
        // Don't allow locking > maxLockDuration
        uint256 duration = _duration.min(maxLockDuration);
        // Enforce min lockup duration to prevent flash loan or MEV transaction ordering
        duration = duration.max(MIN_LOCK_DURATION);

        stakePosition.transferFrom(_msgSender(), address(this), tokenId);

        uint256 amount;
        uint64 end;

        (amount, end) = stakePosition.readPosition(tokenId);
        require(end > block.timestamp, "Cannot stake expired positions");

        uint256 mintAmount = amount * getMultiplier(duration) / 1e18;


        PositionDeposit memory positionDeposit = PositionDeposit({
            tokenId: tokenId,
            shares: mintAmount,
            end: end,
            owner: _receiver
        });

        positionDepositsOf[_receiver].push(positionDeposit);

        positionOwnerOf[tokenId] = positionDeposit;
        expiringPositions[calculateExpringPosition(end)].push(tokenId);

        _mint(_receiver, mintAmount);
        emit DepositedPosition(amount, end, duration, mintAmount, _receiver, _msgSender());
    }

    function withdraw(uint256 _depositId, address _receiver) external {
        require(_depositId < depositsOf[_msgSender()].length, "TimeLockPool.withdraw: Deposit does not exist");
        Deposit memory userDeposit = depositsOf[_msgSender()][_depositId];
        if (!isAdminUnlock) {
            require(block.timestamp >= userDeposit.end, "TimeLockPool.withdraw: too soon");
        }
        // No risk of wrapping around on casting to uint256 since deposit end always 
        // > deposit start and types are 64 bits
        uint256 shareAmount = userDeposit.amount * getMultiplier(uint256(userDeposit.end - userDeposit.start)) / 1e18;

        // remove Deposit
        depositsOf[_msgSender()][_depositId] = depositsOf[_msgSender()][depositsOf[_msgSender()].length - 1];
        depositsOf[_msgSender()].pop();

        // burn pool shares
        _burn(_msgSender(), shareAmount);
        
        // return tokens
        depositToken.safeTransfer(_receiver, userDeposit.amount);
        emit Withdrawn(_depositId, _receiver, _msgSender(), userDeposit.amount);
    }

    function getMultiplier(uint256 _lockDuration) public view returns(uint256) {

        uint n = _lockDuration / unit;
        if (n == curve.length - 1) {
            return 1e18 + curve[n];
        }
        return 1e18 + curve[n] + (_lockDuration - n * unit) * (curve[n + 1] - curve[n]) / unit;
    }


    function getTotalDeposit(address _account) public view returns(uint256) {
        uint256 total;
        for(uint256 i = 0; i < depositsOf[_account].length; i++) {
            total += depositsOf[_account][i].amount;
        }

        return total;
    }

    function getDepositsOf(address _account) public view returns(Deposit[] memory) {
        return depositsOf[_account];
    }

    function getDepositsOfLength(address _account) public view returns(uint256) {
        return depositsOf[_account].length;
    }

    function calculateExpringPosition(uint256 endTime) internal view returns(uint256) {
        return (endTime - startTime) / 86400;
    }

    function calculateDaysSinceStart(uint256 time) internal view returns (uint256) {
        uint256 timeSinceStart = time - startTime;
        return bankersRoundedDiv(timeSinceStart, 86400);
    }

    function adjustPositionStaking() external onlyGov {
        isAllowPositionStaking = !isAllowPositionStaking;
    }

    function adjustDeposits() external onlyGov {
        isAllowDeposits = !isAllowDeposits;
    }

    function adjustAdminUnlock() external onlyGov {
        isAdminUnlock = !isAdminUnlock;
    }

    function adjustShares(uint256 time) public onlyGov {
        uint256 burnsharesindex = calculateDaysSinceStart(time);
        uint256 sharesToBurnLen = expiringPositions[burnsharesindex].length;
        if (sharesToBurnLen != 0) {
            for (uint i =  sharesToBurnLen; i > 0 ; i--) {
            uint256 tokenToBurn = expiringPositions[burnsharesindex][i-1];
            address owner = positionOwnerOf[tokenToBurn].owner;
            uint256 shareAmount = positionOwnerOf[tokenToBurn].shares;
            _burn(owner, shareAmount);
            delete positionOwnerOf[tokenToBurn];
                    // remove Deposit
            expiringPositions[burnsharesindex].pop();
            }
        }
    }

    function burnExpiredPositions(uint256 key, uint256 maxIndex) external onlyGov {
        require(expiringPositions[key].length >= maxIndex);
        uint256 sharesToBurnLen = expiringPositions[key].length;
        if (sharesToBurnLen != 0) {
            for (uint i =  maxIndex - 1; i >= 0 ; i--) {
            uint256 tokenToBurn = expiringPositions[key][i];
            address owner = positionOwnerOf[tokenToBurn].owner;
            uint256 shareAmount = positionOwnerOf[tokenToBurn].shares;
            _burn(owner, shareAmount);
            delete positionOwnerOf[tokenToBurn];
                    // remove Deposit
            expiringPositions[key].pop();
            }
        }
    }


     function bankersRoundedDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "div by 0"); 

        uint256 halfB = 0;
        if ((b % 2) == 1) {
            halfB = (b / 2) + 1;
        } else {
            halfB = b / 2;
        }
        bool roundUp = ((a % b) >= halfB);

        // now check if we are in the center!
        bool isCenter = ((a % b) == (b / 2));
        bool isDownEven = (((a / b) % 2) == 0);

        // select the rounding type
        if (isCenter) {
            // only in this case we rounding either DOWN or UP 
            // depending on what number is even 
            roundUp = !isDownEven;
        }

        // round
        if (roundUp) {
            return ((a / b) + 1);
        }else{
            return (a / b);
        }
    }

    function distributeRewards(uint256 _amount) public override onlyGov {
        rewardToken.safeTransferFrom(_msgSender(), address(this), _amount);
        adjustShares(block.timestamp);
        super.distributeRewards(_amount);
    }


    function maxBonusError(uint256 _point) internal view returns(uint256) {
        if (_point > maxBonus) {
            revert MaxBonusError();
        } else {
            return _point;
        }
    }
        /**
     * @notice Can set an entire new curve.
     * @dev This function can change current curve by a completely new one. By doing so, it does not
     * matter if the new curve's length is larger, equal, or shorter because the function manages
     * all of those cases.
     * @param _curve uint256 array of the points that compose the curve.
     */
    function setCurve(uint256[] calldata _curve) external onlyGov {
        // same length curves
        if (curve.length == _curve.length) {
            for (uint i=0; i < curve.length; i++) {
                curve[i] = maxBonusError(_curve[i]);
            }
        // replacing with a shorter curve
        } else if (curve.length > _curve.length) {
            for (uint i=0; i < _curve.length; i++) {
                curve[i] = maxBonusError(_curve[i]);
            }
            uint initialLength = curve.length;
            for (uint j=0; j < initialLength - _curve.length; j++) {
                curve.pop();
            }
            unit = maxLockDuration / (curve.length - 1);
        // replacing with a longer curve
        } else {
            for (uint i=0; i < curve.length; i++) {
                curve[i] = maxBonusError(_curve[i]);
            }
            uint initialLength = curve.length;
            for (uint j=0; j < _curve.length - initialLength; j++) {
                curve.push(maxBonusError(_curve[initialLength + j]));
            }
            unit = maxLockDuration / (curve.length - 1);
        }
        checkCurve(curve);
        emit CurveChanged(_msgSender());
    }

    /**
     * @notice Can set a point of the curve.
     * @dev This function can replace any point in the curve by inputing the existing index,
     * add a point to the curve by using the index that equals the amount of points of the curve,
     * and remove the last point of the curve if an index greater than the length is used. The first
     * point of the curve index is zero.
     * @param _newPoint uint256 point to be set.
     * @param _position uint256 position of the array to be set (zero-based indexing convention).
     */
    function setCurvePoint(uint256 _newPoint, uint256 _position) external onlyGov {
        if (_newPoint > maxBonus) {
            revert MaxBonusError();
        }
        if (_position < curve.length) {
            curve[_position] = _newPoint;
        } else if (_position == curve.length) {
            curve.push(_newPoint);
            unit = maxLockDuration / (curve.length - 1);
        } else {
            if (curve.length - 1 < 2) {
                revert ShortCurveError();
            }
            curve.pop();
            unit = maxLockDuration / (curve.length - 1);
        }
        checkCurve(curve);
        emit CurveChanged(_msgSender());
    }

    function checkCurve(uint256[] memory _curve) internal pure {
        if (_curve.length < 2) {
            revert ShortCurveError();
        }
        for (uint256 i; i < _curve.length - 1; ++i) {
            if (_curve[i + 1] < _curve[i]) {
                revert CurveIncreaseError();
            }
        }
    }
}