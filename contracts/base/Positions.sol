//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract StakingPositions is ERC721Enumerable, Ownable {
  using Counters for Counters.Counter;
  Counters.Counter private _tokenIds;

  event PositionsMinted(address user, uint256 mintIndex);

  struct Positions {
    uint256 amount;
    uint64 end;
  }

  string public baseURI;
  mapping(uint256 => Positions) public tokenIdAttr;
  mapping(address => bool) public allowedTransfer;

  constructor()
  ERC721("Position", "StakePosition") {}
  

  function mintPosition(address user, uint256 amount, uint64 end) public onlyOwner {

    // initialize tokenId
    uint256 mintIndex = _tokenIds.current();
    
    // mint
    _safeMint(user, mintIndex);

    // init attributes for path
    tokenIdAttr[mintIndex] = Positions(amount, end);

    // increment id counter
    _tokenIds.increment();
    emit PositionsMinted(user, mintIndex);

  }

  function mintMultiple(address[] memory users, uint256[] memory amounts, uint64[] memory ends) external onlyOwner {
    uint256 address_length = users.length;
    // uint256 amount_length = amounts.length;
    // uint256 ends_length = ends.length;

    for(uint256 i = 0; i < address_length; i++) {
        mintPosition(users[i], amounts[i], ends[i]);
    }
  }

  function readPosition(uint256 tokenid) external view returns (uint256, uint64) {
    return (tokenIdAttr[tokenid].amount,  tokenIdAttr[tokenid].end);
  }

  function setBaseURI(string memory uri) public onlyOwner {
    baseURI = uri;
  }

  function _baseURI() internal view override returns (string memory) {
    return baseURI;
  }

  function totalSupply() public view override returns (uint256) {
    return _tokenIds.current();
  }

  function setTransferAddress(address _address) external onlyOwner {
    allowedTransfer[_address] = true;
  }

  function withdraw() external onlyOwner {
    uint256 balance = address(this).balance;
    payable(msg.sender).transfer(balance);
  }

  function _transfer(
      address from,
      address to,
      uint256 tokenId
  ) internal override {
      require(allowedTransfer[to], "Can only transfer NFT to specified addresses");
      super._transfer(from, to, tokenId);
    }
}