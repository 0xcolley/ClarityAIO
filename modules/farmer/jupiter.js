import { Connection, Keypair, VersionedTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Wallet } from "@project-serum/anchor";
import { LimitOrderProvider } from "@jup-ag/limit-order-sdk";
import jup from '@jup-ag/dca-sdk';
import bs58 from "bs58";
import fetch from 'cross-fetch';
import chalk from "chalk";
import fs from "fs";
import axios from "axios";
import Web3 from "@solana/web3.js";
import path from 'path';

//Timestamp printing function
function getCurrentTimestamp() {
    return new Date().toLocaleString();
}

function getRandomSleepDuration(minSeconds, maxSeconds) {
    return Math.floor(Math.random() * (maxSeconds - minSeconds + 1) + minSeconds);
}

//MS randomization function
function random_in_range(min, max) {
    return Math.random() * (max - min) + min;
}

//String parsing ms to minutes/seconds
function millisToMinutesAndSeconds(millis) {
  var minutes = Math.floor(millis / 60000);
  var seconds = ((millis % 60000) / 1000).toFixed(0);
  return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
}

//temp config path since calling context is local
function loadConfig() {
    // Combine __dirname with 'config.json'
    const configPath = path.join('config.json');
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
}
  
const config_obj = loadConfig();

const SOL = 'So11111111111111111111111111111111111111112';
const mSOL = 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So';
const bSOL = 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1';
const jitoSOL = 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn';
const LST = 'LSTxxxnJzKDFSLr4dUkPcmCf5VyryEqzPLz5j4bpxFp';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const tokens = {
    'So11111111111111111111111111111111111111112': 'SOL',
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'mSOL',
    'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1': 'bSOL',
    'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': 'jitoSOL',
    'LSTxxxnJzKDFSLr4dUkPcmCf5VyryEqzPLz5j4bpxFp': 'LST',
    'So11111111111111111111111111111111111111112': 'SOL',
};

const keypair = Keypair.fromSecretKey(bs58.decode(config_obj.private_key))
const wallet = new Wallet(keypair);
const connection = new Connection(config_obj.main_rpc, "confirmed");
const dca = new jup.DCA(connection, jup.Network.MAINNET);

//Working and tested, returns token balance for 9 decimal token in native integer
async function get_balance(token_address) {
    const response = await axios({
        url: config_obj.main_rpc,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: [
            {
              jsonrpc: "2.0",
              id: 1,
              method: "getTokenAccountsByOwner",
              params: [
                wallet.publicKey.toString(),
                {
                  mint: token_address,
                },
                {
                  encoding: "jsonParsed",
                },
              ],
            }
        ]
    });
    return (parseFloat(response.data[0].result.value[0].account.data.parsed.info.tokenAmount.amount)/1000000000);
}

//there should be a better and cleaner way to do this, this is the next edit
//currently working fine, maybe add recursive call on api failure
async function get_quote(inputMint, outputMint, lamports) {
    let quoteResponse;
    let attempts = 0;
    const maxAttempts = 5; // Maximum number of retries
    const delay = 3000; // Delay in milliseconds (1 second)

    while (!quoteResponse) {
        try {
            const response = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${lamports}&slippageBps=50`);
            if (!response.ok) { // Check if response status is OK
                console.log(chalk.red(`[${getCurrentTimestamp()}] Quote API Error: ${response.status}`));
            }
            quoteResponse = await response.json();

            // Check if quoteResponse is valid and does not contain an error
            if (quoteResponse.error) {
                console.log(chalk.red(`API Error: ${quoteResponse.error}`));
            }
            break;
        } catch (error) {
            attempts++;
            if (attempts >= maxAttempts) {
                console.log(chalk.red(`[${getCurrentTimestamp()}] Max Quote Attempts Reached`));
            }
            await new Promise(resolve => setTimeout(resolve, delay)); // Wait before retrying
        }
    }

    return quoteResponse;
}

//Working always IF get_quote works properly
async function get_swap_tx(quoteResponse) {
    const { swapTransaction } = await (
        await fetch('https://quote-api.jup.ag/v6/swap', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            quoteResponse,
            userPublicKey: wallet.publicKey.toString(),
            wrapAndUnwrapSol: true,
            computerUnitMicroLamports: 10003
          })
        })
      ).json()

      return swapTransaction;
}

//Working assuming passed numbers are correct according to account state
async function exec_swap(inputMint, outputMint, amount_sol) {
    try {
      const lamports = amount_sol * 1000000000;
  
      // Get quote
      console.log(chalk.cyan(`[SWAP][${getCurrentTimestamp()}] Getting quote for ${tokens[inputMint]} -> ${tokens[outputMint]}...`));
      
      let quoteResponse = await get_quote(inputMint, outputMint, lamports);
      let expectedOutputAmount = quoteResponse.outAmount;

      console.log(chalk.cyan(`[SWAP][${getCurrentTimestamp()}] Serializing and Sending TX...`))
      let swapTransaction = await get_swap_tx(quoteResponse);
      const swapTransactionBuf = Buffer.from(swapTransaction, "base64");

      var transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      transaction.sign([wallet.payer]);

      const rawTransaction = transaction.serialize();

      const confirmationStrategy = {
        commitment: "confirmed",
        confirmations: 3
    };

      const txid = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
        maxRetries: 2,
      });
      
      await connection.confirmTransaction(txid, confirmationStrategy);
      console.log(chalk.green(`[SWAP][${getCurrentTimestamp()}] Swap Transaction from ${tokens[inputMint]} -> ${tokens[outputMint]} confirmed for ${(expectedOutputAmount/1000000000).toFixed(3)} ${tokens[outputMint]}`));
      return expectedOutputAmount;
    }
    catch(error) {
        console.log('Swap encountered error: ', error)
    }
}

//Working as long as exec swap is passed correct numbers according to account state
async function farm_jup_volume(initial_sol){
    let amountSOL = initial_sol;

    const swapPairs = [
        { inputMint: 'So11111111111111111111111111111111111111112', outputMint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So' }, // SOL -> mSOL
        { inputMint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', outputMint: 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1' }, // mSOL -> bSOL
        { inputMint: 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1', outputMint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn' }, // bSOL -> jitoSOL
        { inputMint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', outputMint: 'LSTxxxnJzKDFSLr4dUkPcmCf5VyryEqzPLz5j4bpxFp' },  // jitoSOL -> LST
        { inputMint: 'LSTxxxnJzKDFSLr4dUkPcmCf5VyryEqzPLz5j4bpxFp', outputMint: 'So11111111111111111111111111111111111111112' }  // LST -> SOL
    ];

    while (true) {
        for (const pair of swapPairs) {
            try {
                const outputAmount = await exec_swap(pair.inputMint, pair.outputMint, amountSOL);
                amountSOL = outputAmount / LAMPORTS_PER_SOL;
                let swap_cooldown = random_in_range(420000, 600000);
                console.log(chalk.cyan(`[${getCurrentTimestamp()}] Sleeping for ${millisToMinutesAndSeconds(swap_cooldown)} minutes`));
                await new Promise(resolve => setTimeout(resolve, swap_cooldown));
            }
            catch(error){
                console.log(error)
            }
        }
    }
}

//In Testing progress to ensure can run multiple times with no error, once again requires correct values
//this is the cyclic version of this method and can be ran by itself
async function farm_jup_dca(sol_in) {
    const tokenAddresses = [
        'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL
        'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1', // bSOL
        'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', // jitoSOL
        'LSTxxxnJzKDFSLr4dUkPcmCf5VyryEqzPLz5j4bpxFp'  // LST
    ];

    const randomIndex = Math.floor(Math.random() * tokenAddresses.length);
    const randomMintOut = tokenAddresses[randomIndex];

    let lamports_in = sol_in * Math.pow(10, 9);
    let per_cycle = lamports_in / 5;
    while(true){
        let cycle_time = Math.round((getRandomSleepDuration(1800, 2400))/5) * 3;

        const params = {
            payer: wallet.publicKey.toString(),
            user: wallet.publicKey.toString(),
            inAmount: BigInt(lamports_in), 
            inAmountPerCycle: BigInt(per_cycle), 
            cycleSecondsApart: BigInt(cycle_time), // 1 hour (3600 seconds) TEMP TESTING DURATION SHOULD BE CYCLE TIME
            inputMint: SOL, // sell
            outputMint: randomMintOut, // buy
            minOutAmountPerCycle: null,
            maxOutAmountPerCycle: null,
            startAt: null, 
        };

        const { tx, dcaPubKey } = await dca.createDcaV2(params);
        const txid = await Web3.sendAndConfirmTransaction(connection, tx, [keypair]);
        console.log(chalk.cyan(`[DCA][${getCurrentTimestamp()}] Created ${tokens[randomMintOut]} DCA: ${txid}`));

        // Calculate total DCA duration plus a buffer (e.g., 1 minute)
        const totalDcaDuration = Number(params.inAmount / params.inAmountPerCycle) * Number(params.cycleSecondsApart);
        const bufferSeconds = 60;
        const sleepDuration = (totalDcaDuration + bufferSeconds) * 1000;

        // Sleep for the DCA duration plus buffer
        console.log(chalk.cyan(`[DCA][${getCurrentTimestamp()}] Sleeping for ${millisToMinutesAndSeconds(sleepDuration)} minutes...`));
        await new Promise(resolve => setTimeout(resolve, sleepDuration));

        let tokenBalance = await get_balance(randomMintOut);

        // Swap the token back to SOL
        const swapResult = await exec_swap(params.outputMint, SOL, tokenBalance);

        console.log(chalk.cyan(`[DCA][${getCurrentTimestamp()}] Sleeping for ${millisToMinutesAndSeconds(cycle_time*1000)} minutes...`))
        await new Promise(resolve => setTimeout(resolve, cycle_time));
    }
}

async function farm_jup_dca_acyclic(sol_in) {
    const tokenAddresses = [
        'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL
        'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1', // bSOL
        'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', // jitoSOL
        'LSTxxxnJzKDFSLr4dUkPcmCf5VyryEqzPLz5j4bpxFp'  // LST
    ];

    const randomIndex = Math.floor(Math.random() * tokenAddresses.length);
    const randomMintOut = tokenAddresses[randomIndex];

    let lamports_in = sol_in * Math.pow(10, 9);
    let per_cycle = lamports_in / 5;
    let cycle_time = Math.round((getRandomSleepDuration(1800, 2400))/5) * 3;

    const params = {
        payer: wallet.publicKey.toString(),
        user: wallet.publicKey.toString(),
        inAmount: BigInt(lamports_in), 
        inAmountPerCycle: BigInt(per_cycle), 
        cycleSecondsApart: BigInt(cycle_time), // 1 hour (3600 seconds) TEMP TESTING DURATION SHOULD BE CYCLE TIME
        inputMint: SOL, // sell
        outputMint: randomMintOut, // buy
        minOutAmountPerCycle: null,
        maxOutAmountPerCycle: null,
        startAt: null, 
    };

    const { tx, dcaPubKey } = await dca.createDcaV2(params);
    const txid = await Web3.sendAndConfirmTransaction(connection, tx, [keypair]);
    console.log(chalk.cyan(`[DCA][${getCurrentTimestamp()}] Created ${tokens[randomMintOut]} DCA: ${txid}`));

    // Calculate total DCA duration plus a buffer (e.g., 1 minute)
    const totalDcaDuration = Number(params.inAmount / params.inAmountPerCycle) * Number(params.cycleSecondsApart);
    const bufferSeconds = 60;
    const sleepDuration = (totalDcaDuration + bufferSeconds) * 1000;

    // Sleep for the DCA duration plus buffer
    console.log(chalk.cyan(`[DCA][${getCurrentTimestamp()}] Sleeping for ${millisToMinutesAndSeconds(sleepDuration)} minutes...`));
    await new Promise(resolve => setTimeout(resolve, sleepDuration));

    let tokenBalance = await get_balance(randomMintOut);

    // Swap the token back to SOL
    const swapResult = await exec_swap(params.outputMint, SOL, tokenBalance);

    console.log(chalk.cyan(`[DCA][${getCurrentTimestamp()}] Sleeping for ${millisToMinutesAndSeconds(cycle_time*1000)} minutes...`))
    await new Promise(resolve => setTimeout(resolve, cycle_time));
}

//usdc is a 6 decmial token * Math.pow(10, 6); - USDC
//all other token pairs are 9 * Math.pow(10, 9); - SOL, mSOL, bSOL, jitoSOL, LST
async function farm_jup_limit(usdc_amt, sol_amt) {
    let usdc_lamports = usdc_amt * Math.pow(10, 6);
    let sol_lamports = sol_amt * Math.pow(10, 9);
    const limitOrder = new LimitOrderProvider(connection);

    //https://api.coingecko.com/api/v3/simple/price?ids=Solana&vs_currencies=usd
    //get price from here and make limit order in sol usdc pair both ways every x minutes, check usdc balance before
    //continuing cycle

    //needs way to get mark price on exchange and place limit slightly above fill threshold
    //base used to generate unique signature for limit
    const base_USDC = Keypair.generate();
    const base_SOL = Keypair.generate();

    const { tx_USDC, USDC_IN } = await limitOrder.createOrder({
        owner: wallet.publicKey.toString(),
        inAmount: new BN(usdc_amt), // 1000000 => 1 USDC if inputToken.address is USDC mint
        outAmount: new BN(sol_amt),
        inputMint: new PublicKey(USDC),
        outputMint: new PublicKey(SOL),
        expiredAt: null, // new BN(new Date().valueOf() / 1000)
        base: base_USDC.publicKey,
    });

    const { tx_SOL, SOL_IN } = await limitOrder.createOrder({
        owner: wallet.publicKey.toString(),
        inAmount: new BN(usdc_amt), // 1000000 => 1 USDC if inputToken.address is USDC mint
        outAmount: new BN(sol_amt),
        inputMint: new PublicKey(USDC),
        outputMint: new PublicKey(SOL),
        expiredAt: null, // new BN(new Date().valueOf() / 1000)
        base: base_SOL.publicKey,
    });

    //sending limit to program & create accounts
    await sendAndConfirmTransaction(connection, tx_USDC, [owner, base]);
    await sendAndConfirmTransaction(connection, tx_SOL, [owner, base]);

    await new Promise(resolve => setTimeout(resolve, 600000));
    const openOrder = await limitOrder.getOrders([ownerFilter(owner.publicKey)]);

    if(openOrder) {
        const cancel_txid = await limitOrder.cancelOrder({
            owner: owner.publicKey, // find way to access
            orderPubKey: order.publicKey,
          });
    }


}

async function farm_jup_volume_acyclic(initial_sol){
    let amountSOL = initial_sol;

    const swapPairs = [
        { inputMint: 'So11111111111111111111111111111111111111112', outputMint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So' }, // SOL -> mSOL
        { inputMint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', outputMint: 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1' }, // mSOL -> bSOL
        { inputMint: 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1', outputMint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn' }, // bSOL -> jitoSOL
        { inputMint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', outputMint: 'LSTxxxnJzKDFSLr4dUkPcmCf5VyryEqzPLz5j4bpxFp' },  // jitoSOL -> LST
        { inputMint: 'LSTxxxnJzKDFSLr4dUkPcmCf5VyryEqzPLz5j4bpxFp', outputMint: 'So11111111111111111111111111111111111111112' }  // LST -> SOL
    ];

    for (const pair of swapPairs) {
        try {
            const outputAmount = await exec_swap(pair.inputMint, pair.outputMint, amountSOL);
            amountSOL = outputAmount / LAMPORTS_PER_SOL;
            let swap_cooldown = random_in_range(420000, 600000);
            console.log(chalk.cyan(`[${getCurrentTimestamp()}] Sleeping for ${millisToMinutesAndSeconds(swap_cooldown)} minutes`));
            await new Promise(resolve => setTimeout(resolve, swap_cooldown));
        }
        catch(error){
            console.log(error)
        }
    }
}

async function farm_jup_rotate(initial_sol) {
    while(true){
        await farm_jup_volume_acyclic(initial_sol);
        await farm_jup_dca_acyclic(initial_sol);
        //add limit eventually
    }
}

export {farm_jup_dca, farm_jup_volume, farm_jup_rotate}
