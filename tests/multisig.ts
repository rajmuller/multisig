import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { expect } from "chai";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Multisig } from "../target/types/multisig";

type PDA = {
  multisigIdx: anchor.BN;
  multisigWalletPubKey: anchor.web3.PublicKey;
  multisigBump: number;

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

  let pda: PDA;

  let owners: anchor.web3.PublicKey[];

  const getPDAs = async (): Promise<PDA> => {
    const uid = new anchor.BN(parseInt((Date.now() / 1000).toString()));
    const uidBuffer = uid.toBuffer("le", 8);
    const [multisigWalletPubKey, multisigBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("multisig"), uidBuffer],
        program.programId
      );

    const proposalCount = new anchor.BN(0);
    const proposalCountBuffer = proposalCount.toBuffer("le", 8);
    const [transactionPubKey, transactionBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from("transaction"),
          multisigWalletPubKey.toBuffer(),
          proposalCountBuffer,
        ],
        program.programId
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
      pda.multisigWalletPubKey
    );

    const multiSigInfo = await provider.connection.getAccountInfo(
      pda.multisigWalletPubKey
    );

    return { multiSigState, multiSigInfo };
  };

  const readTransactionState = async () => {
    const transactionState = await program.account.transactionState.fetch(
      pda.transactionPubKey
    );

    const transactionInfo = await provider.connection.getAccountInfo(
      pda.transactionPubKey
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

    pda = await getPDAs();
  });

  it("It should initialize successfully!", async () => {
    await program.methods
      .initializeNewMultisigWallet(pda.multisigIdx, owners, threshold)
      .accounts({
        multisigWalletAccount: pda.multisigWalletPubKey,
        payer: ownerAKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ownerAKeypair])
      .rpc();

    const { multiSigState } = await readMultisigState();

    expect(multiSigState.idx.toString()).to.eql(pda.multisigIdx.toString());
    expect(multiSigState.proposalCounter.toString()).to.eql("0");
    expect(multiSigState.threshold.toString()).to.eql(threshold.toString());
    expect(multiSigState.owners).to.eql(owners);
  });

  it("It should fail if threshold is greaten than number of owners!", async () => {
    const overTheLimitThreshold = new anchor.BN(4);

    try {
      await program.methods
        .initializeNewMultisigWallet(
          pda.multisigIdx,
          owners,
          overTheLimitThreshold
        )
        .accounts({
          multisigWalletAccount: pda.multisigWalletPubKey,
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
      .initializeNewMultisigWallet(pda.multisigIdx, owners, threshold)
      .accounts({
        multisigWalletAccount: pda.multisigWalletPubKey,
        payer: ownerAKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ownerAKeypair])
      .rpc();

    const { multiSigState: previousMultiSigState } = await readMultisigState();

    // propose transaction
    await program.methods
      .proposeTransaction(receiverPubKey, amount)
      .accounts({
        transactionAccount: pda.transactionPubKey,
        multisigWalletAccount: pda.multisigWalletPubKey,
        proposer: ownerAKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ownerAKeypair])
      .rpc();

    const { multiSigState } = await readMultisigState();
    const { transactionState } = await readTransactionState();

    expect(multiSigState.proposalCounter.toNumber()).to.eql(
      previousMultiSigState.proposalCounter.toNumber() + 1
    );
    expect(transactionState.multisigWalletAddress).to.eql(
      pda.multisigWalletPubKey
    );
    expect(transactionState.proposalId.toNumber()).to.eql(0);
    expect(transactionState.approvers).to.eql([true, false, false]);
    expect(transactionState.didExecute).to.eql(false);
    expect(transactionState.to.toString()).to.eql(receiverPubKey.toString());
    expect(transactionState.amount.toString()).to.eql(amount.toString());
  });

  it("It should approve transaction", async () => {
    await program.methods
      .initializeNewMultisigWallet(pda.multisigIdx, owners, threshold)
      .accounts({
        multisigWalletAccount: pda.multisigWalletPubKey,
        payer: ownerAKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ownerAKeypair])
      .rpc();

    const { multiSigState: previousMultiSigState } = await readMultisigState();

    const proposalCount = previousMultiSigState.proposalCounter;

    // propose transaction
    await program.methods
      .proposeTransaction(receiverPubKey, amount)
      .accounts({
        transactionAccount: pda.transactionPubKey,
        multisigWalletAccount: pda.multisigWalletPubKey,
        proposer: ownerAKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ownerAKeypair])
      .rpc();

    await program.methods
      .approveTransaction()
      .accounts({
        transactionAccount: pda.transactionPubKey,
        multisigWalletAccount: pda.multisigWalletPubKey,
        approver: ownerBKeypair.publicKey,
      })
      .signers([ownerBKeypair])
      .rpc();

    const { transactionState } = await readTransactionState();
    expect(transactionState.approvers.toString()).to.equal(
      [true, true, false].toString()
    );
  });

  it("It should execute a transaction!", async () => {
    await program.methods
      .initializeNewMultisigWallet(pda.multisigIdx, owners, threshold)
      .accounts({
        multisigWalletAccount: pda.multisigWalletPubKey,
        payer: ownerAKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ownerAKeypair])
      .rpc();

    const { multiSigState: previousMultiSigState } = await readMultisigState();

    const proposalCount = previousMultiSigState.proposalCounter;

    // propose transaction
    await program.methods
      .proposeTransaction(receiverPubKey, amount)
      .accounts({
        transactionAccount: pda.transactionPubKey,
        multisigWalletAccount: pda.multisigWalletPubKey,
        proposer: ownerAKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ownerAKeypair])
      .rpc();

    const approveTx = await program.methods
      .approveTransaction()
      .accounts({
        transactionAccount: pda.transactionPubKey,
        multisigWalletAccount: pda.multisigWalletPubKey,
        approver: ownerBKeypair.publicKey,
      })
      .signers([ownerBKeypair])
      .rpc();

    await fundAccount(pda.multisigWalletPubKey);

    const {
      transactionState: { to: recipientPubKey },
    } = await readTransactionState();

    const previousMultisigBalance = await provider.connection.getBalance(
      pda.multisigWalletPubKey
    );

    await program.methods
      .executeTransaction()
      .accounts({
        multisigWalletAccount: pda.multisigWalletPubKey,
        transactionAccount: pda.transactionPubKey,
        recipient: recipientPubKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const { transactionState } = await readTransactionState();
    const recipientBalance = await provider.connection.getBalance(
      recipientPubKey
    );
    const multisigBalance = await provider.connection.getBalance(
      pda.multisigWalletPubKey
    );

    expect(transactionState.didExecute).to.equal(true);
    expect(recipientBalance).to.equal(amount.toNumber());
    expect(previousMultisigBalance - amount.toNumber()).to.equal(
      multisigBalance
    );
  });
});
