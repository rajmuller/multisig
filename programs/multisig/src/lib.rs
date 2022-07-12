use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::system_instruction::transfer;
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

        let tx = &mut ctx.accounts.transaction;
        let wallet = &mut ctx.accounts.multisig_wallet_account;

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
    pub fn execute_transaction(ctx: Context<ExecuteTransaction>) -> Result<()> {
        let transfer_instruction = &transfer(
            &ctx.accounts.from.to_account_info().key,
            &ctx.accounts.recipient.to_account_info().key,
            100_000_000,
        );

        invoke(
            transfer_instruction,
            &[
                ctx.accounts.from.to_account_info(),
                ctx.accounts.recipient.to_account_info(),
            ],
        )?;

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
    // #[account(
    //     init,
    //     space = 690,
    //     payer = payer,
    //     seeds=[b"treasury".as_ref(), owners[0].as_ref(), owners[1].as_ref(), owners[2].as_ref(), wallet_idx.to_le_bytes().as_ref()],
    //     bump,
    // )]
    // treasury_account: AccountInfo<'info>,
    #[account(mut)]
    payer: Signer<'info>,

    // Application level accounts
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ProposeTransaction<'info> {
    #[account(mut)]
    multisig_wallet_account: Account<'info, MultisigWalletState>,
    #[account(
        init,
        seeds = [
            b"transaction".as_ref(),
            multisig_wallet_account.key().as_ref(),
            multisig_wallet_account.proposal_counter.to_string().as_ref(),
        ],
        bump,
        payer = proposer,
        space = 1000
    )]
    transaction: Account<'info, Transaction>,
    system_program: Program<'info, System>,
    // One of the owners. Checked in the handler.
    #[account(mut)]
    proposer: Signer<'info>,
}

#[derive(Accounts)]
pub struct ApproveTransaction<'info> {
    wallet: Account<'info, MultisigWalletState>,
    #[account(mut)]
    transaction: Account<'info, Transaction>,
    // One of the wallet owners. Checked in the handler.
    approver: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExecuteTransaction<'info> {
    #[account(mut)]
    from: Signer<'info>,
    #[account(mut)]
    /// CHECK: we only send lamport to this account
    pub recipient: AccountInfo<'info>,
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
    // pub treasury_wallet: Pubkey,
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

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TransactionAccount {
    pub pubkey: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
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
