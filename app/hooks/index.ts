import {
  AnchorProvider,
  BN,
  Program,
  ProgramAccount,
  web3,
} from "@project-serum/anchor";
import {
  IdlTypes,
  TypeDef,
} from "@project-serum/anchor/dist/cjs/program/namespace/types";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import { Multisig, PDA } from "types";
import idl from "types/multisig.json";
import { z } from "zod";

const programId = new web3.PublicKey(
  "8XHSyugWk2uYagCREiD2fSRkgGcTPYvwipXgd9c7em2i"
);

const a = JSON.stringify(idl);
const multiSigIdl = JSON.parse(a);

const getMultisigPDA = async (): Promise<PDA> => {
  const uid = new BN(parseInt((Date.now() / 1000).toString()));
  // const uidBuffer = uid.toBuffer("le", 8);
  // const uidBuffer = Buffer.from(uid, "base64url");
  const uidBuffer = uid.toArrayLike(Buffer, "le", 8);
  const [multisigWalletPubKey, multisigBump] =
    await web3.PublicKey.findProgramAddress(
      [Buffer.from("multisig"), uidBuffer],
      programId
    );

  return {
    Idx: uid,
    pubKey: multisigWalletPubKey,
    bump: multisigBump,
  };
};

export const useBalance = (keyString?: string) => {
  const [balance, setBalance] = useState("");
  const { connection } = useConnection();

  const fetchBalance = useCallback(
    async (pubKey: web3.PublicKey) => {
      const _balance = await connection.getBalance(new web3.PublicKey(pubKey!));

      setBalance((_balance / LAMPORTS_PER_SOL).toString());
    },
    [connection]
  );

  useEffect(() => {
    if (!balance && keyString) {
      fetchBalance(new web3.PublicKey(keyString));
    }
  }, [balance, fetchBalance, keyString]);

  return balance;
};

const getTransactionPDA = async (
  multisigWalletPubKey: web3.PublicKey,
  proposalCount: BN
): Promise<PDA> => {
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
    Idx: proposalCount,
    pubKey: transactionPubKey,
    bump: transactionBump,
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

  const [wallets, setWallets] =
    useState<ProgramAccount<TypeDef<any, IdlTypes<Multisig>>>>();

  const fetchWallets = useCallback(async () => {
    const _wallets = await program?.account.multisigWalletState.all();
    // _wallets[0].account.
    if (filter) {
      const wallet = _wallets?.find(
        (wallet) => wallet.publicKey.toString() == filter
      );
      setWallets(wallet as any);
    } else {
      setWallets(_wallets as any);
    }
  }, [filter, program?.account.multisigWalletState]);

  useEffect(() => {
    if (wallets) {
      return;
    }

    fetchWallets();
  }, [fetchWallets, wallets]);

  return wallets;
};

export const useFetchTransactions = () => {
  const program = useProgram();

  const [transactions, setTransactions] = useState();

  const fetchTransactions = useCallback(async () => {
    const _transactions = await program?.account.transactionState.all();
    setTransactions(_transactions);
  }, [program?.account.transactionState]);

  useEffect(() => {
    if (transactions) {
      return;
    }

    fetchTransactions();
  }, [fetchTransactions, transactions]);

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
    if (!program || !ownerA || !ownerB || !ownerC || !threshold) {
      return;
    }

    const multisigPDA = await getMultisigPDA();

    const ownerAPubKey = new web3.PublicKey(ownerA);
    const ownerBPubKey = new web3.PublicKey(ownerB);
    const ownerCPubKey = new web3.PublicKey(ownerC);
    const thresholdBn = new BN(threshold);

    const tx = await program.methods
      .initializeNewMultisigWallet(
        multisigPDA.Idx,
        [ownerAPubKey, ownerBPubKey, ownerCPubKey],
        thresholdBn
      )
      .accounts({
        multisigWalletAccount: multisigPDA.pubKey,
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

export const useProposeTransaction = (
  to?: string,
  amount?: string,
  multisigWalletKeyString?: string,
  proposalCount?: string
) => {
  const [receipt, setReceipt] = useState<web3.TransactionResponse | null>();
  const program = useProgram();

  const onProposeTransaction = useCallback(async () => {
    if (
      !program ||
      !to ||
      !amount ||
      !multisigWalletKeyString ||
      !proposalCount
    ) {
      return;
    }

    const multisigWalletPubKey = new web3.PublicKey(multisigWalletKeyString);
    const proposalCountBn = new BN(proposalCount);

    const transactionPDA = await getTransactionPDA(
      multisigWalletPubKey,
      proposalCountBn
    );

    const recipientPubKey = new web3.PublicKey(to);
    const amountInSol = new BN(parseFloat(amount) * LAMPORTS_PER_SOL);

    const tx = await program.methods
      .proposeTransaction(recipientPubKey, amountInSol)
      .accounts({
        multisigWalletAccount: multisigWalletPubKey,
        transactionAccount: transactionPDA.pubKey,
        proposer: program.provider.publicKey,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const receipt = await program.provider.connection.getTransaction(tx, {
      commitment: "confirmed",
    });
    setReceipt(receipt);
  }, [amount, multisigWalletKeyString, program, proposalCount, to]);

  return {
    onProposeTransaction,
    receipt,
  };
};

export const useApproveTransaction = (
  multisigWalletKeyString: string | undefined,
  proposalKeyString: string | undefined
) => {
  const [receipt, setReceipt] = useState<web3.TransactionResponse | null>();
  const program = useProgram();

  const onApproveTransaction = useCallback(async () => {
    if (!program || !multisigWalletKeyString || !proposalKeyString) {
      return;
    }

    const multisigWalletPubKey = new web3.PublicKey(multisigWalletKeyString);
    const transactionPubKey = new web3.PublicKey(proposalKeyString);

    const tx = await program.methods
      .approveTransaction()
      .accounts({
        multisigWalletAccount: multisigWalletPubKey,
        transactionAccount: transactionPubKey,
        approver: program.provider.publicKey,
      })
      .rpc();

    const receipt = await program.provider.connection.getTransaction(tx, {
      commitment: "confirmed",
    });
    setReceipt(receipt);
  }, [multisigWalletKeyString, program, proposalKeyString]);

  return {
    onApproveTransaction,
    receipt,
  };
};

export const useExecuteTransaction = (
  multisigWalletKeyString: string | undefined,
  proposalKeyString: string | undefined,
  recipientKeyString: string | undefined
) => {
  const [receipt, setReceipt] = useState<web3.TransactionResponse | null>();
  const program = useProgram();

  const onExecuteTransaction = useCallback(async () => {
    if (
      !program ||
      !multisigWalletKeyString ||
      !proposalKeyString ||
      !recipientKeyString
    ) {
      return;
    }

    const multisigWalletPubKey = new web3.PublicKey(multisigWalletKeyString);
    const transactionPubKey = new web3.PublicKey(proposalKeyString);
    const recipientPubKey = new web3.PublicKey(recipientKeyString);

    const tx = await program.methods
      .executeTransaction()
      .accounts({
        multisigWalletAccount: multisigWalletPubKey,
        recipient: recipientPubKey,
        systemProgram: web3.SystemProgram.programId,
        transactionAccount: transactionPubKey,
      })
      .rpc();

    const receipt = await program.provider.connection.getTransaction(tx, {
      commitment: "confirmed",
    });
    setReceipt(receipt);
  }, [multisigWalletKeyString, program, proposalKeyString, recipientKeyString]);

  return {
    onExecuteTransaction,
    receipt,
  };
};
