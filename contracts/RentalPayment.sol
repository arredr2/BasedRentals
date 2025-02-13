// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RentalPayment is ReentrancyGuard, Ownable {
    IERC20 public immutable usdc;
    
    struct Rental {
        address landlord;
        address tenant;
        string propertyDetails;
        uint256 monthlyRent;
        uint256 startDate;
        uint256 endDate;
        uint256 nextPaymentDue;
        bool isActive;
    }
    
    mapping(uint256 => Rental) public rentals;
    uint256 public rentalCount;
    
    event RentalCreated(
        uint256 indexed rentalId, 
        address indexed landlord, 
        address indexed tenant,
        string propertyDetails,
        uint256 monthlyRent
    );
    event RentPaid(
        uint256 indexed rentalId, 
        address indexed tenant,
        uint256 amount, 
        uint256 paymentDate
    );
    event RentalTerminated(uint256 indexed rentalId);
    
    constructor(address _usdcAddress) Ownable(msg.sender) {
        usdc = IERC20(_usdcAddress);
    }
    
    function createRental(
        address _tenant,
        string calldata _propertyDetails,
        uint256 _monthlyRent,
        uint256 _startDate,
        uint256 _endDate
    ) external returns (uint256) {
        require(_startDate < _endDate, "Invalid rental period");
        require(_monthlyRent > 0, "Invalid rent amount");
        
        uint256 rentalId = rentalCount++;
        
        rentals[rentalId] = Rental({
            landlord: msg.sender,
            tenant: _tenant,
            propertyDetails: _propertyDetails,
            monthlyRent: _monthlyRent,
            startDate: _startDate,
            endDate: _endDate,
            nextPaymentDue: _startDate,
            isActive: true
        });
        
        emit RentalCreated(
            rentalId, 
            msg.sender, 
            _tenant, 
            _propertyDetails, 
            _monthlyRent
        );
        return rentalId;
    }
    
    function payRent(uint256 _rentalId) external nonReentrant {
        Rental storage rental = rentals[_rentalId];
        require(rental.isActive, "Rental agreement not active");
        require(block.timestamp >= rental.nextPaymentDue, "Rent not due yet");
        
        require(
            usdc.transferFrom(msg.sender, rental.landlord, rental.monthlyRent),
            "USDC transfer failed"
        );
        
        rental.nextPaymentDue += 30 days;
        
        emit RentPaid(
            _rentalId,
            msg.sender,
            rental.monthlyRent,
            block.timestamp
        );
    }
    
    function terminateRental(uint256 _rentalId) external {
        Rental storage rental = rentals[_rentalId];
        require(
            msg.sender == rental.landlord || msg.sender == owner(),
            "Unauthorized"
        );
        require(rental.isActive, "Rental already terminated");
        
        rental.isActive = false;
        emit RentalTerminated(_rentalId);
    }
    
    function getRental(uint256 _rentalId) external view returns (
        address landlord,
        address tenant,
        string memory propertyDetails,
        uint256 monthlyRent,
        uint256 startDate,
        uint256 endDate,
        uint256 nextPaymentDue,
        bool isActive
    ) {
        Rental storage rental = rentals[_rentalId];
        return (
            rental.landlord,
            rental.tenant,
            rental.propertyDetails,
            rental.monthlyRent,
            rental.startDate,
            rental.endDate,
            rental.nextPaymentDue,
            rental.isActive
        );
    }

    function getRentalCount() external view returns (uint256) {
        return rentalCount;
    }
}
