import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { expect } from "chai";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Multisig } from "../target/types/multisig";

describe("multisig", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Multisig as Program<Multisig>;
  const MultiSigError = program.idl.errors as Multisig["errors"];

  it("It should initialize successfully!", async () => {
    const walletKeypair = anchor.web3.Keypair.generate();

    const multisigSize = 200; // Big enough.

    const ownerAKeypair = anchor.web3.Keypair.generate();
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

    const multisigSize = 200; // Big enough.

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

  it.only("It should propose a transaction!", async () => {
    const walletKeypair = anchor.web3.Keypair.generate();
    const multisigSize = 200; // Big enough.

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

    const transactionAccountState = await program.account.transaction.fetch(
      transactionAccount
    );
    const walletAccountState = await program.account.wallet.fetch(
      walletKeypair.publicKey
    );

    console.log("transAccountState :", transactionAccountState);

    expect(walletAccountState.proposalCounter.toString()).to.eql("1");
    expect(transactionAccountState.wallet).to.eql(walletKeypair.publicKey);
    expect(transactionAccountState.proposalId.toString).to.eql("0");
    expect(transactionAccountState.approvers).to.eql([true, false, false]);
    expect(transactionAccountState.didExecute).to.eql(false);
    expect(transactionAccountState.amount.toString()).to.eql(amount.toString());
  });

  it("It should approve transaction", async () => {
    const walletKeypair = anchor.web3.Keypair.generate();
    const multisigSize = 200; // Big enough.
    const txSize = 1000; // Big enough.

    const [multisigSigner, nonce] =
      await anchor.web3.PublicKey.findProgramAddress(
        [walletKeypair.publicKey.toBuffer()],
        program.programId
      );

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
      .initWallet(owners, threshold, nonce)
      .accounts({
        multisig: walletKeypair.publicKey,
      })
      .signers([walletKeypair])
      .preInstructions([
        await program.account.multiSig.createInstruction(
          walletKeypair,
          multisigSize
        ),
      ])
      .rpc();

    const pid = program.programId;
    const amount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);
    const transactionKeypair = anchor.web3.Keypair.generate();

    const previousMultiSigState = await program.account.multiSig.fetch(
      walletKeypair.publicKey
    );
    expect(previousMultiSigState.proposalCounter.toString()).to.eql("0");

    // propose transaction
    await program.methods
      .proposeTransaction(pid, receiverKeypair.publicKey, amount)
      .accounts({
        multisig: walletKeypair.publicKey,
        transaction: transactionKeypair.publicKey,
        proposer: ownerAKeypair.publicKey,
      })
      .signers([ownerAKeypair, transactionKeypair])
      .preInstructions([
        await program.account.transaction.createInstruction(
          transactionKeypair,
          txSize
        ),
      ])
      .rpc();

    // approve transaction
    await program.methods
      .approveTransaction()
      .accounts({
        multisig: walletKeypair.publicKey,
        transaction: transactionKeypair.publicKey,
        approver: ownerBKeypair.publicKey,
      })
      .signers([ownerBKeypair])
      .rpc();

    const multiSigState = await program.account.multiSig.fetch(
      walletKeypair.publicKey
    );

    const transactionState = await program.account.transaction.fetch(
      transactionKeypair.publicKey
    );

    expect(transactionState.approvers).to.eql([true, true, false]);
  });

  it("It should propose a transaction!", async () => {
    const walletKeypair = anchor.web3.Keypair.generate();
    const multisigSize = 200; // Big enough.
    const txSize = 1000; // Big enough.

    const [multisigSigner, nonce] =
      await anchor.web3.PublicKey.findProgramAddress(
        [walletKeypair.publicKey.toBuffer()],
        program.programId
      );

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
      .initWallet(owners, threshold, nonce)
      .accounts({
        multisig: walletKeypair.publicKey,
      })
      .signers([walletKeypair])
      .preInstructions([
        await program.account.multiSig.createInstruction(
          walletKeypair,
          multisigSize
        ),
      ])
      .rpc();

    const pid = program.programId;
    const amount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);
    const transactionKeypair = anchor.web3.Keypair.generate();

    const previousMultiSigState = await program.account.multiSig.fetch(
      walletKeypair.publicKey
    );
    expect(previousMultiSigState.proposalCounter.toString()).to.eql("0");

    // propose transaction
    await program.methods
      .proposeTransaction(pid, receiverKeypair.publicKey, amount)
      .accounts({
        multisig: walletKeypair.publicKey,
        transaction: transactionKeypair.publicKey,
        proposer: ownerAKeypair.publicKey,
      })
      .signers([ownerAKeypair, transactionKeypair])
      .preInstructions([
        await program.account.transaction.createInstruction(
          transactionKeypair,
          txSize
        ),
      ])
      .rpc();

    const multiSigState = await program.account.multiSig.fetch(
      walletKeypair.publicKey
    );

    const transactionState = await program.account.transaction.fetch(
      transactionKeypair.publicKey
    );

    expect(multiSigState.proposalCounter.toString()).to.eql("1");
    expect(transactionState.multisig).to.eql(walletKeypair.publicKey);
    expect(transactionState.multisig).to.eql(walletKeypair.publicKey);
    expect(transactionState.approvers).to.eql([true, false, false]);
    expect(transactionState.didExecute).to.eql(false);
    expect(transactionState.amount.toString()).to.eql(amount.toString());
  });
});
