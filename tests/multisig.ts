import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { expect } from "chai";
import { Multisig } from "../target/types/multisig";

describe("multisig", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Multisig as Program<Multisig>;

  it("Should initialize!", async () => {
    const multisigKeypair = anchor.web3.Keypair.generate();
    // const [multisigSigner, nonce] =
    //   await anchor.web3.PublicKey.findProgramAddress(
    //     [multisigKeypair.publicKey.toBuffer()],
    //     program.programId
    //   );

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
    expect(multiSigState.threshold.toString()).to.eql(threshold.toString());
    expect(multiSigState.ownerSetSeqno).to.eql(0);
  });
});
