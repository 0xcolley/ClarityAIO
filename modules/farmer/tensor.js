import fs from "fs";
import chalk from "chalk";
import bs58 from "bs58";
import BN from "bn.js";
import axios from "axios";
import { AnchorProvider, Wallet } from "@project-serum/anchor";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  VersionedTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Metaplex, amount, lamports, token } from "@metaplex-foundation/js";
import {
  TensorSwapSDK,
  TensorWhitelistSDK,
  computeTakerPrice,
  TakerSide,
  castPoolConfigAnchor,
  findWhitelistPDA,
} from "@tensor-oss/tensorswap-sdk";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { fetch } from "cross-fetch";
import { EmbedBuilder } from "discord.js";
import path from 'path';

function loadConfig() {
  const configPath = path.join('config.json');
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

const config_obj = loadConfig();

const graphqlEndpoint = "https://api.tensor.so/graphql";

const connection = new Connection(config_obj.main_rpc);
const provider = new AnchorProvider(connection, new Wallet(Keypair.generate()));
const swapSdk = new TensorSwapSDK({ provider });
const wlSdk = new TensorWhitelistSDK({ provider });
const keypair = Keypair.fromSecretKey(bs58.decode(config_obj.private_key));
const metaplex = new Metaplex(connection);
const wallet = new Wallet(keypair);
const tensor_key = config_obj.farmer.tensor_api_key;

//No Dependencies
function getCurrentTimestamp() {
  return new Date().toLocaleString();
}

function extract_mints_from_nfts(nfts) {
  return nfts.map((nft) => nft.account.data.parsed.info.mint.toString());
}

async function fetch_mint_data(tokenMints) {
  const token_query = `
    query Mints($tokenMints: [String!]!) {
      mints(tokenMints: $tokenMints) {
        slug
      }
    }`;

  const variables_token = { tokenMints: tokenMints };
  const response = await fetch(graphqlEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tensor-api-key": tensor_key,
    },
    body: JSON.stringify({ query: token_query, variables: variables_token }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.data.mints;
}

//Parsing - Done
async function fetch_token_accounts(ownerPublicKey) {
  return await connection.getParsedTokenAccountsByOwner(ownerPublicKey, {
    programId: TOKEN_PROGRAM_ID,
  });
}

//Using API - Done
async function fetch_collection_data(uuid) {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const query = `query CollectionsStats(
      $slugs: [String!], # Internal ID (stable)
      $slugsMe: [String!], # Query by ME's URL slug (not 100% up-to-date)
      $slugsDisplay: [String!], # Query by what's displayed in the URL on tensor.trade
      $ids: [String!],
      $sortBy: String,
      $page: Int,
      $limit: Int,
    ) {
      allCollections(
        slugs: $slugs,
        slugsMe: $slugsMe,
        slugsDisplay: $slugsDisplay,  
        ids: $ids,
        sortBy: $sortBy,
        page: $page,
        limit: $limit
      ) {
        total
        collections {
          id
          slug # internal ID for collection (UUID or human-readable)
          slugMe # MagicEden's symbol (not 100% up-to-date)
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
      }
    }`;

  const floor_vars = {
    slugs: [uuid], // Example slugs
    slugsMe: null,
    slugsDisplay: null,
    ids: null,
    sortBy: "stats.volume24h:desc",
    limit: 50,
    page: 1,
  };

  const response = await fetch(graphqlEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tensor-api-key": tensor_key,
    },
    body: JSON.stringify({ query: query, variables: floor_vars }),
  });
  const data = await response.json();
  return data.data.allCollections.collections[0].statsV2;
}

//Using API - Done
async function get_bids(walletAddress) {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const query = `
        query UserTensorSwapOrders($owner: String!) {
          userTswapOrders(owner: $owner) {
            pool {
              address
              createdUnix
              curveType
              delta
              mmCompoundFees
              mmFeeBps
              nftsForSale {
                onchainId
              }
              nftsHeld
              ownerAddress
              poolType
              solBalance
              startingPrice
              buyNowPrice
              sellNowPrice
              statsAccumulatedMmProfit
              statsTakerBuyCount
              statsTakerSellCount
              takerBuyCount
              takerSellCount
              updatedAt
            }
          }
        }`;

  try {
    const response = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tensor-api-key": tensor_key,
      },
      body: JSON.stringify({
        query: query,
        variables: { owner: walletAddress },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Error fetching bids: ${data.errors?.map((e) => e.message).join(", ")}`,
      );
    }

    return data.data.userTswapOrders;
  } catch (error) {
    console.error("Error in getBids:", error);
    throw error;
  }
}

async function get_bids_on_collection(uuid) {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const bids_query = `query TensorSwapActiveOrders($slug: String!) {
    tswapOrders(slug: $slug) {
      address
      createdUnix
      curveType
      delta
      mmCompoundFees
      mmFeeBps
      nftsForSale {
        onchainId
      }
      nftsHeld
      ownerAddress
      poolType
      solBalance
      startingPrice
      buyNowPrice
      sellNowPrice
      statsAccumulatedMmProfit
      statsTakerBuyCount
      statsTakerSellCount
      takerBuyCount
      takerSellCount
      updatedAt
    }
  }`;

  const bid_vars = {
    slug: uuid,
  };

  try {
    const response = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tensor-api-key": tensor_key,
      },
      body: JSON.stringify({
        query: bids_query,
        variables: bid_vars,
      }),
    });

    const data = await response.json();

    return data;
  } catch (e) {
    console.log(e);
  }
}
//Parsing - Done
function total_bids(bid_obj) {
  if (bid_obj.length === 0) {
    return 0;
  } else {
    let open_bids = parseInt(bid_obj[0].pool.solBalance);
    let pool_price = parseInt(bid_obj[0].pool.sellNowPrice);
    let open_total = open_bids / pool_price;
    return open_total;
  }
}

//Parsing - Done
function get_pool(bid_obj) {
  let pool_address = bid_obj[0].pool.address;
  return pool_address;
}

//Using API - Done Until Further Notice
async function get_held(uuid) {
  const ownerPublicKey = new PublicKey(wallet.publicKey.toString());
  const tokenAccounts = await fetch_token_accounts(ownerPublicKey);

  const nfts = tokenAccounts.value.filter((accountInfo) => {
    const accountData = accountInfo.account.data.parsed.info;
    return (
      accountData.tokenAmount.amount === "1" &&
      accountData.tokenAmount.decimals === 0
    );
  });

  const tokenMints = extract_mints_from_nfts(nfts);
  //(resolve => setTimeout(resolve, 2000));
  const mintsData = await fetch_mint_data(tokenMints);

  const mappedSlugs = tokenMints.map((id, index) => ({
    id,
    slug: mintsData[index].slug,
  }));
  const heldFarm = [];
  mappedSlugs.forEach((token) => {
    if (token.slug === uuid) {
      heldFarm.push(token.id);
    }
  });

  return heldFarm;
}

//Using API - Done Until Further Notice
async function get_listings(walletAddress, slug) {
  const query = `
        query UserActiveListingsV2(
          $wallets: [String!]!
          $sortBy: ActiveListingsSortBy!
          $cursor: ActiveListingsCursorInputV2
          $limit: Int
          $slug: String
        ) {
          userActiveListingsV2(
            wallets: $wallets
            cursor: $cursor
            limit: $limit
            sortBy: $sortBy
            slug: $slug
          ) {
            page {
              endCursor {
                str
              }
              hasMore
            }
            txs {
              tx {
                txId
                txAt
                source
                mintOnchainId
                grossAmount
              }
            }
          }
        }`;

  const variables = {
    wallets: [walletAddress],
    sortBy: "PriceAsc", // Replace with your sort criteria
    cursor: null, // Adjust if you use pagination
    limit: 20, // Adjust the limit as needed
    slug: slug,
  };

  try {
    const response = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tensor-api-key": tensor_key,
      },
      body: JSON.stringify({
        query: query,
        variables: variables,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Error fetching listings: ${data.errors?.map((e) => e.message).join(", ")}`,
      );
    }

    return data.data.userActiveListingsV2.txs;
  } catch (error) {
    console.error("Error in getListings:", error);
    throw error;
  }
}

//Using SDK - GOOD
async function make_listing(mint_addr, uuid, list_mode, pct_diff) {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const formatted_mint = new PublicKey(mint_addr);
  const source = getAssociatedTokenAddressSync(
    formatted_mint,
    keypair.publicKey,
  );

  //calculate the floor price here and make above or below floor
  let collection_data = await fetch_collection_data(uuid);
  let this_floor = parseInt(collection_data.buyNowPrice) / LAMPORTS_PER_SOL;
  let below_floor = this_floor - this_floor * parseFloat(pct_diff);
  let above_floor = this_floor + this_floor * parseFloat(pct_diff);
  const price = list_mode === "ABOVE" ? above_floor : below_floor;

  const data = await swapSdk.list({
    owner: keypair.publicKey,
    nftMint: formatted_mint,
    nftSource: source,
    price: new BN(price * LAMPORTS_PER_SOL),
    priorityMicroLamports: 60000,
  });

  const tx = new Transaction().add(...data.tx.ixs);
  const recentBlockhash = await connection.getLatestBlockhash();
  tx.recentBlockhash = recentBlockhash.blockhash;

  tx.sign(keypair);

  const confirmationStrategy = {
    commitment: "confirmed",
    confirmations: 3,
  };

  const signature = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(signature, confirmationStrategy);

  return { txid: signature, price: above_floor };
}

//Using API - Rewrite Required
async function cancel_listing(mint) {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const query = `query TswapDelistNftTx($mint: String!, $owner: String!, $priorityMicroLamports: Int) {
      tswapDelistNftTx(mint: $mint, owner: $owner, priorityMicroLamports: $priorityMicroLamports) {
        txs {
          lastValidBlockHeight
          tx
          txV0 # If this is present, use this!
        }
      }
    }`;

  const vars = {
    mint: mint,
    owner: wallet.publicKey.toString(),
    priorityMicroLamports: 60000,
  };

  try {
    const response = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tensor-api-key": tensor_key,
      },
      body: JSON.stringify({
        query: query,
        variables: vars,
      }),
    });

    //data.data.tswapInitPoolTx.pool
    //data.data.tswapInitPoolTx.txs
    const data = await response.json();
    const serializedTxData = data.data.tswapDelistNftTx.txs[0].tx.data;
    const transactionData = Uint8Array.from(serializedTxData);
    const transaction = Transaction.from(transactionData);

    // Fetch and set the recent blockhash
    const recentBlockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = recentBlockhash.blockhash;

    // Sign the transaction
    transaction.sign(keypair);

    // Serialize the transaction
    const serializedTransaction = transaction.serialize();

    // Send the serialized transaction
    const confirmationStrategy = {
      commitment: "confirmed",
      confirmations: 3,
    };

    const signature = await connection.sendRawTransaction(
      serializedTransaction,
    );
    await connection.confirmTransaction({ signature, ...confirmationStrategy });

    return signature;
  } catch (e) {
    console.log(e);
  }
}

//Using API - Rewrite Required
async function edit_listing(mint, uuid, list_mode) {
  let start_timestamp = Date.now();
  let collection_data = await fetch_collection_data(uuid);
  //console.log(`Collection data query time: ${(Date.now() - start_timestamp) / 1000}`);
  //needs an edit here to prevent self driving down price
  let this_floor = parseInt(collection_data.buyNowPrice) / LAMPORTS_PER_SOL;
  let below_floor = this_floor - this_floor * 0.01;
  let above_floor = this_floor + this_floor * 0.01;
  const price = list_mode === "ABOVE" ? below_floor : above_floor;
  const query = `query TswapEditSingleListingTx($mint: String!, $owner: String!, $price: Decimal!, $priorityMicroLamports: Int) {
      tswapEditSingleListingTx(mint: $mint, owner: $owner, price: $price, priorityMicroLamports: $priorityMicroLamports) {
        txs {
            lastValidBlockHeight
            tx
            txV0 # If this is present, use this!
          }
      }
    }`;

  const vars = {
    mint: mint,
    owner: wallet.publicKey.toString(),
    price: (price * LAMPORTS_PER_SOL).toString(),
    currency: null,
    feePayer: null,
    priorityMicroLamports: 60000,
  };

  try {
    const response = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tensor-api-key": tensor_key,
      },
      body: JSON.stringify({
        query: query,
        variables: vars,
      }),
    });

    const data = await response.json();
    //console.log(`Post tensor api query time: ${(Date.now() - start_timestamp) / 1000}`);
    const serializedTxData = data.data.tswapEditSingleListingTx.txs[0].tx.data;
    const transactionData = Uint8Array.from(serializedTxData);
    const transaction = Transaction.from(transactionData);

    // Fetch and set the recent blockhash
    const recentBlockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = recentBlockhash.blockhash;

    // Sign the transaction
    transaction.sign(keypair);

    // Serialize the transaction
    const serializedTransaction = transaction.serialize();

    // Send the serialized transaction
    const confirmationStrategy = {
      commitment: "confirmed",
      confirmations: 3,
    };

    const signature = await connection.sendRawTransaction(
      serializedTransaction,
    );
    await connection.confirmTransaction({ signature, ...confirmationStrategy });
    console.log(
      chalk.green(
        `[${getCurrentTimestamp()}] Updating listing at price ${price.toFixed(4)}`,
      ),
    );
    //console.log(`Total method time: ${(Date.now() - start_timestamp) / 1000}`);
    return signature;
  } catch (e) {
    console.log(e);
  }
}

//Using API - Done Until Further Notice
async function comp_make_bid(price, quantity, slug) {
  let pass_price = (price * LAMPORTS_PER_SOL).toString();
  const TCOMP_BID_TX_QUERY = `
    query TcompBidTxForCollection(
      $owner: String!
      $price: Decimal!
      $quantity: Float!
      $slug: String
      $depositLamports: Decimal
      $topUpMarginWhenBidding: Boolean
      $expireIn: Float
      $marginNr: Float
    ) {
      tcompBidTx(
        owner: $owner,
        price: $price,
        quantity: $quantity,
        slug: $slug,
        depositLamports: $depositLamports,
        expireIn: $expireIn,
        marginNr: $marginNr,
        topUpMarginWhenBidding: $topUpMarginWhenBidding
      ) {
        txs {
          lastValidBlockHeight
          tx
          txV0
        }
      }
    }`;
  //get the price
  const variables = {
    owner: wallet.publicKey.toString(),
    price: pass_price,
    quantity,
    slug,
  };

  try {
    const response = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tensor-api-key": tensor_key,
      },
      body: JSON.stringify({
        query: TCOMP_BID_TX_QUERY,
        variables: variables,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Error in GraphQL query: ${data.errors?.map((e) => e.message).join(", ")}`,
      );
    }

    const serializedTxData = data.data.tcompBidTx.txs[0].tx.data;
    const transactionData = Uint8Array.from(serializedTxData);
    const transaction = Transaction.from(transactionData);

    // Fetch and set the recent blockhash
    const recentBlockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = recentBlockhash.blockhash;

    // Sign the transaction
    transaction.sign(keypair);

    // Serialize the transaction
    const serializedTransaction = transaction.serialize();

    // Send the serialized transaction
    const confirmationStrategy = {
      commitment: "confirmed",
      confirmations: 3,
    };

    const signature = await connection.sendRawTransaction(
      serializedTransaction,
    );
    await connection.confirmTransaction({ signature, ...confirmationStrategy });

    return signature;
  } catch (error) {
    console.error("Error querying TcompBidTxForCollection:", error);
    throw error;
  }
}

//Using API - Rewrite Required
async function make_bid(price, quantity, slug) {
  //fix the pricing logic here
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const config = {
    poolType: "TOKEN",
    curveType: "LINEAR",
    delta: (price * 0.1).toString(),
    startingPrice: price.toString(),
    mmCompoundFees: false,
    mmFeeBps: null,
  };

  //Need a way to update to the chain's active priorityMicroLamports
  const pool_config = {
    config: config,
    owner: wallet.publicKey.toString(),
    slug: slug,
    depositLamports: (price * quantity).toString(),
    marginNr: null,
    priorityMicroLamports: 60000,
  };

  const query_pool = `query TswapInitPoolTx($config: PoolConfig!, $owner: String!, $slug: String!, $depositLamports: Decimal, $marginNr: Float, $priorityMicroLamports: Int) {
        tswapInitPoolTx(config: $config, owner: $owner, slug: $slug, depositLamports: $depositLamports, marginNr: $marginNr, priorityMicroLamports: $priorityMicroLamports) {
          pool
          txs {
            lastValidBlockHeight
            tx
            txV0 # If this is present, use this!
          }
        }
      }`;

  try {
    const response = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tensor-api-key": tensor_key,
      },
      body: JSON.stringify({
        query: query_pool,
        variables: pool_config,
      }),
    });

    //console.log(`Tensor api make bid data query time: ${(Date.now() - start_timestamp) / 1000}`);
    //data.data.tswapInitPoolTx.pool
    //data.data.tswapInitPoolTx.txs
    //added priority fee ix
    const data = await response.json();
    const serializedTxData = data.data.tswapInitPoolTx.txs[0].tx.data;
    const transactionData = Uint8Array.from(serializedTxData);
    const transaction = Transaction.from(transactionData);

    const recent_blockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = recent_blockhash.blockhash;
    //some sort of error in this method is preventing the signing from working
    transaction.partialSign(keypair);
    // Sign the transaction
    // Serialize the transaction
    const serializedTransaction = transaction.serialize();

    // Send the serialized transaction

    const confirmationStrategy = {
      commitment: "confirmed",
      confirmations: 3,
    };

    const signature = await connection.sendRawTransaction(
      serializedTransaction,
    );
    await connection.confirmTransaction({ signature, confirmationStrategy });

    //console.log(`Makebid execution time: ${(Date.now() - start_timestamp) / 1000}`);
    return signature;
  } catch (e) {
    console.log(e);
  }
}

//Using API - Rewrite Required
async function cancel_bid(pool_address) {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  let start_timestamp = Date.now();
  const cancel_query = `query TswapClosePoolTx($pool: String!, $priorityMicroLamports: Int) {
      tswapClosePoolTx(pool: $pool, priorityMicroLamports: $priorityMicroLamports) {
        txs {
          lastValidBlockHeight
          tx
          txV0 # If this is present, use this!
        }
      }
    }`;

  let cancel_vars = {
    pool: pool_address,
    priorityMicroLamports: 60000,
  };

  try {
    const response = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tensor-api-key": tensor_key,
      },
      body: JSON.stringify({
        query: cancel_query,
        variables: cancel_vars,
      }),
    });

    const data = await response.json();
    //console.log(`Total query time for cancel bid: ${(Date.now() - start_timestamp) / 1000}`)
    const serializedTxData = data.data.tswapClosePoolTx.txs[0].tx.data;
    const transactionData = Uint8Array.from(serializedTxData);
    const transaction = Transaction.from(transactionData);

    // Fetch and set the recent blockhash
    const recentBlockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = recentBlockhash.blockhash;

    // Sign the transaction
    let this_keypair = Keypair.fromSecretKey(
      bs58.decode(config_obj.private_key),
    );
    transaction.sign(this_keypair);

    // Serialize the transaction
    const serializedTransaction = transaction.serialize();

    // Send the serialized transaction
    const confirmationStrategy = {
      commitment: "confirmed",
      confirmations: 3,
    };

    const signature = await connection.sendRawTransaction(
      serializedTransaction,
    );
    await connection.confirmTransaction({ signature, ...confirmationStrategy });
    //console.log(`Total query time for cancel bid send tx: ${(Date.now() - start_timestamp) / 1000}`)
    return signature;
  } catch (e) {
    console.log(e);
  }
}

//Caller Function - DONE
async function check_and_balance(
  wallet,
  total,
  uuid,
  list_mode,
  bid_placement,
  pct_diff,
) {
  const bids = await get_bids(wallet);
  const wallet_param = keypair.publicKey.toString();
  const listings = await get_listings(wallet_param, uuid);
  const collection_data = await fetch_collection_data(uuid);
  const bid_amount = parseInt(collection_data.sellNowPrice);
  const floor_current = parseInt(collection_data.buyNowPrice);
  //three lines below are new and may not work, originally passed uuid to get_held
  const real_slug = collection_data.id;
  let heldFarm = await get_held(uuid);
  console.log(
    chalk.cyan(
      `[${getCurrentTimestamp()}] Current Floor: ${floor_current / LAMPORTS_PER_SOL}`,
    ),
  );

  let bidsCount = total_bids(bids);
  let listingsCount = listings.length;

  console.log(
    chalk.cyan(`[${getCurrentTimestamp()}] Bids Active: ${bidsCount}`),
  );
  console.log(
    chalk.cyan(`[${getCurrentTimestamp()}] Listings Active: ${listingsCount}`),
  );

  const halfTotal = total / 2;

  if (
    bidsCount === halfTotal &&
    listingsCount === halfTotal &&
    bidsCount + listingsCount !== 0
  ) {
    console.log(
      chalk.cyan(`[${getCurrentTimestamp()}] Bids and listings are balanced`),
    );
    await rebalance_bids(
      bidsCount,
      halfTotal,
      bids,
      uuid,
      bid_amount,
      bid_placement,
    );
    await rebalance_listings(
      listingsCount,
      halfTotal,
      heldFarm,
      uuid,
      listings,
      list_mode,
      pct_diff,
    );
  } else {
    await rebalance_bids(
      bidsCount,
      halfTotal,
      bids,
      uuid,
      bid_amount,
      bid_placement,
    );
    await rebalance_listings(
      listingsCount,
      halfTotal,
      heldFarm,
      uuid,
      listings,
      list_mode,
      pct_diff,
    );
  }
  console.log(chalk.green(`[${getCurrentTimestamp()}] Rebalanced positions`));
  const success_embed = new EmbedBuilder()
    .setColor(0x3c66ba)
    .setTitle("Clarity - Tensor")
    .setDescription(
      `[${getCurrentTimestamp()}] Clarity has automatically rebalanced your tensor positions`,
    )
    .setThumbnail("https://i.imgur.com/GXtdPIG.png")
    .setTimestamp();

  axios.post(config_obj.webhook_url, { embeds: [success_embed] });
}

//Caller Function - DONE
async function rebalance_bids(
  bidsCount,
  halfTotal,
  bids,
  uuid,
  price,
  bid_placement,
) {
  let balance = await connection.getBalance(
    new PublicKey(wallet.publicKey.toString()),
  );

  let bid_price = await get_bids_on_collection(uuid);
  if (bid_placement > bid_price.data.tswapOrders.length) {
    bid_placement = bid_price.data.tswapOrders.length - 1;
  }
  let bid_lamports = parseInt(
    bid_price.data.tswapOrders[bid_placement - 1].sellNowPrice,
  );
  if (bidsCount > halfTotal) {
    console.log(
      chalk.cyan(
        `[${getCurrentTimestamp}] More bids than required. Removing some bids and rebalancing.`,
      ),
    );
    let sig = await cancel_bid(get_pool(bids));
    console.log(chalk.cyan(`[${getCurrentTimestamp}] Cancelled bid: ${sig}`));
    let price_update = await fetch_collection_data(uuid);
    let new_price = parseInt(price_update.sellNowPrice);
    let place_sig = await make_bid(bid_lamports, halfTotal, uuid);
    console.log(
      chalk.green(
        `[${getCurrentTimestamp()}] Bid Replaced (${bid_lamports / LAMPORTS_PER_SOL}): ${place_sig}`,
      ),
    );
  } else if (bidsCount < halfTotal) {
    console.log(
      chalk.cyan(
        `[${getCurrentTimestamp()}] Not enough bids. Placing more bids.`,
      ),
    );
    if (bidsCount === 0) {
    } else {
      let sig = await cancel_bid(get_pool(bids));
      console.log(
        chalk.cyan(
          `[${getCurrentTimestamp()}] Cancelled outstanding bids: ${sig}`,
        ),
      );
    }
    let price_update = await fetch_collection_data(uuid);
    let new_price = parseInt(price_update.sellNowPrice);
    let place_sig = await make_bid(bid_lamports, halfTotal, uuid);
    console.log(
      chalk.green(
        `[${getCurrentTimestamp()}] Replaced bids: (${bid_lamports / LAMPORTS_PER_SOL}) ${place_sig}`,
      ),
    );
  } else {
    console.log(
      chalk.green(
        `[${getCurrentTimestamp()}] Refreshing bid prices: (${bid_lamports / LAMPORTS_PER_SOL})`,
      ),
    );
    let sig = await cancel_bid(get_pool(bids));
    console.log(
      chalk.green(
        `[${getCurrentTimestamp()}] Cancelled outstanding bids: ${sig}`,
      ),
    );
    let price_update = await fetch_collection_data(uuid);
    let new_price = parseInt(price_update.sellNowPrice);
    let place_sig = await make_bid(bid_lamports, halfTotal, uuid);
    console.log(
      chalk.green(
        `[${getCurrentTimestamp()}] Replaced bids (${bid_lamports / LAMPORTS_PER_SOL}): ${place_sig}`,
      ),
    );
  }
}

//Caller Function - DONE
async function rebalance_listings(
  listingsCount,
  halfTotal,
  heldFarm,
  uuid,
  listings,
  list_mode,
  pct_diff,
) {
  heldFarm = await get_held(uuid);

  if (listingsCount > halfTotal) {
    console.log(
      chalk.cyan(
        `[${getCurrentTimestamp()}] More listings than required. Removing some listings.`,
      ),
    );
    const to_remove = listingsCount - halfTotal;

    for (let i = 0; i < to_remove; i++) {
      let temp = await cancel_listing(listings[i].tx.mintOnchainId, uuid);
      console.log(
        chalk.cyan(`[${getCurrentTimestamp()}] Cancelled Listing: ${temp}`),
      );
    }
  } else if (listingsCount < halfTotal) {
    console.log(
      chalk.cyan(
        `[${getCurrentTimestamp()}] Not enough listings. Listing more items.`,
      ),
    );
    let listingsToMake = halfTotal - listingsCount;
    console.log(
      chalk.cyan(
        `[${getCurrentTimestamp()}] Listings to make: ${listingsToMake}`,
      ),
    );

    if (listingsToMake > heldFarm.length) {
      console.log(
        chalk.cyan(
          `[${getCurrentTimestamp()}] Not enough held items to make required listings, waiting a cycle`,
        ),
      );
    } else {
      for (let i = 0; i < listingsToMake; i++) {
        let temp = await make_listing(heldFarm[i], uuid, list_mode, pct_diff);
        console.log(
          chalk.cyan(
            `[${getCurrentTimestamp()}] Made listing for ${uuid} at ${(pct_diff * 100).toFixed(2)}% ${list_mode} floor.`,
          ),
        );
      }
    }
  } else {
    const to_remove = halfTotal;
    listings = await get_listings(wallet.publicKey.toString(), uuid);

    for (let i = 0; i < to_remove; i++) {
      let temp = await cancel_listing(listings[i].tx.mintOnchainId);
      console.log(
        chalk.cyan(`[${getCurrentTimestamp()}] List Cancel Signature: ${temp}`),
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    heldFarm = await get_held(uuid);
    for (let i = 0; i < to_remove; i++) {
      let temp_2 = await make_listing(heldFarm[i], uuid, list_mode, pct_diff);
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log(
        chalk.cyan(
          `[${getCurrentTimestamp()}] List Relist Signature: ${temp_2}`,
        ),
      );
    }
  }
}

//Start Function - DONE
async function start_tensor(
  collection,
  total,
  list_mode,
  sleep_min,
  bid_placement,
  pct_diff,
) {
  const sleep_milli = parseFloat(sleep_min) * 60 * 1000;
  try {
    const uuid = collection.replaceAll("-", "");
    let heldFarm = await get_held(uuid);
    console.log(
      chalk.cyan(
        `[${getCurrentTimestamp()}] Currently holding ${heldFarm.length} ${uuid}`,
      ),
    );
    while (true) {
      await check_and_balance(
        wallet.publicKey.toString(),
        total,
        uuid,
        list_mode,
        bid_placement,
        pct_diff,
      );
      console.log(
        chalk.green(
          `[${getCurrentTimestamp()}] Sleeping for ${sleep_min} minutes`,
        ),
      );
      await new Promise((resolve) => setTimeout(resolve, sleep_milli));
    }
  } catch (error) {
    console.error("Error in start function:", error);
  }
}

export { start_tensor };
