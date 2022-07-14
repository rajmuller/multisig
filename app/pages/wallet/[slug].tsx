import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  useApproveTransaction,
  useBalance,
  useExecuteTransaction,
  useMultisigWallets,
  useFetchTransactions,
  useProposeTransaction,
} from "hooks";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import { useState } from "react";

type TransactionProps = {
  transaction: any;
  threshold?: string;
};

const Transaction = ({ transaction, threshold }: TransactionProps) => {
  const approverCount = transaction?.account?.approvers?.filter(
    (approver: boolean) => approver
  ).length;
  const { query } = useRouter();

  const { onApproveTransaction } = useApproveTransaction(
    query?.slug as string,
    transaction?.publicKey?.toString()
  );
  const { onExecuteTransaction } = useExecuteTransaction(
    query?.slug as string,
    transaction?.publicKey?.toString(),
    transaction?.account?.to?.toString()
  );

  const canExecute = threshold && approverCount >= threshold;

  console.log("amount:", transaction?.account?.amount?.toString());
  return (
    <div className="flex flex-col gap-6 overflow-hidden rounded p-4 text-start shadow-lg shadow-violet-700 hover:cursor-pointer hover:shadow-xl hover:shadow-violet-700">
      <div className="w-full overflow-hidden truncate text-xl">
        <p>transaction pubkey: </p>
        <p className="w-full overflow-hidden truncate text-sm text-violet-200">
          {transaction?.publicKey?.toString()}
        </p>
      </div>
      <div>
        <p className="text-lg">Can be Executed: </p>
        <p
          className={`truncate text-xl ${
            canExecute ? "text-emerald-500" : "text-red-500"
          }`}
        >
          {canExecute ? "Yes" : "No"}
        </p>
      </div>
      <div>
        <p className="text-lg">Did Execute: </p>
        <p className="truncate text-xl text-violet-200">
          {transaction?.account?.didExecute ? "Yes" : "No"}
        </p>
      </div>
      <div>
        <p className="text-lg">Recipient: </p>
        <p className="truncate text-sm text-violet-200">
          {transaction?.account?.to?.toString()}
        </p>
      </div>
      <div>
        <p className="text-lg">Amount: </p>
        <p className="truncate text-sm text-violet-200">
          {transaction?.account?.amount?.toString() / LAMPORTS_PER_SOL}
        </p>
      </div>
      {transaction?.account?.approvers?.map((approver: any, i: any) => (
        <div className="w-full overflow-hidden truncate text-lg" key={i}>
          <p>Approvers {i + 1}:</p>
          <p className="truncate text-sm text-violet-200">
            {approver?.toString()}
          </p>
        </div>
      ))}
      <button
        disabled={transaction?.account?.didExecute}
        onClick={canExecute ? onExecuteTransaction : onApproveTransaction}
        className={`rounded ${
          transaction?.account?.didExecute
            ? "cursor-not-allowed bg-gray-700"
            : "bg-violet-500 hover:bg-violet-600 active:bg-violet-700"
        } px-3 py-1.5 font-medium`}
      >
        {canExecute ? "Execute" : "Approve"}
      </button>
    </div>
  );
};

type ProposeTransactionProps = {
  multisigKeyString?: string;
  proposalCounter?: string;
};

const ProposeTransaction = ({
  multisigKeyString,
  proposalCounter,
}: ProposeTransactionProps) => {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");

  const { onProposeTransaction } = useProposeTransaction(
    recipient,
    amount,
    multisigKeyString,
    proposalCounter
  );

  return (
    <div className="flex flex-col items-end gap-4">
      <p className="text-3xl">Propose Transaction</p>
      <div className="mb-6 flex flex-col items-start">
        <label
          htmlFor="recipient"
          className="mb-2 block text-sm font-medium text-violet-50"
        >
          Recipient
        </label>
        <p className="mb-2 text-xs">
          testRecipient: 3C7vgaMcA8m3N1ABibbHvWn8mWEjiwVFqaYJEYhGFYK8
        </p>
        <input
          onChange={(e) => setRecipient(e.target.value)}
          value={recipient}
          type="text"
          id="recipient"
          className="block w-[400px] rounded-lg bg-[#462a74] p-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-400"
        />
      </div>

      <div className="mb-6 flex flex-col items-start">
        <label
          htmlFor="amount"
          className="mb-2 block text-sm font-medium text-violet-50"
        >
          Amount to send in SOL
        </label>
        <input
          onChange={(e) => setAmount(e.target.value)}
          value={amount}
          type="number"
          min={0}
          max={10}
          id="amount"
          className="block w-[400px] rounded-lg bg-[#462a74] p-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-400"
        />
      </div>
      <button
        onClick={onProposeTransaction}
        className="h-full rounded bg-violet-500 px-3 py-1.5 font-medium hover:bg-violet-600 active:bg-violet-700"
      >
        Propose Transaction
      </button>
    </div>
  );
};

const Transactions = ({ threshold }: { threshold?: string }) => {
  const transactions: any[] | undefined = useFetchTransactions();

  if (!transactions) {
    return (
      <div className="px flex h-full w-full flex-col items-center gap-8 px-8">
        <p className="my-20 text-7xl">Loading transaction</p>
        <span
          className="spinner-border ml-8 inline-block h-8 w-8 animate-spin rounded-full border-4 text-violet-100"
          role="status"
        ></span>
      </div>
    );
  }

  return (
    <div className="grid w-full grid-cols-4 gap-8 pb-16">
      {transactions?.map((transaction) => (
        <Transaction
          key={transaction?.publicKey?.toString()}
          transaction={transaction}
          threshold={threshold}
        />
      ))}
    </div>
  );
};

const Wallet: NextPage = () => {
  const { query } = useRouter();
  const wallet: any | undefined = useMultisigWallets(
    query?.slug as string | undefined
  );

  const balance = useBalance(query?.slug as string);

  const walletPubKeyString = wallet?.publicKey?.toString();

  return (
    <div className="px flex h-full w-full flex-col items-center gap-8 px-8">
      <p className="my-20 text-7xl">Wallet Details</p>
      <div className="flex w-full justify-between">
        <div className="flex flex-col gap-6 overflow-hidden rounded p-4 text-start shadow-lg ">
          <div className="w-full overflow-hidden truncate text-xl">
            <p>Wallet pubkey: </p>
            <p className="w-full overflow-hidden truncate text-sm text-violet-200">
              {walletPubKeyString}
            </p>
          </div>
          <div>
            <p className="text-lg">Balance: </p>
            <p className="text-md truncate text-violet-300">{balance} SOL</p>
          </div>
          {wallet?.account?.owners?.map((owner: any, i: any) => (
            <div
              className="w-full overflow-hidden truncate text-lg"
              key={owner?.toString()}
            >
              <p>Owner {i}:</p>
              <p className="truncate text-sm text-violet-200">
                {owner?.toString()}
              </p>
            </div>
          ))}
          <div>
            <p className="text-lg">Proposal Count: </p>
            <p className="truncate text-sm text-violet-200">
              {wallet?.account?.proposalCounter?.toString()}
            </p>
          </div>
          <div>
            <p className="text-lg">Threshold: </p>
            <p className="truncate text-sm text-violet-200">
              {wallet?.account?.threshold?.toString()}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-8">
          <ProposeTransaction
            multisigKeyString={query?.slug as string}
            proposalCounter={wallet?.account?.proposalCounter?.toString()}
          />
          <Transactions threshold={wallet?.account?.threshold?.toString()} />
        </div>
      </div>
    </div>
  );
};

export default Wallet;
