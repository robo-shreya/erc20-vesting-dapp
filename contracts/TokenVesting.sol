    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.18;

    // this should -
    // 1. know the beneficiary & token address
    // 2. store vesting params
    // 3. receive the tokens from owner 
    // 4. calculate how much has already been vested
    // 5. let the beneficiary claim

    import "./MyToken.sol";

    contract TokenVesting {
        // constructor arguments
        address public owner;
        address public beneficiary;
        MyToken public token;
        uint256 public start;
        uint256 public cliffDuration;
        uint256 public duration;
        uint256 public totalAllocation;

        constructor(
            address _beneficiary,
            address _token,
            uint256 _start,
            uint256 _duration,
            uint256 _cliffDuration,
            uint256 _totalAllocation
        ){  
            require(_beneficiary!= address(0), "beneficiary address is 0");
            beneficiary = _beneficiary;

            require(_token != address(0), "token address is 0");
            token = MyToken(_token);

            start = _start;

            require(_duration > 0, "duration is 0");
            duration = _duration;

            require(_cliffDuration < duration, "cliff duration cannot be more than total duration");
            cliffDuration = _cliffDuration;

            require(_totalAllocation > 0);
            totalAllocation = _totalAllocation;

            owner = msg.sender;

        }

        // state variables
        uint256 public released;
        bool public funded;

        modifier onlyOwner{
            require (owner == msg.sender, "user is not the owner, action not permitted");
            _;
        }

        function fund() external onlyOwner {

            require(!funded, "already funded");
            
            // transfer already allocated funds from owner to this contract
            require (totalAllocation > 0, "invalid allocation");
        require(
            token.allowance(msg.sender, address(this)) >= totalAllocation,
            "insufficient token allowance"
        );
        require(
            token.balanceOf(msg.sender) >= totalAllocation,
            "insufficient owner token balance"
        );

        bool success = token.transferFrom(
            msg.sender, 
            address(this), 
                totalAllocation
            );

            require (success, "funding failed");

            funded = true;
        }

        modifier onlyBeneficiary{
            require(msg.sender == beneficiary, "callable only by the beneficiary");
            _;
        }

        modifier cliffEnded{
            require (block.timestamp >= start + cliffDuration, "wait for the cliff period to end");
            _;
        }

        modifier vestingEnded{
            // i don't see any use as a function, maybe for the frontend
            require(block.timestamp >= start + duration, "vesting in progress");
            _;
        }

        function claim() external onlyBeneficiary cliffEnded{

            require(funded, "not funded yet");

            uint256 claimableAmount = getClaimableAmount();

            require(claimableAmount > 0, "nothing to claim");

            released += claimableAmount;

            token.transfer(beneficiary, claimableAmount);

        }

        function partialClaim(uint256 amount) external onlyBeneficiary cliffEnded{
            
            require(funded, "not funded yet");

            uint256 claimableAmount = getClaimableAmount();

            require(claimableAmount > 0, "nothing to claim");

            require(amount <= claimableAmount, "too big to be claimed");

            released += amount;

            token.transfer(beneficiary, amount);

        }

        function getVestedAmount() public view cliffEnded returns (uint256){

            if(block.timestamp > start + duration) return totalAllocation;
            
            return totalAllocation * (block.timestamp - start) / duration;
        }

        function getClaimableAmount() public view returns (uint256){
            return getVestedAmount() - released;
        }

        // TODO Dshould I make an interface for token functions?
    }
