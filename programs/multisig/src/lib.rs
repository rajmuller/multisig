use anchor_lang::prelude::*;

// linux
declare_id!("8XHSyugWk2uYagCREiD2fSRkgGcTPYvwipXgd9c7em2i");
// //mac
// declare_id!("Fdjkm4r6FHzt3XmwrD26aLYPG74eJuxnmRby6zxNYfiQ");

#[program]
pub mod multisig {

    use super::*;

    // init new multisig wallet wallet with set of owners and threshold
    pub fn create_wallet(
        ctx: Context<CreateWallet>,
        owners: Vec<Pubkey>,
        threshold: u64,
    ) -> Result<()> {
        assert_unique_owners(&owners)?;
        require!(
            threshold > 0 && threshold <= owners.len() as u64,
            MultiSigError::InvalidThreshold
        );
        require!(!owners.is_empty(), MultiSigError::InvalidOwnersLen);

        let wallet = &mut ctx.accounts.wallet;
        wallet.owners = owners;
        wallet.threshold = threshold;
        wallet.proposal_counter = 0;

        Ok(())
    }

    // propose a transaction for the other owners to approve
    pub fn propose_transaction(
        ctx: Context<ProposeTransaction>,
        to: Pubkey,
        amount: u64,
    ) -> Result<()> {
        let owner_index = ctx
            .accounts
            .wallet
            .owners
            .iter()
            .position(|a| a == ctx.accounts.proposer.key)
            .ok_or(MultiSigError::InvalidOwner)?;

        let mut approvers = Vec::new();
        approvers.resize(ctx.accounts.wallet.owners.len(), false);
        approvers[owner_index] = true;

        let tx = &mut ctx.accounts.transaction;
        let wallet = &mut ctx.accounts.wallet;

        tx.proposal_id = wallet.proposal_counter;
        tx.amount = amount;
        tx.to = to;
        tx.wallet = wallet.key();
        tx.approvers = approvers;
        tx.did_execute = false;

        wallet.proposal_counter += 1;

        Ok(())
    }

    pub fn approve_transaction(ctx: Context<ApproveTransaction>) -> Result<()> {
        let owner_index = ctx
            .accounts
            .wallet
            .owners
            .iter()
            .position(|a| a == ctx.accounts.approver.key)
            .ok_or(MultiSigError::InvalidOwner)?;

        ctx.accounts.transaction.approvers[owner_index] = true;

        Ok(())
    }

    // Executes the given transaction if threshold owners have signed it.
    // pub fn execute_transaction(ctx: Context<ExecuteTransaction>) -> Result<()> {
    //     // Has this been executed already?
    //     if ctx.accounts.transaction.did_execute {
    //         return Err(ErrorCode::AlreadyExecuted.into());
    //     }

    //     // Do we have enough signers.
    //     let sig_count = ctx
    //         .accounts
    //         .transaction
    //         .signers
    //         .iter()
    //         .filter(|&did_sign| *did_sign)
    //         .count() as u64;
    //     if sig_count < ctx.accounts.wallet.threshold {
    //         return Err(ErrorCode::NotEnoughSigners.into());
    //     }

    //     // Execute the transaction signed by the wallet.
    //     let mut ix: Instruction = (*ctx.accounts.transaction).deref().into();
    //     ix.accounts = ix
    //         .accounts
    //         .iter()
    //         .map(|acc| {
    //             let mut acc = acc.clone();
    //             if &acc.pubkey == ctx.accounts.multisig_signer.key {
    //                 acc.is_signer = true;
    //             }
    //             acc
    //         })
    //         .collect();
    //     let multisig_key = ctx.accounts.wallet.key();
    //     let seeds = &[multisig_key.as_ref(), &[ctx.accounts.wallet.nonce]];
    //     let signer = &[&seeds[..]];
    //     let accounts = ctx.remaining_accounts;
    //     solana_program::program::invoke_signed(&ix, accounts, signer)?;

    //     // Burn the transaction to ensure one time use.
    //     ctx.accounts.transaction.did_execute = true;

    //     Ok(())
    // }
}

#[derive(Accounts)]
pub struct CreateWallet<'info> {
    #[account(zero, signer)]
    wallet: Account<'info, Wallet>,
}

#[derive(Accounts)]
pub struct ProposeTransaction<'info> {
    #[account(mut)]
    wallet: Account<'info, Wallet>,
    #[account(
        init,
        seeds = [
            b"transaction".as_ref(),
            wallet.key().as_ref(),
            wallet.proposal_counter.to_string().as_ref(),
        ],
        bump,
        payer = payer,
        space = 1000
    )]
    transaction: Account<'info, Transaction>,
    system_program: Program<'info, System>,
    // One of the owners. Checked in the handler.
    #[account(mut)]
    proposer: Signer<'info>,
    #[account(mut)]
    payer: Signer<'info>,
}

#[derive(Accounts)]
pub struct ApproveTransaction<'info> {
    wallet: Account<'info, Wallet>,
    #[account(mut, has_one = wallet)]
    transaction: Account<'info, Transaction>,
    // One of the wallet owners. Checked in the handler.
    approver: Signer<'info>,
}

#[account]
pub struct Wallet {
    pub owners: Vec<Pubkey>,
    pub threshold: u64,
    pub proposal_counter: u64,
}

#[account]
pub struct Transaction {
    // The wallet account this transaction belongs to.
    pub wallet: Pubkey,
    // Transaction's id.
    pub proposal_id: u64,
    // Proposed receiver of the transaction.
    pub to: Pubkey,
    // Proposed amount to send
    pub amount: u64,
    // approvers[index] is true if wallet.owners[index] signed the transaction.
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
    #[msg("The given owner is not part of this wallet.")]
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
