import { Keypair } from "@solana/web3.js";
import { config } from "./config";
import bs58 from "bs58";
import fs from "fs"

//Return owner keypair if valid
export function get_wallet(config_path:string): Keypair{
    var config_file = fs.readFileSync(config_path, 'utf8');
    var config_obj:config = JSON.parse(config_file);

    try {
        const secretkey = bs58.decode(config_obj.wallet);
        const ownerKeypair = Keypair.fromSecretKey(secretkey);
        return ownerKeypair
    } 
    catch (e) {
        console.log(e);
    }
    return new Keypair()
}