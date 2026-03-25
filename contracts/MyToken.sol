// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

// custom ERC20 token (asset being vested). this should : 
// 1. create the token
// 2. assign the initial supply to the owner
// 3. support ERC-20 functions - approve, transfer and transferFrom

// it acts like a ledger yo know how many tokens are owned by who

contract MyToken {
    // constructor arguments
    uint256 public totalSupply;
    string public name;
    string public symbol;
    uint8 public decimals;

        constructor(
        uint256 _totalSupply,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) {
        totalSupply = _totalSupply;
        balanceOf[msg.sender] = _totalSupply;
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    // state variables
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // events
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool){
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
}
