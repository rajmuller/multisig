use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;

// linux
declare_id!("8XHSyugWk2uYagCREiD2fSRkgGcTPYvwipXgd9c7em2i");
// //mac
// declare_id!("Fdjkm4r6FHzt3XmwrD26aLYPG74eJuxnmRby6zxNYfiQ");

#[program]
pub mod multisig {

    use super::*;

    // init new multisig wallet wallet with set of owners and threshold
    pub fn initialize_new_multisig_wallet(
        ctx: Context<InitializeNewMultisigWallet>,
        wallet_idx: u64,
        owners: Vec<Pubkey>,
        threshold: u64,
    ) -> Result<()> {
        assert_unique_owners(&owners)?;
        require!(
            threshold > 0 && threshold <= owners.len() as u64,
            MultiSigError::InvalidThreshold
        );
        require!(!owners.is_empty(), MultiSigError::InvalidOwnersLen);

        let multisig_wallet_account = &mut ctx.accounts.multisig_wallet_account;
        multisig_wallet_account.idx = wallet_idx;
        multisig_wallet_account.owners = owners;
        multisig_wallet_account.threshold = threshold;
        multisig_wallet_account.proposal_counter = 0;

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
            .multisig_wallet_account
            .owners
            .iter()
            .position(|a| a == ctx.accounts.proposer.key)
            .ok_or(MultiSigError::InvalidOwner)?;

        let mut approvers = Vec::new();
        approvers.resize(ctx.accounts.multisig_wallet_account.owners.len(), false);
        approvers[owner_index] = true;

        let transaction_account = &mut ctx.accounts.transaction_account;
        let multisig_wallet_account = &mut ctx.accounts.multisig_wallet_account;

        transaction_account.proposal_id = multisig_wallet_account.proposal_counter;
        transaction_account.amount = amount;
        transaction_account.to = to;
        transaction_account.multisig_wallet_address = multisig_wallet_account.key().clone();
        transaction_account.approvers = approvers;
        transaction_account.did_execute = false;

        multisig_wallet_account.proposal_counter += 1;

        Ok(())
    }

    pub fn approve_transaction(ctx: Context<ApproveTransaction>) -> Result<()> {
        let owner_index = ctx
            .accounts
            .multisig_wallet_account
            .owners
            .iter()
            .position(|a| a == ctx.accounts.approver.key)
            .ok_or(MultiSigError::InvalidOwner)?;

        ctx.accounts.transaction_account.approvers[owner_index] = true;

        Ok(())
    }

    // Executes the given transaction if threshold owners have signed it.
    pub fn execute_transaction(ctx: Context<ExecuteTransaction>) -> Result<()> {
        // Has this been executed already?
        require!(
            !ctx.accounts.transaction_account.did_execute,
            MultiSigError::AlreadyExecuted
        );

        let balance = ctx
            .accounts
            .multisig_wallet_account
            .to_account_info()
            .lamports
            .borrow_mut()
            .clone();

        let amount = ctx.accounts.transaction_account.amount;

        require!(balance >= amount, MultiSigError::NotEnoughBalance);

        // Do we have enough signers.
        let sig_count = ctx
            .accounts
            .transaction_account
            .approvers
            .iter()
            .filter(|&did_sign| *did_sign)
            .count() as u64;
        require!(
            sig_count >= ctx.accounts.multisig_wallet_account.threshold,
            MultiSigError::NotEnoughSigners
        );

        let amount = ctx.accounts.transaction_account.amount;

        let wallet_info = ctx.accounts.multisig_wallet_account.to_account_info();
        let recipient_info = ctx.accounts.recipient.to_account_info();

        **recipient_info.try_borrow_mut_lamports()? =
            recipient_info.lamports().checked_add(amount).unwrap();
        **wallet_info.try_borrow_mut_lamports()? =
            wallet_info.lamports().checked_sub(amount).unwrap();

        ctx.accounts.transaction_account.did_execute = true;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(wallet_idx: u64, owners: Vec<Pubkey>)]
pub struct InitializeNewMultisigWallet<'info> {
    // PDAs
    #[account(
        init,
        space = 1000,
        payer = payer,
        seeds=[b"multisig".as_ref(), wallet_idx.to_le_bytes().as_ref()],
        bump,
    )]
    multisig_wallet_account: Account<'info, MultisigWalletState>,

    #[account(mut)]
    payer: Signer<'info>,

    // Application level accounts
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ProposeTransaction<'info> {
    #[account(
        init,
        space = 1000,
        payer = proposer,
        seeds = [
            b"transaction".as_ref(),
            multisig_wallet_account.key().as_ref(),
            multisig_wallet_account.proposal_counter.to_le_bytes().as_ref(),
        ],
        bump,
    )]
    transaction_account: Account<'info, TransactionState>,
    #[account(
        mut,
        seeds=[b"multisig".as_ref(), multisig_wallet_account.idx.to_le_bytes().as_ref()],
        bump,
    )]
    multisig_wallet_account: Account<'info, MultisigWalletState>,

    #[account(mut)]
    // One of the owners. Checked in the handler.
    proposer: Signer<'info>,

    // Application level accounts
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ApproveTransaction<'info> {
    #[account(
        mut,
        seeds=[b"multisig".as_ref(), multisig_wallet_account.idx.to_le_bytes().as_ref()],
        bump,
    )]
    multisig_wallet_account: Account<'info, MultisigWalletState>,
    #[account(
        mut,
        seeds = [
            b"transaction".as_ref(),
            multisig_wallet_account.key().as_ref(),
            transaction_account.proposal_id.to_le_bytes().as_ref(),
        ],
        bump,
    )]
    transaction_account: Account<'info, TransactionState>,

    // One of the wallet owners. Checked in the handler.
    #[account(mut)]
    approver: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExecuteTransaction<'info> {
    #[account(
        mut,
        seeds=[b"multisig".as_ref(), multisig_wallet_account.idx.to_le_bytes().as_ref()],
        bump,
    )]
    multisig_wallet_account: Account<'info, MultisigWalletState>,
    #[account(
        mut,
        seeds = [
            b"transaction".as_ref(),
            multisig_wallet_account.key().as_ref(),
            transaction_account.proposal_id.to_le_bytes().as_ref(),
        ],
        bump,
    )]
    transaction_account: Account<'info, TransactionState>,

    #[account(mut)]
    /// CHECK: we only send lamport to this account
    recipient: AccountInfo<'info>,
    #[account(address = system_program::ID)]
    system_program: Program<'info, System>,
}

// 1 MultisigWalletState instance == 1 Multiisig Wallet instance
#[account]
pub struct MultisigWalletState {
    pub idx: u64,
    pub owners: Vec<Pubkey>,
    pub threshold: u64,
    pub proposal_counter: u64,
}

#[account]
pub struct TransactionState {
    // The wallet account this transaction belongs to.
    pub multisig_wallet_address: Pubkey,
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

    #[msg("The given transaction has already been executed.")]
    AlreadyExecuted,

    #[msg("Threshold must be less than or equal to the number of owners.")]
    InvalidThreshold,

    #[msg("Owners must be unique.")]
    UniqueOwners,

    #[msg("Not enough balance on the multisig wallet.")]
    NotEnoughBalance,
}
