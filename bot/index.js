'use strict';

/* INITIALIZE */
const Web3 = require('web3');
const TronWeb = require('tronweb');
const ETH_CONTRACT_ABI = require('./lib/CrossChainTransferABI.json');

/* CONSTANTS */
const TRON_NODE = process.env.TRON_NODE;
const HXYT_ADDRESS = process.env.HXYT_TOKEN_ADDRESS; // Unused in this application
const TRON_CONTRACT_ADDRESS = process.env.TRON_CONTRACT_ADDRESS; // Remember to seed me!

/* INITIALIZE ETH */
const web3Http = new Web3(process.env.WEB3_HTTP_ENV);
const web3 = new Web3(process.env.WEB3_ENV);
const ETH_CONTRACT_ADDRESS = process.env.ETH_CONTRACT_ADDRESS;

const ethContract = new web3Http.eth.Contract(
  ETH_CONTRACT_ABI,
  ETH_CONTRACT_ADDRESS
);

/* TRX BOT ACCOUNT */
/* Remember to seed me! */
const BOT_PRIVATE_KEY = process.env.TRON_BOT_PK; // Made at https://tronpaperwallet.org/wallet.html
const BOT_ADDRESS = process.env.TRON_BOT_ADDRESS;

/* INITIALIZE TRON */
const FULL_NODE = TRON_NODE;
const SOLIDITY_NODE = TRON_NODE;
const EVENT_SERVER = TRON_NODE;

const tronWeb = new TronWeb(
  FULL_NODE,
  SOLIDITY_NODE,
  EVENT_SERVER,
  BOT_PRIVATE_KEY
);

const transfer = async (contract, id, receiver, tokens) => {
  const lastId = parseInt(await contract.lastId().call(), 10);
  console.log('Last successful transfer id', lastId);
  if (id > lastId) {
    console.log('Performing transfer...');
    console.log('Details', { id, receiver, tokens });
    await contract.triggerOutgoingTransfer(id, tokens, receiver).send({});
    console.log('Done!');
  } else {
    console.log('Transfer already completed, duplicate transfer prevented.');
  }
};

const now = () => {
  const today = new Date();
  const date =
    today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
  const time =
    today.getHours() + ':' + today.getMinutes() + ':' + today.getSeconds();

  return date + ' ' + time;
};

let syncing = false;
const run = async () => {
  const tronContract = await tronWeb.contract().at(TRON_CONTRACT_ADDRESS);

  if (!tronContract) {
    console.log(
      'Failed to initialize tron contract, please check your network connection'
    );
    return;
  }

  setInterval(async () => {
    if (syncing) {
      console.log('Performing actions... will resume once done.');
      return;
    }
    // Check if mismatch between nextId (eth) and lastId (trx)
    // If mismatch- perform transfers
    const nextId = parseInt(await ethContract.methods.nextId().call(), 10);
    const lastId = parseInt(await tronContract.lastId().call(), 10);

    const transferId = lastId + 1;
    const lastTransferId = nextId - 1;

    console.log(
      `${now()}:\tWaiting for transfers. ETH ID: ${lastTransferId}, NEXT TRX ID: ${transferId}`
    );

    if (transferId <= lastTransferId) {
      // We're behind in transfers, lets sync
      syncing = true;
      // Fetch data from eth
      const data = await ethContract.methods.transferGroups(transferId).call();

      if (!data || !data.receiver || !data.tokens) {
        console.log(
          'Failed to fetch data from eth network for transfer group',
          transferId
        );
        syncing = false;
        return;
      }

      const tokens = parseInt(data.tokens, 10);
      const receiver = data.receiver;

      // Perform transfer on tron
      await transfer(tronContract, transferId, receiver, tokens);
      syncing = false;
    } else {
      syncing = false; // Done syncing, lets resume
    }
  }, 2000);
};

run();
