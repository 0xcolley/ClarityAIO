import {Connection, Signer, Transaction} from "@solana/web3.js";

function Sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function send_tx (connection: Connection, transaction: Transaction, signers: Array<Signer>) {
    const hash_info = (await connection.getLatestBlockhashAndContext()).value;

    transaction.recentBlockhash = hash_info.blockhash;
    transaction.lastValidBlockHeight = hash_info.lastValidBlockHeight;
    transaction.feePayer = signers[0].publicKey;
    transaction.sign(...signers);

    const raw_tx = transaction.serialize();

    var txid: string;

    try {
        txid = await connection.sendRawTransaction(raw_tx, {skipPreflight: true});
    }
    catch(e) {
        return 1;
    }

    while(true) {
        const ret_tx = await connection.getSignatureStatus(txid, {searchTransactionHistory: true});

        try {
            if (ret_tx) {
                if (ret_tx.value && ret_tx.value.err == null) {
                    return 0;
                }
                else if (ret_tx.value && ret_tx.value.err != null) {
                    return 1;
                }
                else {
                    continue;
                }
            }
        }
        catch (e) {
            return 1;
        }
    }
}