import { PublicKey } from "@solana/web3.js";
import {
  useFetchMultisigtransactions,
  useFetchTransactions,
  useInitMultisigtransaction,
} from "hooks";
import type { NextPage } from "next";
import { useState } from "react";

type TransactionType = {
  publicKey?: PublicKey;
  account?: any;
};

type TransactionProps = {
  transaction: TransactionType;
};

const Transaction = ({ transaction }: TransactionProps) => {
  console.log(transaction);
  return (
    <div className="flex flex-col gap-6 overflow-hidden rounded p-4 text-start shadow-lg shadow-violet-700 hover:cursor-pointer hover:shadow-xl hover:shadow-violet-700">
      <div className="w-full overflow-hidden truncate text-xl">
        <p>transaction pubkey: </p>
        <p className="w-full overflow-hidden truncate text-sm text-violet-200">
          {transaction?.publicKey?.toString()}
        </p>
      </div>
      {transaction?.account?.owners?.map((owner: any, i: any) => (
        <div
          className="w-full overflow-hidden truncate text-lg"
          key={owner?.toString()}
        >
          <p>
            Owner {i}:
            <p className="truncate text-sm text-violet-200">
              {owner?.toString()}
            </p>
          </p>
        </div>
      ))}
      <div>
        <p className="text-lg">Proposal Count: </p>
        <p className="truncate text-sm text-violet-200">
          {transaction?.account?.proposalCounter?.toString()}
        </p>
      </div>
      <div>
        <p className="text-lg">Threshold:: </p>
        <p className="truncate text-sm text-violet-200">
          {transaction?.account?.threshold?.toString()}
        </p>
      </div>
    </div>
  );
};

const Transactions = () => {
  const transactions: TransactionType[] | undefined = useFetchTransactions();

  console.log({ transactions });

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
    <div className="grid w-full grid-cols-4">
      {transactions?.map((transaction) => (
        <Transaction
          key={transaction?.publicKey?.toString()}
          transaction={transaction}
        />
      ))}
    </div>
  );
};

const Wallet: NextPage = () => {
  return (
    <div className="px flex h-full w-full flex-col items-center gap-8 px-8">
      <p className="my-20 text-7xl">Wallet Details</p>
      <div className="flex h-full w-full gap-12">
        <Transactions />
      </div>
    </div>
  );
};

export default Wallet;
