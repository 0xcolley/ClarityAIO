import { Connection, Keypair } from "@solana/web3.js";
import { CrossClient, Exchange, Network, Wallet, utils, types, constants } from "@zetamarkets/sdk";
import { EmbedBuilder } from "discord.js";
import axios from "axios";
import bs58 from "bs58";
import fs from "fs";
import chalk from 'chalk';
import path from 'path';

//Read from config file
function loadConfig() {
    // Combine __dirname with 'config.json'
    const configPath = path.join('config.json');
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

  
const config_obj = loadConfig();

//Timestamp printing function
function getCurrentTimestamp() {
    return new Date().toLocaleString();
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


//Keypair formation from config and connection formation
const key_one = Keypair.fromSecretKey(bs58.decode(config_obj.farmer.long_wallet));
const key_two = Keypair.fromSecretKey(bs58.decode(config_obj.farmer.short_wallet));

const wallet_one = new Wallet(key_one);
const wallet_two = new Wallet(key_two);

const connection = new Connection(config_obj.main_rpc, "confirmed");


//Main function
async function zeta_farmer(totalAmountStr, asset_in) {
    let asset_str = `${asset_in}`;
    let asset_switch;
    
    switch(asset_switch) {
        case 'APT':
            asset_switch = constants.Asset.APT;
            break;
        case 'ARB':
            asset_switch = constants.Asset.ARB;
            break;
        case 'BNB':
            asset_switch = constants.Asset.BNB;
            break;
        case 'BTC':
            asset_switch = constants.Asset.BTC;
            break;
        case 'ETH':
            asset_switch = constants.Asset.ETH;
            break;
        case 'SOL':
            asset_switch = constants.Asset.SOL;
            break;
        case 'ONEMBONK':
            asset_switch = constants.Asset.ONEMBONK;
            break;
        case 'JTO':
            asset_switch = constants.Asset.JTO;
            break;
        case 'JUP':
            asset_switch = constants.Asset.JUP;
            break;
        case 'TIA':
            asset_switch = constants.Asset.TIA;
            break;
        default:
            asset_switch = constants.Asset.SOL;
    }
    //Create connection to zeta
    const loadExchangeConfig = types.defaultLoadExchangeConfig(
        Network.MAINNET,
        connection,
        utils.defaultCommitment(),
        0,
        true
    );
    
    //Connect
    await Exchange.load(loadExchangeConfig);

    //Connect wallet one
    const client_one = await CrossClient.load(
        connection,
        wallet_one,
        utils.defaultCommitment(),
        undefined
    );
    
    //Connect wallet two
    const client_two = await CrossClient.load(
        connection,
        wallet_two,
        utils.defaultCommitment(),
        undefined
    );
    
    //Loop to continue farming process
    while (true) {
        try{
            console.log(chalk.cyan(`[${getCurrentTimestamp()}] Fetching Price...`));
            //Getting sol price and formatting lot size
            await new Promise(resolve => setTimeout(resolve, 1000));
            const totalAmount = parseFloat(totalAmountStr);
            const halfAmount = totalAmount / 2;
            const orderLotsLong = utils.convertDecimalToNativeLotSize(halfAmount);
            const orderLotsShort = utils.convertDecimalToNativeLotSize(halfAmount);

            //Decimal formation of prices
            let price = await Exchange.getMarkPrice(asset_switch);
            await Exchange.updateAutoFee();

            const price_order_short = Math.round(price * 0.99 / 100) * 100;
            const price_order_long = (Math.round((price * 1.01) * 100) * 100) * 100;

            console.log(chalk.cyan(`[${getCurrentTimestamp()}] Placing Orders...`));

            //Placing initial orders
            await client_one.placeOrder(asset_switch, price_order_long, orderLotsLong, types.Side.BID); // Long
            await client_two.placeOrder(asset_switch, price_order_short, orderLotsShort, types.Side.ASK); // Short
            console.log(chalk.green(`[${getCurrentTimestamp()}] Orders Placed`));

            //Sleeping while positions are open
            let sleep_pos_hold = random_in_range(420000, 600000);
            console.log(chalk.cyan(`[${getCurrentTimestamp()}] Sleeping for ${millisToMinutesAndSeconds(sleep_pos_hold)} minutes`));
            await new Promise(resolve => setTimeout(resolve, sleep_pos_hold));
            
            //After sleep, close positions by opening opposite UPDATING TO CLOSE ACCORDING TO REQUIRED PRICE
            await client_one.updateState();
            await client_two.updateState();

            await client_one.cancelAllOrders();
            await client_two.cancelAllOrders();
            console.log(chalk.cyan(`[${getCurrentTimestamp()}] Cancelling Orders...`))

            let pass_param_one = client_one.getPositions(asset_switch);
            let pass_param_two = client_two.getPositions(asset_switch);

            await Exchange.updateAutoFee();
            console.log(chalk.cyan(`[${getCurrentTimestamp()}] Closing Positions...`))
            await closePosition(client_one, pass_param_one[0], asset_switch);
            await closePosition(client_two, pass_param_two[0], asset_switch);

            //Sleeping before check to ensure that the update state is correct
            console.log(chalk.cyan(`[${getCurrentTimestamp()}] Sleeping for 10 seconds to ensure closeout...`))
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // Close positions by canceling all orders

            //Update client state
            await client_one.updateState();
            await client_two.updateState();

            //Get asset positions to ensure the positions are closed
            const positions_one = client_one.getPositions(asset_switch);
            const positions_two = client_two.getPositions(asset_switch);

            //Checking client orders to make sure they're closed
            if (positions_one.length === 0 && positions_two.length === 0) {
                console.log(chalk.green(`[${getCurrentTimestamp()}] All positions for ${asset_str} are successfully closed.`));

                const success_embed = new EmbedBuilder()
                    .setColor(0x3c66ba)
                    .setTitle('Clarity - Zeta')
                    .setDescription(`Successfully closed positions of ${totalAmount} ${asset_str}.`)
                    .setThumbnail('https://i.imgur.com/GXtdPIG.png')
                    .setTimestamp();

                axios.post(config_obj.webhook_url, {embeds: [success_embed]});
            } 
            else {
                console.log(chalk.red(`[${getCurrentTimestamp()}] Failed to Close Orders/Positions`));

                const fail_embed = new EmbedBuilder()
                    .setColor(0x3c66ba)
                    .setTitle('Clarity - Zeta')
                    .setDescription(`Failed to close position due to ExpiredBlockhash - will attempt to reclose on next run.`)
                    .setThumbnail('https://i.imgur.com/GXtdPIG.png')
                    .setTimestamp();

                axios.post(config_obj.webhook_url, {embeds: [fail_embed]});
            }

            //Sleep and restart
            let sleep_rerun = random_in_range(120000, 180000);
            console.log(chalk.cyan(`[${getCurrentTimestamp()}] Sleeping for ${millisToMinutesAndSeconds(sleep_rerun)} minutes`));
            await new Promise(resolve => setTimeout(resolve, sleep_rerun));
        }
        catch(e){
            console.log(e)
        }
    }
}

async function closePosition(client, position, asset_switch) {
    const sideToClose = position.size > 0 ? types.Side.ASK : types.Side.BID;
    const sizeToClose = Math.abs(position.size);
    let mark_price = Exchange.getMarkPrice(asset_switch);
    const price_order_short = Math.round((mark_price * 1.02)  / 100) * 100;
    const price_order_long = (Math.round((mark_price * 1.02) * 100) * 100) * 100;
    let lot_size = utils.convertDecimalToNativeLotSize(Math.abs(position.size));

    // Place a market order to close the position
    try {
        if(sideToClose === types.Side.ASK){
            await client.placeOrder(asset_switch, price_order_short, lot_size, types.Side.ASK); //Close Long
        }
        else {
            await client.placeOrder(asset_switch, price_order_long, lot_size, types.Side.BID); //Close Short
        }
    } catch (error) {
        console.error("Error placing market order to close position:", error);
    }
}

export {zeta_farmer}