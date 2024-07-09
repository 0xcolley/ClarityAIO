import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { config } from "dotenv";
import fs from "fs";
import path from "path";

function loadConfig() {
  const configPath = path.join('config.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

const config_obj = loadConfig();

export function show_config() {
  var pubkey;
  try {
    const secretkey = bs58.decode(config_obj.private_key);
    const ownerKeypair = Keypair.fromSecretKey(secretkey);
    var pubkey = ownerKeypair.publicKey.toBase58();
    const zeta_long_keypair = Keypair.fromSecretKey(
      bs58.decode(config_obj.farmer.long_wallet),
    );
    const zeta_short_keypair = Keypair.fromSecretKey(
      bs58.decode(config_obj.farmer.short_wallet),
    );
    var zeta_short_key = zeta_short_keypair.publicKey.toString();
    var zeta_long_key = zeta_long_keypair.publicKey.toString();
  } catch (e) {
    pubkey = config_obj.wallet;
  }

  console.log(`Wallet Address: ${pubkey}`);
  console.log(`RPC URL: ${config_obj.main_rpc}`);
  console.log(`Webhook URL: ${config_obj.webhook_url}`);
  console.log(`Zeta Longing Address: ${zeta_long_key}`);
  console.log(`Zeta Shorting Address: ${zeta_short_key}`);
  console.log(`Tensor API Key ${config_obj.farmer.tensor_api_key}`);
}

export async function update_rpc(rpc) {
  try {
    const connection = new Connection(rpc);
    const balance = await connection.getBalance(
      new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    );
    if (balance) {
      //reading config fil

      //updating config
      config_obj.main_rpc = rpc;

      //writing new config
      const new_config = JSON.stringify(config_obj);
      fs.writeFileSync("./config.json", new_config);
      return 0;
    } else {
      return 1;
    }
  } catch (e) {
    return 1;
  }
}

export function update_wallet(wallet) {
  try {
    const secretkey = bs58.decode(wallet);
    const ownerKeypair = Keypair.fromSecretKey(secretkey);

    //updating config
    config_obj.private_key = wallet;
    //writing new config
    const new_config = JSON.stringify(config_obj);
    fs.writeFileSync("./config.json", new_config);
    return 0;
  } catch (e) {
    return 1;
  }
}

export function update_webhook(hook) {
  try {
    //updating config
    config_obj.webhook_url = hook;
    //writing new config
    const new_config = JSON.stringify(config_obj);
    fs.writeFileSync("./config.json", new_config);
    return 0;
  } catch (e) {
    return 1;
  }
}

export function update_zeta_long(privkey) {
  try {
    //updating config
    config_obj.farmer.long_wallet = privkey;
    //writing new config
    const new_config = JSON.stringify(config_obj);
    fs.writeFileSync("./config.json", new_config);
    return 0;
  } catch (e) {
    return 1;
  }
}

export function update_zeta_short(privkey) {
  try {
    //updating config
    config_obj.farmer.short_wallet = privkey;
    //writing new config
    const new_config = JSON.stringify(config_obj);
    fs.writeFileSync("./config.json", new_config);
    return 0;
  } catch (e) {
    return 1;
  }
}

export function update_tensor(key) {
  try {
    //updating config
    config_obj.farmer.tensor_api_key = key;
    //writing new config
    const new_config = JSON.stringify(config_obj);
    fs.writeFileSync("./config.json", new_config);
    return 0;
  } catch (e) {
    return 1;
  }
}

export function return_config() {
  return config_obj;
}
