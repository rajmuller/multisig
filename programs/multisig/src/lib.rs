use anchor_lang::prelude::*;

// linux
// declare_id!("8XHSyugWk2uYagCREiD2fSRkgGcTPYvwipXgd9c7em2i");
//mac
declare_id!("Fdjkm4r6FHzt3XmwrD26aLYPG74eJuxnmRby6zxNYfiQ");

#[program]
pub mod multisig {

    use super::*;

    // init new multisig wallet with set of owners and threshold
    pub fn init_wallet(
        ctx: Context<InitWallet>,
        owners: Vec<Pubkey>,
        threshold: u64,
        nonce: u8,
    ) -> Result<()> {
        assert_unique_owners(&owners)?;
        require!(
            threshold > 0 && threshold <= owners.len() as u64,
            MultiSigError::InvalidThreshold
        );
        require!(!owners.is_empty(), MultiSigError::InvalidOwnersLen);

        let multisig = &mut ctx.accounts.multisig;
        multisig.owners = owners;
        multisig.threshold = threshold;
        multisig.nonce = nonce;
        multisig.proposal_counter = 0;
        Ok(())
    }

    // propose a transaction for the other owners to approve
    pub fn propose_transaction(
        ctx: Context<ProposeTransaction>,
        pid: Pubkey,
        to: Pubkey,
        amount: u64,
    ) -> Result<()> {
        let owner_index = ctx
            .accounts
            .multisig
            .owners
            .iter()
            .position(|a| a == ctx.accounts.proposer.key)
            .ok_or(MultiSigError::InvalidOwner)?;

        let mut approvers = Vec::new();
        approvers.resize(ctx.accounts.multisig.owners.len(), false);
        approvers[owner_index] = true;

        let tx = &mut ctx.accounts.transaction;

        tx.program_id = pid;
        tx.id = ctx.accounts.multisig.proposal_counter;
        tx.amount = amount;
        tx.to = to;
        tx.multisig = ctx.accounts.multisig.key();
        tx.approvers = approvers;
        tx.did_execute = false;

        ctx.accounts.multisig.proposal_counter += 1;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitWallet<'info> {
    #[account(zero, signer)]
    multisig: Box<Account<'info, MultiSig>>,
}

#[derive(Accounts)]
pub struct ProposeTransaction<'info> {
    #[account(mut)]
    multisig: Box<Account<'info, MultiSig>>,
    #[account(zero, signer)]
    transaction: Box<Account<'info, Transaction>>,
    // One of the owners. Checked in the handler.
    proposer: Signer<'info>,
}

#[account]
pub struct MultiSig {
    pub owners: Vec<Pubkey>,
    pub threshold: u64,
    pub nonce: u8,
    pub proposal_counter: u64,
}

#[account]
pub struct Transaction {
    // The multisig account this transaction belongs to.
    pub multisig: Pubkey,
    // Target program to execute against.
    pub program_id: Pubkey,
    // Transaction's ID.
    pub id: u64,
    // Proposed receiver of the transaction.
    pub to: Pubkey,
    // Proposed amount to send
    pub amount: u64,
    // approvers[index] is true if multisig.owners[index] signed the transaction.
    pub approvers: Vec<bool>,
    // Boolean ensuring one time execution.
    pub did_execute: bool,
}

fn assert_unique_owners(owners: &[Pubkey]) -> Result<()> {
    for (i, owner) in owners.iter().enumerate() {
        require!(
            !owners.iter().skip(i + 1).any(|item| item == owner),
            MultiSigError::UniqueOwners
        )
    }
    Ok(())
}

#[error_code]
pub enum MultiSigError {
    #[msg("The given owner is not part of this multisig.")]
    InvalidOwner,

    #[msg("Owners length must be non zero.")]
    InvalidOwnersLen,

    #[msg("Not enough owners signed this transaction.")]
    NotEnoughSigners,

    #[msg("Cannot delete a transaction that has been signed by an owner.")]
    TransactionAlreadySigned,

    #[msg("Overflow when adding.")]
    Overflow,

    #[msg("Cannot delete a transaction the owner did not create.")]
    UnableToDelete,

    #[msg("The given transaction has already been executed.")]
    AlreadyExecuted,

    #[msg("Threshold must be less than or equal to the number of owners.")]
    InvalidThreshold,

    #[msg("Owners must be unique")]
    UniqueOwners,
}
