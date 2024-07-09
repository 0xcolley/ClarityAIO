import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";
import { Connection, clusterApiUrl, Keypair, PublicKey } from "@solana/web3.js";
import chalk from 'chalk';
import axios from 'axios';
import bs58 from "bs58";
import fs from 'fs';
import path from 'path';

function loadConfig() {
  const configPath = path.join('config.json');
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

const config_obj = loadConfig();

var private_key = config_obj.private_key;
var rpc = config_obj.main_rpc;

isRpcValid(rpc)
  .then((isValid) => {
    if (!isValid) {
      console.error(chalk.red("Invalid RPC or no connection. Exiting program."));
      process.exit(1);
    }
  });

const connection = new Connection(rpc, "confirmed");

async function isRpcValid(url) {
    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "getHealth",
    };
  
    try {
      const response = await axios.post(url, payload);
      if (response.data && 'result' in response.data) {
        return true;
      } 
      else {
        return false;
      }
    } 
    catch (error) {
      console.error(`RPC Error: ${error.message}`);
      return false;
    }
  }

async function get_all_tokens() {
    var return_addresses = [];

    var keypair = Keypair.fromSecretKey(bs58.decode(private_key));
    const metaplex = new Metaplex(connection);
    metaplex.use(keypairIdentity(keypair));

    var public_key = keypair.publicKey;
    const all_tokens = await metaplex.nfts().findAllByOwner({ owner: public_key });

    all_tokens.forEach(item => {
        const mintAddress = item.mintAddress;
        return_addresses.push(mintAddress.toString());
    });

    return return_addresses;
};

async function get_auth_response() {
    const tokens = await get_all_tokens();
    const postData = {
        tokens: tokens
    };

    const apiEndpoint = 'https://walrus-app-nvinf.ondigitalocean.app/api/auth';

    axios.post(apiEndpoint, postData, {
        headers: {
            'Content-Type': 'application/json'
        },
        validateStatus: function (status) {
            return status >= 200 && status < 300 || status === 401; 
        }
    })
    .then(response => {
        if(response.status === 401) {
            console.log(chalk.red('\n{Auth Failed - Exiting}'));
            process.exit(1);
        }
        else if(response.status === 201) {
            console.log(chalk.green('\n{Auth Succeeded}'));
            return 1;
        }
        else {
            console.log('Internal Server Error');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('Error occurred:', error);
        process.exit(1);
    });
}

export { get_auth_response };


