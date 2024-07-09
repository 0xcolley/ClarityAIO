import { AnchorProvider, BN } from '@coral-xyz/anchor';
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
	DriftClient,
	User,
	initialize,
	PositionDirection,
	convertToNumber,
	PRICE_PRECISION,
	QUOTE_PRECISION,
	Wallet,
	PerpMarkets,
	BASE_PRECISION,
	getMarketOrderParams,
	BulkAccountLoader,
	getMarketsAndOraclesForSubscription
} from '@drift-labs/sdk';

//untested and has no close function

function loadConfig() {
    const configPath = path.join('config.json');
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
}
  
const config_obj = loadConfig();

const drift_env = 'mainnet-beta';
const connection = new Connection(config_obj.main_rpc, "confirmed");
const keypair_long = new Keypair.fromSecretKey(bs58.decode(config_obj.farmer.long_wallet));
const keypair_short = new Keypair.fromSecretKey(bs58.decode(config_obj.farmer.short_wallet));
const long_wallet = new Wallet(keypair_long);
const short_wallet = new Wallet(keypair_short);

const lamports_long = await connection.getBalance(keypair_long.publicKey);
const lamports_short = await connection.getBalance(keypair_short.publicKey);

const provider_long = new AnchorProvider(
    connection,
    long_wallet,
    AnchorProvider.defaultOptions()
);

const provider_short = new AnchorProvider(
    connection,
    short_wallet,
    AnchorProvider.defaultOptions()
);

console.log('SOL Long Balance:', lamports_long / 10 ** 9);
console.log('SOL Short Balance:', lamports_short / 10 ** 9);

const usdc_token = await getTokenAddress(
    sdkConfig.USDC_MINT_ADDRESS,
    keypair_long.publicKey.toString()
);

const drift_pkey = new PublicKey(sdkConfig.DRIFT_PROGRAM_ID);
const bulk_loader = new BulkAccountLoader(
    connection,
    'confirmed',
    1000
);

const drift_client_long = new DriftClient({
    connection,
    wallet: provider_long.wallet,
    programID: drift_pkey,
    ...getMarketsAndOraclesForSubscription(drift_env),
    accountSubscription: {
        type: 'polling',
        accountLoader: bulk_loader,
    },
});

const drift_client_short = new DriftClient({
    connection,
    wallet: provider_short.wallet,
    programID: drift_pkey,
    ...getMarketsAndOraclesForSubscription(drift_env),
    accountSubscription: {
        type: 'polling',
        accountLoader: bulk_loader,
    },
});

const user_long = new User({
    driftClient: drift_client_long,
    userAccountPublicKey: await drift_client_long.getUserAccountPublicKey(),
    accountSubscription: {
        type: 'polling',
        accountLoader: bulkAccountLoader,
    },
});

const user_short = new User({
    driftClient: drift_client_short,
    userAccountPublicKey: await drift_client_short.getUserAccountPublicKey(),
    accountSubscription: {
        type: 'polling',
        accountLoader: bulkAccountLoader,
    },
});

const user_long_exists = await user_long.exists();
const user_short_exists = await user_short.exists();

await drift_client_long.subscribe();
await drift_client_short.subscribe();

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

async function make_orders(size) {
    size = parseInt(size);
    const sol_market_info = PerpMarkets[drift_env].find(
        (market) => market.baseAssetSymbol === 'SOL'
    );

    const [bid, ask] = calculateBidAskPrice(
        drift_client_long.getPerpMarketAccount(marketIndex).amm,
        drift_client_long.getOracleDataForPerpMarket(marketIndex)
    );

    const format_bid_price = convertToNumber(bid, PRICE_PRECISION);
    const format_ask_price = convertToNumber(ask, PRICE_PRECISION);

    console.log(
        `Current AMM Stats |  BID: $${format_bid_price} | ASK: $${format_ask_price}`
    );

    const sol_market_account = driftClient.getPerpMarketAccount(
        sol_market_info.marketIndex
    );

    const slippage = convertToNumber(
        calculateTradeSlippage(
            PositionDirection.LONG,
            new BN(size/2).mul(BASE_PRECISION),
            sol_market_account,
            'base',
            drift_client_long.getOracleDataForPerpMarket(sol_market_info.marketIndex)
        )[0],
        PRICE_PRECISION
    );
    
    console.log(`Current Slippage for ${size/2} SOL Perp Position`);

    await drift_client_long.placePerpOrder(
        getMarketOrderParams({
            baseAssetAmount: new BN(size/2).mul(BASE_PRECISION),
            direction: PositionDirection.LONG,
            marketIndex: sol_market_account.marketIndex,
        })
    );

    await drift_client_short.placePerpOrder(
        getMarketOrderParams({
            baseAssetAmount: new BN(size/2).mul(BASE_PRECISION),
            direction: PositionDirection.SHORT,
            marketIndex: sol_market_account.marketIndex,
        })
    );
    console.log('Placed Delta Neutral PERP Order for SOL ');
    await new Promise((resolve) => setTimeout(resolve, 1500));
}





