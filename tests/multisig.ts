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

describe("multisig", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Multisig as Program<Multisig>;
  const MultiSigError = program.idl.errors as Multisig["errors"];

  const space = 1000; // Big enough.
  const threshold = new anchor.BN(2);

  let ownerAKeypair: anchor.web3.Keypair;
  let ownerBKeypair: anchor.web3.Keypair;
  let ownerCKeypair: anchor.web3.Keypair;
  let receiverPubKey: anchor.web3.PublicKey;

  let multisigPDA: MultisigPDA;

  let owners: anchor.web3.PublicKey[];

  const getMultisigPDA = async (
    ownerAPubKey: anchor.web3.PublicKey,
    ownerBPubKey: anchor.web3.PublicKey,
    ownerCPubKey: anchor.web3.PublicKey
  ) => {
    const uid = new anchor.BN(parseInt((Date.now() / 1000).toString()));
    const uidBuffer = uid.toBuffer("le", 8);

    const [multisigWalletPubKey, multisigBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from("multisig"),
          ownerAPubKey.toBuffer(),
          ownerBPubKey.toBuffer(),
          ownerCPubKey.toBuffer(),
          uidBuffer,
        ],
        program.programId
      );
    return {
      multisigIdx: uid,
      multisigWalletPubKey,
      multisigBump,
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
      multisig.multisigWalletPubKey
    );

    const multiSigInfo = await provider.connection.getAccountInfo(
      multisig.multisigWalletPubKey
    );

    return { multiSigState, multiSigInfo };
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

    multisigPDA = await getMultisigPDA(
      ownerAKeypair.publicKey,
      ownerBKeypair.publicKey,
      ownerCKeypair.publicKey
    );
  });

  it("It should initialize successfully!", async () => {
    const walletKeypair = anchor.web3.Keypair.generate();

    const ownerAKeypair = await createAndFundUser();
    const ownerBKeypair = anchor.web3.Keypair.generate();
    const ownerCKeypair = anchor.web3.Keypair.generate();

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

    const multiSigState = await program.account.wallet.fetch(
      walletKeypair.publicKey
    );

    expect(multiSigState.owners).to.eql(owners);
    expect(multiSigState.proposalCounter.toString()).to.eql("0");
    expect(multiSigState.threshold.toString()).to.eql(threshold.toString());
  });

  it("It should fail if threshold is greaten than number of owners!", async () => {
    const walletKeypair = anchor.web3.Keypair.generate();

    const ownerAKeypair = anchor.web3.Keypair.generate();
    const ownerBKeypair = anchor.web3.Keypair.generate();
    const ownerCKeypair = anchor.web3.Keypair.generate();

    const owners = [
      ownerAKeypair.publicKey,
      ownerBKeypair.publicKey,
      ownerCKeypair.publicKey,
    ];
    const threshold = new anchor.BN(4);

    try {
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
    } catch (error) {
      const invalidThresholdError = MultiSigError[7];
      expect(error.error.errorMessage).to.equal(invalidThresholdError.msg);
      expect(error.error.errorCode.code).to.equal(invalidThresholdError.name);
      expect(error.error.errorCode.number).to.equal(invalidThresholdError.code);
    }
  });

  it("It should propose a transaction!", async () => {
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

    const transactionAccountState = await program.account.transaction.fetch(
      transactionAccount
    );
    const walletAccountState = await program.account.wallet.fetch(
      walletKeypair.publicKey
    );

    expect(walletAccountState.proposalCounter.toString()).to.eql("1");
    expect(transactionAccountState.wallet).to.eql(walletKeypair.publicKey);
    expect(transactionAccountState.proposalId.toString).to.eql("0");
    expect(transactionAccountState.approvers).to.eql([true, false, false]);
    expect(transactionAccountState.didExecute).to.eql(false);
    expect(transactionAccountState.to.toString()).to.eql(
      receiverKeypair.publicKey.toString()
    );
    expect(transactionAccountState.amount.toString()).to.eql(amount.toString());
  });

  it("It should approve transaction", async () => {
    const walletKeypair = anchor.web3.Keypair.generate();
    const ownerAKeypair = anchor.web3.Keypair.generate();
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

    const transactionState = await program.account.transaction.fetch(
      transactionAccount
    );

    expect(transactionState.approvers).to.eql([true, true, false]);
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

  it.only("It should initialize and send transaction successfully!", async () => {
    console.log("owners :", owners);
    console.log("threshold.toString() :", threshold.toString());
    console.log("multisigPDA :", multisigPDA);
    console.log(
      "ownerAKeypair.publicKey :",
      ownerAKeypair.publicKey.toString()
    );

    await program.methods
      .initializeNewMultisigWallet(owners, threshold)
      .accounts({
        multisigWalletAccount: multisigPDA.multisigWalletPubKey,
        payer: ownerAKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([ownerAKeypair])
      // .preInstructions([
      //   await program.account.multisigWalletState.createInstruction(
      //     ownerAKeypair,
      //     multisigSize
      //   ),
      // ])
      .rpc();

    // expect(multiSigState.owners).to.eql(owners);
    // expect(multiSigState.proposalCounter.toString()).to.eql("0");
    // expect(multiSigState.threshold.toString()).to.eql(threshold.toString());
  });
});
