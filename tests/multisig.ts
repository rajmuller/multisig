import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { expect } from "chai";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Multisig } from "../target/types/multisig";

type MultisigPDA = {
  multisigIdx: anchor.BN;
  multisigWalletPubKey: anchor.web3.PublicKey;
  multisigBump: number;
};

type TransactionPDA = {
  transactionIdx: anchor.BN;
  transactionPubKey: anchor.web3.PublicKey;
  transactionBump: number;
};

describe("multisig", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Multisig as Program<Multisig>;
  const MultiSigError = program.idl.errors as Multisig["errors"];

  const threshold = new anchor.BN(2);
  const amount = new anchor.BN(0.69 * LAMPORTS_PER_SOL);

  let ownerAKeypair: anchor.web3.Keypair;
  let ownerBKeypair: anchor.web3.Keypair;
  let ownerCKeypair: anchor.web3.Keypair;
  let receiverPubKey: anchor.web3.PublicKey;

  let multisigPDA: MultisigPDA;

  let owners: anchor.web3.PublicKey[];

  const getMultisigPDA = async (): Promise<MultisigPDA> => {
    const uid = new anchor.BN(parseInt((Date.now() / 1000).toString()));
    const uidBuffer = uid.toBuffer("le", 8);

    const [multisigWalletPubKey, multisigBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("multisig")],
        program.programId
      );
    return {
      multisigIdx: uid,
      multisigWalletPubKey,
      multisigBump,
    };
  };

  const getTransactionPDA = async (
    multisigPubKey: anchor.web3.PublicKey,
    proposalCount: anchor.BN
  ): Promise<TransactionPDA> => {
    const proposalCountBuffer = proposalCount.toBuffer("le", 8);

    const [transactionPubKey, transactionBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from("transaction"),
          // multisigPubKey.toBuffer(),
          // proposalCountBuffer,
        ],
        program.programId
      );
    return {
      transactionIdx: proposalCount,
      transactionPubKey,
      transactionBump,
    };
  };

  const fundAccount = async (publicKey: anchor.web3.PublicKey) => {
    const txFund = new anchor.web3.Transaction();

    txFund.add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: publicKey,
        lamports: 5 * anchor.web3.LAMPORTS_PER_SOL,
      })
    );
    const sigTxFund = await provider.sendAndConfirm(txFund);

    return sigTxFund;
  };

  const createAndFundUser = async () => {
    const user = anchor.web3.Keypair.generate();
    await fundAccount(user.publicKey);

    return user;
  };

  const readMultisigState = async () => {
    const multiSigState = await program.account.multisigWalletState.fetch(
      multisigPDA.multisigWalletPubKey
    );

    const multiSigInfo = await provider.connection.getAccountInfo(
      multisigPDA.multisigWalletPubKey
    );

    return { multiSigState, multiSigInfo };
  };

  const readTransactionState = async (
    transactionPubkey: anchor.web3.PublicKey
  ) => {
    const transactionState = await program.account.transactionState.fetch(
      transactionPubkey
    );

    const transactionInfo = await provider.connection.getAccountInfo(
      transactionPubkey
    );

    return { transactionState, transactionInfo };
  };

  beforeEach(async () => {
    ownerAKeypair = await createAndFundUser();
    ownerBKeypair = await createAndFundUser();
    ownerCKeypair = await createAndFundUser();
    receiverPubKey = anchor.web3.Keypair.generate().publicKey;

    owners = [
      ownerAKeypair.publicKey,
      ownerBKeypair.publicKey,
      ownerCKeypair.publicKey,
    ];

    multisigPDA = await getMultisigPDA();
  });

  it("It should initialize successfully!", async () => {
    await program.methods
      .initializeNewMultisigWallet(multisigPDA.multisigIdx, owners, threshold)
      .accounts({
        multisigWalletAccount: multisigPDA.multisigWalletPubKey,
        payer: ownerAKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ownerAKeypair])
      .rpc();

    const { multiSigState } = await readMultisigState();

    expect(multiSigState.idx.toString()).to.eql(
      multisigPDA.multisigIdx.toString()
    );
    expect(multiSigState.proposalCounter.toString()).to.eql("0");
    expect(multiSigState.threshold.toString()).to.eql(threshold.toString());
    expect(multiSigState.owners).to.eql(owners);
  });

  it("It should fail if threshold is greaten than number of owners!", async () => {
    const overTheLimitThreshold = new anchor.BN(4);

    try {
      await program.methods
        .initializeNewMultisigWallet(
          multisigPDA.multisigIdx,
          owners,
          overTheLimitThreshold
        )
        .accounts({
          multisigWalletAccount: multisigPDA.multisigWalletPubKey,
          payer: ownerAKeypair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([ownerAKeypair])
        .rpc();
    } catch (error) {
      const invalidThresholdError = MultiSigError[7];
      expect(error.error.errorMessage).to.equal(invalidThresholdError.msg);
      expect(error.error.errorCode.code).to.equal(invalidThresholdError.name);
      expect(error.error.errorCode.number).to.equal(invalidThresholdError.code);
    }
  });

  it("It should propose a transaction!", async () => {
    await program.methods
      .initializeNewMultisigWallet(multisigPDA.multisigIdx, owners, threshold)
      .accounts({
        multisigWalletAccount: multisigPDA.multisigWalletPubKey,
        payer: ownerAKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ownerAKeypair])
      .rpc();

    const { multiSigState: previousMultiSigState } = await readMultisigState();

    const proposalCount = previousMultiSigState.proposalCounter;

    const { transactionPubKey } = await getTransactionPDA(
      multisigPDA.multisigWalletPubKey,
      proposalCount
    );

    // propose transaction
    await program.methods
      .proposeTransaction(receiverPubKey, amount)
      .accounts({
        transactionAccount: transactionPubKey,
        multisigWalletAccount: multisigPDA.multisigWalletPubKey,
        proposer: ownerAKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ownerAKeypair])
      .rpc();

    const { multiSigState } = await readMultisigState();
    const { transactionState } = await readTransactionState(transactionPubKey);

    expect(multiSigState.proposalCounter.toNumber()).to.eql(
      previousMultiSigState.proposalCounter.toNumber() + 1
    );
    expect(transactionState.multisigWalletAddress).to.eql(
      multisigPDA.multisigWalletPubKey
    );
    expect(transactionState.proposalId.toNumber()).to.eql(0);
    expect(transactionState.approvers).to.eql([true, false, false]);
    expect(transactionState.didExecute).to.eql(false);
    expect(transactionState.to.toString()).to.eql(receiverPubKey.toString());
    expect(transactionState.amount.toString()).to.eql(amount.toString());
  });

  it("It should approve transaction", async () => {
    await program.methods
      .initializeNewMultisigWallet(multisigPDA.multisigIdx, owners, threshold)
      .accounts({
        multisigWalletAccount: multisigPDA.multisigWalletPubKey,
        payer: ownerAKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ownerAKeypair])
      .rpc();

    const { multiSigState: previousMultiSigState } = await readMultisigState();

    const proposalCount = previousMultiSigState.proposalCounter;

    const { transactionPubKey } = await getTransactionPDA(
      multisigPDA.multisigWalletPubKey,
      proposalCount
    );

    // propose transaction
    await program.methods
      .proposeTransaction(receiverPubKey, amount)
      .accounts({
        transactionAccount: transactionPubKey,
        multisigWalletAccount: multisigPDA.multisigWalletPubKey,
        proposer: ownerAKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ownerAKeypair])
      .rpc();

    await program.methods
      .approveTransaction()
      .accounts({
        transactionAccount: transactionPubKey,
        multisigWalletAccount: multisigPDA.multisigWalletPubKey,
        approver: ownerBKeypair.publicKey,
      })
      .signers([ownerBKeypair])
      .rpc();

    const { transactionState } = await readTransactionState(transactionPubKey);
    expect(transactionState.approvers.toString()).to.equal(
      [true, true, false].toString()
    );
  });

  it.only("It should execute a transaction!", async () => {
    await program.methods
      .initializeNewMultisigWallet(multisigPDA.multisigIdx, owners, threshold)
      .accounts({
        multisigWalletAccount: multisigPDA.multisigWalletPubKey,
        payer: ownerAKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ownerAKeypair])
      .rpc();

    const { multiSigState: previousMultiSigState } = await readMultisigState();

    const proposalCount = previousMultiSigState.proposalCounter;

    const { transactionPubKey, transactionBump } = await getTransactionPDA(
      multisigPDA.multisigWalletPubKey,
      proposalCount
    );

    // propose transaction
    await program.methods
      .proposeTransaction(receiverPubKey, amount)
      .accounts({
        transactionAccount: transactionPubKey,
        multisigWalletAccount: multisigPDA.multisigWalletPubKey,
        proposer: ownerAKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ownerAKeypair])
      .rpc();

    const approveTx = await program.methods
      .approveTransaction()
      .accounts({
        transactionAccount: transactionPubKey,
        multisigWalletAccount: multisigPDA.multisigWalletPubKey,
        approver: ownerBKeypair.publicKey,
      })
      .signers([ownerBKeypair])
      .rpc();

    await fundAccount(multisigPDA.multisigWalletPubKey);
    const { multiSigInfo } = await readMultisigState();

    const {
      transactionState: { to: recipientPubKey },
    } = await readTransactionState(transactionPubKey);

    const txExe = await program.methods
      .executeTransaction()
      .accounts({
        multisigWalletAccount: multisigPDA.multisigWalletPubKey,
        transactionAccount: transactionPubKey,
        recipient: recipientPubKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .executeTransaction()
      .accounts({
        multisigWalletAccount: multisigPDA.multisigWalletPubKey,
        transactionAccount: transactionPubKey,
        recipient: recipientPubKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // const logExe = await provider.connection.getTransaction(txExe, {
    //   commitment: "confirmed",
    // });
    // console.log(logExe.meta.logMessages);

    const { transactionState } = await readTransactionState(transactionPubKey);
    console.log({ transactionState });
    const recipientBalance = await provider.connection.getBalance(
      recipientPubKey
    );
    const multisigBalance = await provider.connection.getBalance(
      multisigPDA.multisigWalletPubKey
    );
    console.log({ recipientBalance });
    console.log({ multisigBalance });
  });
});
