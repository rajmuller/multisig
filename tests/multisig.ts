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
        [Buffer.from("multisig"), uidBuffer],
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
          multisigPubKey.toBuffer(),
          proposalCountBuffer,
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
    expect(transactionState.approvers).to.equal([true, true, false]);
  });

  it("It should execute a transaction!", async () => {
    const walletKeypair = anchor.web3.Keypair.generate();

    const ownerAKeypair = await createAndFundUser();
    const ownerBKeypair = anchor.web3.Keypair.generate();
    const ownerCKeypair = anchor.web3.Keypair.generate();
    const receiverKeypair = anchor.web3.Keypair.generate();

    const owners = [
      ownerAKeypair.publicKey,
      ownerBKeypair.publicKey,
      ownerCKeypair.publicKey,
    ];
    const threshold = new anchor.BN(2);

    await program.methods
      .createWallet(owners, threshold)
      .accounts({
        wallet: walletKeypair.publicKey,
      })
      .signers([walletKeypair])
      .preInstructions([
        await program.account.wallet.createInstruction(
          walletKeypair,
          multisigSize
        ),
      ])
      .rpc();

    await fundAccount(walletKeypair.publicKey);

    const previousWalletAccountState = await program.account.wallet.fetch(
      walletKeypair.publicKey
    );

    const proposalId = previousWalletAccountState.proposalCounter.toString();
    const amount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);

    const [transactionAccount] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("transaction"),
        walletKeypair.publicKey.toBuffer(),
        Buffer.from(proposalId),
      ],
      program.programId
    );

    // propose transaction
    await program.methods
      .proposeTransaction(receiverKeypair.publicKey, amount)
      .accounts({
        wallet: walletKeypair.publicKey,
        transaction: transactionAccount,
        payer: program.provider.publicKey,
        proposer: ownerAKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([ownerAKeypair])
      .rpc();

    // approve transaction
    await program.methods
      .approveTransaction()
      .accounts({
        wallet: walletKeypair.publicKey,
        transaction: transactionAccount,
        approver: ownerBKeypair.publicKey,
      })
      .signers([ownerBKeypair])
      .rpc();

    const transactionAccountState = await program.account.transaction.fetch(
      transactionAccount
    );

    const walletKeypairInfo =
      await provider.connection.getAccountInfoAndContext(
        walletKeypair.publicKey
      );

    const OwnerAAccountInfo =
      await provider.connection.getAccountInfoAndContext(
        walletKeypair.publicKey
      );

    console.log(walletKeypairInfo.value.owner.toString());
    console.log(OwnerAAccountInfo.value.owner.toString());
    console.log(program.programId.toString());

    await program.methods
      .executeTransaction()
      .accounts({
        // wallet: walletKeypair.publicKey,
        from: walletKeypair.publicKey,
        // transaction: transactionAccount,
        recipient: receiverKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([walletKeypair])
      .rpc();

    // const transactionAccountState = await program.account.transaction.fetch(
    //   transactionAccount
    // );
    // const walletAccountState = await program.account.wallet.fetch(
    //   walletKeypair.publicKey
    // );

    // console.log("transAccountState :", transactionAccountState);

    // expect(walletAccountState.proposalCounter.toString()).to.eql("1");
    // expect(transactionAccountState.wallet).to.eql(walletKeypair.publicKey);
    // expect(transactionAccountState.proposalId.toString).to.eql("0");
    // expect(transactionAccountState.approvers).to.eql([true, false, false]);
    // expect(transactionAccountState.didExecute).to.eql(false);
    // expect(transactionAccountState.amount.toString()).to.eql(amount.toString());
  });
});
