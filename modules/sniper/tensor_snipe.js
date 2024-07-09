import fs from "fs";
import bs58 from "bs58";
import { AnchorProvider, Wallet } from "@project-serum/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import { Metaplex } from "@metaplex-foundation/js";
import { TensorSwapSDK, TensorWhitelistSDK } from "@tensor-oss/tensorswap-sdk";
import path from "path";
import WebSocket from "ws";

//added
function loadConfig() {
  // Combine __dirname with 'config.json'
  const configPath = path.join('../../config.json'); // Corrected path
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

const config_obj = loadConfig();

const graphqlEndpoint = "https://api.tensor.so/graphql";
const ws_endpoint = "wss://api.tensor.so/graphql";

const connection = new Connection(config_obj.main_rpc);
const provider = new AnchorProvider(connection, new Wallet(Keypair.generate()));
const swapSdk = new TensorSwapSDK({ provider });
const wlSdk = new TensorWhitelistSDK({ provider });
const keypair = Keypair.fromSecretKey(bs58.decode(config_obj.private_key));
const metaplex = new Metaplex(connection);
const wallet = new Wallet(keypair);
const tensor_key = config_obj.farmer.tensor_api_key;

let sock; // Declare the WebSocket outside to reuse in reconnect function

async function fetch_real_slug(uuid) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const query = `query CollectionStats($slug: String!) {
        instrumentTV2(slug: $slug) {
          id 
          slug # internal ID for collection (UUID or human-readable)
          slugMe # MagicEden's symbol
          slugDisplay # What's displayed in the URL on tensor.trade
          statsV2 {
                  currency
            buyNowPrice
                  buyNowPriceNetFees
                  sellNowPrice
                  sellNowPriceNetFees
            numListed
            numMints
            floor1h
            floor24h
            floor7d
            sales1h
            sales24h
            sales7d
                  salesAll
            volume1h
            volume24h
            volume7d
                  volumeAll
          }
          firstListDate
          name
        }
      }`;
  
    const floor_vars = {
      slug: uuid, // Example slugs
    };
  
    const response = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tensor-api-key": config_obj.farmer.tensor_api_key, 
    },
      body: JSON.stringify({ query: query, variables: floor_vars }),
    });
    const data = await response.json();
    return data;
}
