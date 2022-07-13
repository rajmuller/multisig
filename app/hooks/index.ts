import { AnchorProvider, BN, Program, web3 } from "@project-serum/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";
import { Multisig, PDA } from "types";
import idl from "types/multisig.json";

const programId = new web3.PublicKey(
  "8XHSyugWk2uYagCREiD2fSRkgGcTPYvwipXgd9c7em2i"
);

const a = JSON.stringify(idl);
const multiSigIdl = JSON.parse(a);

const generatePDA = async (): Promise<PDA> => {
  const uid = new BN(parseInt((Date.now() / 1000).toString()));
  // const uidBuffer = uid.toBuffer("le", 8);
  // const uidBuffer = Buffer.from(uid, "base64url");
  const uidBuffer = uid.toArrayLike(Buffer, "le", 8);
  const [multisigWalletPubKey, multisigBump] =
    await web3.PublicKey.findProgramAddress(
      [Buffer.from("multisig"), uidBuffer],
      programId
    );

  const proposalCount = new BN(0);
  // const proposalCountBuffer = proposalCount.toBuffer("le", 8);
  const proposalCountBuffer = proposalCount.toArrayLike(Buffer, "le", 8);
  const [transactionPubKey, transactionBump] =
    await web3.PublicKey.findProgramAddress(
      [
        Buffer.from("transaction"),
        multisigWalletPubKey.toBuffer(),
        proposalCountBuffer,
      ],
      programId
    );

  return {
    multisigIdx: uid,
    multisigWalletPubKey,
    multisigBump,

    transactionIdx: proposalCount,
    transactionPubKey,
    transactionBump,
  };
};

const getPDA = async (): Promise<PDA> => {
  const uid = new BN(parseInt((Date.now() / 1000).toString()));
  const uidBuffer = uid.toBuffer("le", 8);
  const [multisigWalletPubKey, multisigBump] =
    await web3.PublicKey.findProgramAddress(
      [Buffer.from("multisig"), uidBuffer],
      programId
    );

  const proposalCount = new BN(0);
  const proposalCountBuffer = proposalCount.toBuffer("le", 8);
  const [transactionPubKey, transactionBump] =
    await web3.PublicKey.findProgramAddress(
      [
        Buffer.from("transaction"),
        multisigWalletPubKey.toBuffer(),
        proposalCountBuffer,
      ],
      programId
    );

  return {
    multisigIdx: uid,
    multisigWalletPubKey,
    multisigBump,

    transactionIdx: proposalCount,
    transactionPubKey,
    transactionBump,
  };
};

export const useProgram = () => {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();

  if (!wallet) {
    return null;
  }

  const provider = new AnchorProvider(connection, wallet, {
    preflightCommitment: "processed",
  });

  const program = new Program(
    multiSigIdl,
    programId,
    provider
  ) as unknown as Program<Multisig>;

  return program;
};

export const useFetchMultisigWallets = (filter?: string) => {
  const program = useProgram();
  const fetchWalletState = program!.account.multisigWalletState.all;
  type FetchWalletState = Awaited<ReturnType<typeof fetchWalletState>>;

  const [wallets, setWallets] = useState<FetchWalletState>();

  const fetchWallets = useCallback(async () => {
    const _wallets = await program?.account.multisigWalletState.all();
    if (filter) {
      _wallets?.filter((wallet) => wallet.publicKey.toString() == filter);
      setWallets(_wallets);
    } else {
      setWallets(_wallets);
    }
  }, [filter, program?.account.multisigWalletState]);

  useEffect(() => {
    if (!wallets) {
      fetchWallets();
    }
  }, [fetchWallets, wallets]);

  return wallets;
};

export const useFetchTransactions = () => {
  const program = useProgram();
  const fetchTransactionState = program!.account.transactionState.all;
  type FetchTransactionState = Awaited<
    ReturnType<typeof fetchTransactionState>
  >;

  const [transactions, setTransactions] = useState<FetchTransactionState>();

  const fetchTransactions = useCallback(async () => {
    const _transactions = await program?.account.transactionState.all();
    setTransactions(_transactions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return transactions;
};

export const useInitMultisigWallet = (
  ownerA?: string,
  ownerB?: string,
  ownerC?: string,
  threshold?: string
) => {
  const [receipt, setReceipt] = useState<web3.TransactionResponse | null>();
  const program = useProgram();

  const onInitMultisigWallet = useCallback(async () => {
    const pda = await generatePDA();
    console.log({ pda });

    if (!program || !ownerA || !ownerB || !ownerC || !threshold) {
      return;
    }

    const ownerAPubKey = new web3.PublicKey(ownerA);
    const ownerBPubKey = new web3.PublicKey(ownerB);
    const ownerCPubKey = new web3.PublicKey(ownerC);
    const thresholdBn = new BN(threshold);

    const tx = await program.methods
      .initializeNewMultisigWallet(
        pda.multisigIdx,
        [ownerAPubKey, ownerBPubKey, ownerCPubKey],
        thresholdBn
      )
      .accounts({
        multisigWalletAccount: pda.multisigWalletPubKey,
        payer: program.provider.publicKey,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const receipt = await program.provider.connection.getTransaction(tx, {
      commitment: "confirmed",
    });
    setReceipt(receipt);
  }, [ownerA, ownerB, ownerC, program, threshold]);

  return {
    onInitMultisigWallet,
    receipt,
  };
};
