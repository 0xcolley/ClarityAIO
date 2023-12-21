import { Liquidity, Percent, Token, TokenAccount, TokenAmount } from "@raydium-io/raydium-sdk";
import {Connection,Keypair,Transaction,} from "@solana/web3.js";
import { send_tx } from "../send_tx.js";

export async function swap(connection: Connection, poolKeys: any, ownerKeypair: Keypair, tokenAccounts: TokenAccount[], is_snipe: boolean, amountIn: any, minAmountOut: any) {
    const owner = ownerKeypair.publicKey;

    const fetch_inst = await Liquidity.makeSwapInstructionSimple({
        connection: connection,
        poolKeys: poolKeys,
        userKeys: {
            tokenAccounts,
            owner
        },
        amountIn,
        amountOut: minAmountOut,
        fixedSide: 'in',
        config: {}
    });

    const instructions = fetch_inst.innerTransactions[0].instructions[0];

    const tx = new Transaction();
    const signers: Keypair[] = [ownerKeypair];

    fetch_inst.innerTransactions[0].instructions.forEach(ins => {
        tx.add(ins)
    });

    fetch_inst.innerTransactions[0].signers.forEach(sgn => {
        signers.push(sgn);
    });

    const res: number = await send_tx(connection, tx, signers);
    return res;
}