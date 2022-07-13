import { PublicKey } from "@solana/web3.js";
import { useFetchMultisigWallets, useInitMultisigWallet } from "hooks";
import type { NextPage } from "next";
import { useState } from "react";

type WalletType = {
  publicKey?: PublicKey;
  account?: any;
};

type WalletProps = {
  wallet: WalletType;
};

const Transaction = ({ wallet }: WalletProps) => {
  console.log(wallet);
  return (
    <div className="flex flex-col gap-6 overflow-hidden rounded p-4 text-start shadow-lg shadow-violet-700 hover:cursor-pointer hover:shadow-xl hover:shadow-violet-700">
      <div className="w-full overflow-hidden truncate text-xl">
        <p>Wallet pubkey: </p>
        <p className="w-full overflow-hidden truncate text-sm text-violet-200">
          {wallet?.publicKey?.toString()}
        </p>
      </div>
      {wallet?.account?.owners?.map((owner: any, i: any) => (
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
          {wallet?.account?.proposalCounter?.toString()}
        </p>
      </div>
      <div>
        <p className="text-lg">Threshold:: </p>
        <p className="truncate text-sm text-violet-200">
          {wallet?.account?.threshold?.toString()}
        </p>
      </div>
    </div>
  );
};

const Wallet: NextPage = () => {
  const wallets: WalletType[] | undefined = useFetchMultisigWallets();

  if (!wallets) {
    return (
      <div className="px flex h-full w-full flex-col items-center gap-8 px-8">
        <p className="my-20 text-7xl">Loading Wallet</p>
        <span
          className="spinner-border ml-8 inline-block h-8 w-8 animate-spin rounded-full border-4 text-violet-100"
          role="status"
        ></span>
      </div>
    );
  }

  return (
    <div className="px flex h-full w-full flex-col items-center gap-8 px-8">
      <p className="my-20 text-7xl">Wallet</p>
      <div className="grid w-full grid-cols-4">
        {wallets?.map((wallet) => (
          <Transaction key={wallet?.publicKey?.toString()} wallet={wallet} />
        ))}
      </div>
    </div>
  );
};

export default Wallet;
