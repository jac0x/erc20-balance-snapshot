import { BigDecimal, Bytes, ethereum } from '@graphprotocol/graph-ts'

import { ERC20, Transfer } from '../../generated/templates/StandardToken/ERC20'
import { Burn } from '../../generated/templates/BurnableToken/Burnable'
import { Mint } from '../../generated/templates/MintableToken/Mintable'

import { Token } from '../../generated/schema'

import { toDecimal, ONE, ZERO } from '../helpers/number'
import { decodeFlags, DEFAULT_DECIMALS } from '../helpers/token'

import {
  decreaseAccountBalance,
  getOrCreateAccount,
  increaseAccountBalance,
  saveAccountBalanceSnapshot,
} from './account'

const GENESIS_ADDRESS = '0x0000000000000000000000000000000000000000'

export function fetchTokenDetails(event: ethereum.Event): Token | null {
  //check if token details are already saved
  let token = Token.load(event.address.toHex());
  if (!token) {
    //if token details are not available
    //create a new token
    token = new Token(event.address.toHex());

    //set some default values
    token.name = "N/A";
    token.symbol = "N/A";
    token.decimals = DEFAULT_DECIMALS;

    //bind the contract
    let erc20 = ERC20.bind(event.address);

    //fetch name
    let tokenName = erc20.try_name();
    if (!tokenName.reverted) {
      token.name = tokenName.value;
    }

    //fetch symbol
    let tokenSymbol = erc20.try_symbol();
    if (!tokenSymbol.reverted) {
      token.symbol = tokenSymbol.value;
    }

    //fetch decimals
    let tokenDecimal = erc20.try_decimals();
    if (!tokenDecimal.reverted) {
      token.decimals = tokenDecimal.value;
    }

    token.address = event.address;
    token.flags = decodeFlags(0);
    
    token.eventCount = ZERO;
    token.burnEventCount = ZERO;
    token.mintEventCount = ZERO;
    token.transferEventCount = ZERO;

    let initialSupply = erc20.try_totalSupply();
    token.totalSupply = initialSupply.reverted ? ZERO.toBigDecimal() : toDecimal(initialSupply.value, token.decimals);
    token.totalBurned = ZERO.toBigDecimal();
    token.totalMinted = ZERO.toBigDecimal();
    token.totalTransferred = ZERO.toBigDecimal();

    //save the details
    token.save();
  }
  return token;
}

export function handleTransfer(event: Transfer): void {
  let token = fetchTokenDetails(event)

  if (token != null) {
    let amount = toDecimal(event.params.value, token.decimals)

    let isBurn = /*token.flags.includes('burnable-transfer') &&*/ event.params.to.toHex() == GENESIS_ADDRESS
    let isMint = /*token.flags.includes('mintable-transfer') &&*/ event.params.from.toHex() == GENESIS_ADDRESS
    let isTransfer = !isBurn && !isMint


    if (isBurn) {
      handleBurnEvent(token, amount, event.params.from, event)
    } else if (isMint) {
      handleMintEvent(token, amount, event.params.to, event)
    } else if (isTransfer) {
      handleTransferEvent(token, amount, event.params.from, event.params.to, event)
    }

    // Updates balances of accounts
    if (isTransfer || isBurn) {
      let sourceAccount = getOrCreateAccount(event.params.from)

      let accountBalance = decreaseAccountBalance(sourceAccount, token as Token, amount)
      accountBalance.block = event.block.number
      accountBalance.modified = event.block.timestamp
      accountBalance.transaction = event.transaction.hash

      sourceAccount.save()
      accountBalance.save()

      // To provide information about evolution of account balances
      saveAccountBalanceSnapshot(accountBalance, event)
    }

    if (isTransfer || isMint) {
      let destinationAccount = getOrCreateAccount(event.params.to)

      let accountBalance = increaseAccountBalance(destinationAccount, token as Token, amount)
      accountBalance.block = event.block.number
      accountBalance.modified = event.block.timestamp
      accountBalance.transaction = event.transaction.hash

      destinationAccount.save()
      accountBalance.save()

      // To provide information about evolution of account balances
      saveAccountBalanceSnapshot(accountBalance, event)
    }
  }
}

export function handleBurn(event: Burn): void {
  let token = fetchTokenDetails(event)

  if (token != null) {
    let amount = toDecimal(event.params.value, token.decimals)

    // Persist burn event log
    handleBurnEvent(token, amount, event.params.burner, event)

    // Update source account balance
    let account = getOrCreateAccount(event.params.burner)

    let accountBalance = decreaseAccountBalance(account, token as Token, amount)
    accountBalance.block = event.block.number
    accountBalance.modified = event.block.timestamp
    accountBalance.transaction = event.transaction.hash

    account.save()
    accountBalance.save()

    // To provide information about evolution of account balances
    saveAccountBalanceSnapshot(accountBalance, event)
  }
}

export function handleMint(event: Mint): void {
  let token = fetchTokenDetails(event)

  if (token != null) {
    let amount = toDecimal(event.params.amount, token.decimals)

    // Persist mint event log
    handleMintEvent(token, amount, event.params.to, event)

    // Update destination account balance
    let account = getOrCreateAccount(event.params.to)

    let accountBalance = increaseAccountBalance(account, token as Token, amount)
    accountBalance.block = event.block.number
    accountBalance.modified = event.block.timestamp
    accountBalance.transaction = event.transaction.hash

    account.save()
    accountBalance.save()

    // To provide information about evolution of account balances
    saveAccountBalanceSnapshot(accountBalance, event)
  }
}

function handleBurnEvent(token: Token | null, amount: BigDecimal, burner: Bytes, event: ethereum.Event): void {
  

  // // Track total supply/burned
  // if (token != null) {
  //   token.eventCount = token.eventCount.plus(ONE)
  //   token.burnEventCount = token.burnEventCount.plus(ONE)
  //   token.totalSupply = token.totalSupply.minus(amount)
  //   token.totalBurned = token.totalBurned.plus(amount)
  //   token.save()
  // }

}

function handleMintEvent(token: Token | null, amount: BigDecimal, destination: Bytes, event: ethereum.Event): void {


  // // Track total token supply/minted
  // if (token != null) {
  //   token.eventCount = token.eventCount.plus(ONE)
  //   token.mintEventCount = token.mintEventCount.plus(ONE)
  //   token.totalSupply = token.totalSupply.plus(amount)
  //   token.totalMinted = token.totalMinted.plus(amount)

  //   token.save()
  // }

}

function handleTransferEvent(
  token: Token | null,
  amount: BigDecimal,
  source: Bytes,
  destination: Bytes,
  event: ethereum.Event,
): void {


  // // Track total token transferred
  // if (token != null) {
  //   token.eventCount = token.eventCount.plus(ONE)
  //   token.transferEventCount = token.transferEventCount.plus(ONE)
  //   token.totalTransferred = token.totalTransferred.plus(amount)

  //   token.save()
  // }

}
