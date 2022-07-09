import * as anchor from "@project-serum/anchor";
import { Program, ProgramError } from "@project-serum/anchor";
import { expect } from "chai";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Multisig } from "../target/types/multisig";

describe("multisig", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Multisig as Program<Multisig>;
  const MultiSigError = program.idl.errors as Multisig["errors"];

  it("It should initialize successfully!", async () => {
    const multisigKeypair = anchor.web3.Keypair.generate();

    const nonce = 10;
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
      .initWallet(owners, threshold, nonce)
      .accounts({
        multisig: multisigKeypair.publicKey,
      })
      .signers([multisigKeypair])
      .preInstructions([
        await program.account.multiSig.createInstruction(
          multisigKeypair,
          multisigSize
        ),
      ])
      .rpc();

    let multiSigState = await program.account.multiSig.fetch(
      multisigKeypair.publicKey
    );

    expect(multiSigState.owners).to.eql(owners);
    expect(multiSigState.nonce).to.eql(nonce);
    expect(multiSigState.proposalCounter.toString()).to.eql("0");
    expect(multiSigState.threshold.toString()).to.eql(threshold.toString());
  });

  it("It should fail if threshold is greaten than number of owners!", async () => {
    const multisigKeypair = anchor.web3.Keypair.generate();

    const nonce = 10;
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
        .initWallet(owners, threshold, nonce)
        .accounts({
          multisig: multisigKeypair.publicKey,
        })
        .signers([multisigKeypair])
        .preInstructions([
          await program.account.multiSig.createInstruction(
            multisigKeypair,
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
    const multisigKeypair = anchor.web3.Keypair.generate();
    const multisigSize = 200; // Big enough.
    const txSize = 1000; // Big enough.

    const [multisigSigner, nonce] =
      await anchor.web3.PublicKey.findProgramAddress(
        [multisigKeypair.publicKey.toBuffer()],
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
        multisig: multisigKeypair.publicKey,
      })
      .signers([multisigKeypair])
      .preInstructions([
        await program.account.multiSig.createInstruction(
          multisigKeypair,
          multisigSize
        ),
      ])
      .rpc();

    const pid = program.programId;
    const amount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);
    const transactionKeypair = anchor.web3.Keypair.generate();

    let previousMultiSigState = await program.account.multiSig.fetch(
      multisigKeypair.publicKey
    );
    expect(previousMultiSigState.proposalCounter.toString()).to.eql("0");

    // propose transaction
    await program.methods
      .proposeTransaction(pid, receiverKeypair.publicKey, amount)
      .accounts({
        multisig: multisigKeypair.publicKey,
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

    let multiSigState = await program.account.multiSig.fetch(
      multisigKeypair.publicKey
    );

    let transactionState = await program.account.transaction.fetch(
      transactionKeypair.publicKey
    );

    expect(multiSigState.proposalCounter.toString()).to.eql("1");
    expect(transactionState.multisig).to.eql(multisigKeypair.publicKey);
    expect(transactionState.multisig).to.eql(multisigKeypair.publicKey);
    expect(transactionState.approvers).to.eql([true, false, false]);
    expect(transactionState.didExecute).to.eql(false);
    expect(transactionState.amount.toString()).to.eql(amount.toString());

    // expect(multiSigState.owners).to.eql(owners);
    // expect(multiSigState.nonce).to.eql(nonce);
    // expect(multiSigState.threshold.toString()).to.eql(threshold.toString());
    // expect(multiSigState.ownerSetSeqno).to.eql(0);
  });
});
