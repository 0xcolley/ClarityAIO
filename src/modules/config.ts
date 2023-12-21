import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import fs from "fs";

//Config interface
export interface config {
    webhook_url:    string,
    rpc_endpoint:   string,
    wallet:         string,
    slippage:       number
};

//Write config to console
export function show_config() {
    var config_file = fs.readFileSync('config.json', 'utf-8');
    var config_obj: config = JSON.parse(config_file);

    var pubkey: string;

    try {
        const secret_key = bs58.decode(config_obj.wallet);
        const owner_keypair = Keypair.fromSecretKey(secret_key);
        var pubkey = owner_keypair.publicKey.toBase58();
    }
    catch(e) {
        pubkey = config_obj.wallet;
    }

    console.log(`\tWallet Address: ${pubkey}`)
    console.log(`\tRPC URL: ${config_obj.rpc_endpoint}`)
    console.log(`\tWebhook URL: ${config_obj.webhook_url}`)
    console.log(`\tSlippage: ${config_obj.slippage}%`)
}


export async function update_rpc(rpc: string){
    try {
        const connection = new Connection(rpc);
        const balance = await connection.getBalance(new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'));

        //Checking the balance of the token program to insure the RPC connection is valid
        if (balance) {
            var config_file = fs.readFileSync('config.json','utf8');
            var config_obj: config = JSON.parse(config_file);
        
            config_obj.rpc_endpoint = rpc;
        
            const new_config = JSON.stringify(config_obj);
            fs.writeFileSync('config.json', new_config);
            //Success case, return 0
            return 0;
        }
        else {
            //Failed case, return 1
            return 1;
        }
    }
    catch(e) {
        //On caught exception, return 1
        return 1;
    }
}

export function update_slippage(slip: string){
    try {
        const parsed_slippage = parseInt(slip);
        //Validate that slippage exists and is bounded 0-100
        if (isNaN(parsed_slippage)) {
            return 1
        } 
        else if(parsed_slippage > 100 || parsed_slippage < 0) {
            return 1
        } 
        else {
            //Read Config
            var config_file = fs.readFileSync('config.json', 'utf8');
            var config_obj:config = JSON.parse(config_file);
        
            //Update Config
            config_obj.slippage = parsed_slippage;
        
            //Write Config
            const new_config = JSON.stringify(config_obj);
            fs.writeFileSync('config.json', new_config);
            //Success case, return 1
            return 0;
        }
    }
    catch(e) {
        //Failure case, return 0
        return 1;
    }
}


export function update_wallet(wallet: string){
    var config_file = fs.readFileSync('config.json', 'utf8');
    var config_obj: config = JSON.parse(config_file);
    try{
        const secretkey = bs58.decode(wallet);
        const ownerKeypair = Keypair.fromSecretKey(secretkey);

        //Update Config
        config_obj.wallet = wallet;
        //Write Config
        const new_config = JSON.stringify(config_obj);
        fs.writeFileSync('config.json', new_config);
        //Success case, return 1
        return 0;
        
    }
    catch(e) {
        //Failure case, return 0
        return 1;
    }
}

export function update_webhook(webhook: string){
    var config_file = fs.readFileSync('config.json', 'utf8');
    var config_obj: config = JSON.parse(config_file);
    try {
        config_obj.webhook_url = webhook;   
        const new_config = JSON.stringify(config_obj);
        fs.writeFileSync('config.json', new_config);
        //Success case, return 1
        return 0;
    }
    catch(e) {
        //Fail case, return 0
        return 1
    }
}