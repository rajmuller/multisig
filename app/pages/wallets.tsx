import { MultisigWalletType, useMultisigWallets } from "hooks";
import type { NextPage } from "next";
import Link from "next/link";

type WalletProps = {
  wallet: MultisigWalletType;
};

const Wallet = ({ wallet }: WalletProps) => {
  const walletPubKeyString = wallet.publicKey.toString();

  return (
    <div className="flex flex-col gap-6 overflow-hidden rounded p-4 text-start shadow-lg shadow-violet-700 hover:cursor-pointer hover:shadow-xl hover:shadow-violet-700">
      <div className="w-full overflow-hidden truncate text-xl">
        <p>Wallet pubkey: </p>
        <p className="w-full overflow-hidden truncate text-sm text-violet-200">
          {walletPubKeyString}
        </p>
      </div>
      {wallet.account.owners.map((owner, i) => (
        <div
          className="w-full overflow-hidden truncate text-lg"
          key={owner.toString()}
        >
          <p>Owner {i + 1}:</p>
          <p className="truncate text-sm text-violet-200">{owner.toString()}</p>
        </div>
      ))}
      <div>
        <p className="text-lg">Proposal Count: </p>
        <p className="truncate text-sm text-violet-200">
          {wallet.account.proposalCounter.toString()}
        </p>
      </div>
      <div>
        <p className="text-lg">Threshold:: </p>
        <p className="truncate text-sm text-violet-200">
          {wallet.account.threshold.toString()}
        </p>
      </div>
    </div>
  );
};

const Wallets: NextPage = () => {
  const { data, isLoading } = useMultisigWallets();

  if (isLoading || !data) {
    return (
      <div className="px flex h-full w-full flex-col items-center gap-8 px-8">
        <p className="my-20 text-7xl">Loading Wallets</p>
        <span
          className="spinner-border ml-8 inline-block h-8 w-8 animate-spin rounded-full border-4 text-violet-100"
          role="status"
        ></span>
      </div>
    );
  }

  return (
    <div className="px flex h-full w-full flex-col items-center gap-8 px-8">
      <p className="my-20 text-7xl">Wallets</p>
      <div className="grid w-full grid-cols-4">
        {data.map((wallet) => {
          const walletPubKeyString = wallet.publicKey.toString();

          return (
            <Link
              href={{
                pathname: "/wallet/[slug]",
                query: { slug: walletPubKeyString },
              }}
              key={walletPubKeyString}
            >
              <a>
                <Wallet wallet={wallet} />
              </a>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default Wallets;
