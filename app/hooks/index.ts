import { AnchorProvider, BN, Program, web3 } from "@project-serum/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useCallback, useState } from "react";
import { useMutation, useQuery } from "react-query";
import { Multisig } from "types";
import idl from "types/idl.json";

export type ArrElement<ArrType> = ArrType extends readonly (infer ElementType)[]
  ? ElementType
  : never;

export type PDA = {
  Idx: BN;
  pubKey: web3.PublicKey;
  bump: number;
};

const programId = new web3.PublicKey(
  "13sFxyR2ZLYWMN9xQJNo8C7JXiXXqfocgrnz3sVHttV3"
);

const a = JSON.stringify(idl);
const multiSigIdl = JSON.parse(a);

const useMultisigPDA = (): PDA | undefined => {
  const { data } = useQuery(["pda", "multisig"], async () => {
    const uid = new BN(parseInt((Date.now() / 1000).toString()));
    const uidBuffer = uid.toArrayLike(Buffer, "le", 8);
    const data = await web3.PublicKey.findProgramAddress(
      [Buffer.from("multisig"), uidBuffer],
      programId
    );

    return { data, uid };
  });

  if (!data) {
    return;
  }
  const {
    data: [pubKey, bump],
    uid,
  } = data;

  return { bump, Idx: uid, pubKey };
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
    return;
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

export const useBalance = (keyString: string | undefined) => {
  const { connection } = useConnection();

  const { data } = useQuery(
    ["balance", keyString],
    async () => {
      const data = await connection.getBalance(new web3.PublicKey(keyString!));
      return data;
    },
    {
      enabled: !!keyString,
    }
  );

  return data;
};

export const useMultisigWallet = (pubKeyString: string | undefined) => {
  const program = useProgram();

  return useQuery(
    ["multisigWallet"],
    async () => {
      const data = await program!.account.multisigWalletState.fetch(
        new web3.PublicKey(pubKeyString!)
      );
      return data;
    },
    {
      enabled: !!program || !!pubKeyString,
    }
  );
};

export const useMultisigWallets = () => {
  const program = useProgram();

  return useQuery(
    ["multisigWallets"],
    async () => {
      const data = await program!.account.multisigWalletState.all();
      return data;
    },
    {
      enabled: !!program,
    }
  );
};

type MultisigWalletListType = ReturnType<typeof useMultisigWallets>["data"];
export type MultisigWalletType = ArrElement<MultisigWalletListType>;

export const useTransactions = () => {
  const program = useProgram();

  return useQuery(
    ["transactions"],
    async () => {
      const data = await program?.account.transactionState.all();
      return data;
    },
    {
      enabled: !!program,
    }
  );
};

type TransactionListType = ReturnType<typeof useTransactions>["data"];
export type TransactionType = ArrElement<TransactionListType>;

export const useInitializeMultisigWallet = (
  ownerA?: string,
  ownerB?: string,
  ownerC?: string,
  threshold?: string
) => {
  const program = useProgram();
  const multisigPDA = useMultisigPDA();

  const mutation = useMutation(() => {
    const ownerAPubKey = new web3.PublicKey(ownerA!);
    const ownerBPubKey = new web3.PublicKey(ownerB!);
    const ownerCPubKey = new web3.PublicKey(ownerC!);
    const thresholdBn = new BN(threshold!);

    console.log({ ownerA });
    console.log(multisigPDA?.pubKey.toString());

    return program!.methods
      .initializeNewMultisigWallet(
        multisigPDA!.Idx,
        [ownerAPubKey, ownerBPubKey, ownerCPubKey],
        thresholdBn
      )
      .accounts({
        multisigWalletAccount: multisigPDA!.pubKey,
        payer: program!.provider.publicKey,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
  });

  const onInitMultisigWallet = useCallback(() => {
    if (
      !ownerA ||
      !ownerB ||
      !ownerC ||
      !threshold ||
      !program ||
      !multisigPDA
    ) {
      console.error("onInitMultisigWallet missing prop!");
      return;
    }

    mutation.mutate();
  }, [multisigPDA, mutation, ownerA, ownerB, ownerC, program, threshold]);

  return { onInitMultisigWallet, status: mutation.status };
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
