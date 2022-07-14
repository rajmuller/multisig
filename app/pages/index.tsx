import { useInitializeMultisigWallet } from "hooks";
import type { NextPage } from "next";
import { useState } from "react";

const Home: NextPage = () => {
  const [ownerA, setOwnerA] = useState<string>("");
  const [ownerB, setOwnerB] = useState<string>("");
  const [ownerC, setOwnerC] = useState<string>("");
  const [threshold, setThreshold] = useState<string>("");

  const { onInitMultisigWallet } = useInitializeMultisigWallet(
    ownerA,
    ownerB,
    ownerC,
    threshold
  );

  return (
    <div className="px flex h-full w-full flex-col items-center gap-8 px-8">
      <p className="my-20 text-7xl">Create Multisig Wallet</p>
      <div className="flex flex-col gap-4">
        <div className="mb-6 flex flex-col items-start">
          <label
            htmlFor="ownerA"
            className="mb-2 block text-sm font-medium text-violet-50"
          >
            Owner A Public Key
          </label>
          <p className="mb-2 text-xs">
            testOwnerA: 9RHPFtDU5BD4GsDBYtnttZxipJYfrVPZMD4c2TJ9wYyJ
          </p>
          <input
            onChange={(e) => setOwnerA(e.target.value)}
            value={ownerA}
            type="text"
            id="ownerA"
            className="block w-[400px] rounded-lg bg-[#462a74] p-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-400"
          />
        </div>

        <div className="mb-6 flex flex-col items-start">
          <label
            htmlFor="ownerB"
            className="mb-2 block text-sm font-medium text-violet-50"
          >
            Owner B Public Key
          </label>
          <p className="mb-2 text-xs">
            testOwnerB: 9mWLqL64yH13JqKoVxGwVvLwUWNHLZ8ogrKK2dqUEw4Z
          </p>
          <input
            onChange={(e) => setOwnerB(e.target.value)}
            value={ownerB}
            type="text"
            id="ownerB"
            className="block w-[400px] rounded-lg bg-[#462a74] p-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-400"
          />
        </div>

        <div className="mb-6 flex flex-col items-start">
          <label
            htmlFor="ownerC"
            className="mb-2 block text-sm font-medium text-violet-50"
          >
            Owner C Public Key
          </label>
          <p className="mb-2 text-xs">
            testOwnerC: 9aHVNb5SsDfFy9CjWgGorgCu9bq6oSiHfBbAfpq8jP2y
          </p>
          <input
            onChange={(e) => setOwnerC(e.target.value)}
            value={ownerC}
            type="text"
            id="ownerC"
            className="block w-[400px] rounded-lg bg-[#462a74] p-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-400"
          />
        </div>
      </div>

      <div className="flex items-end justify-center gap-16">
        <div className="flex flex-col items-start justify-end">
          <label
            htmlFor="threshold"
            className="mb-2 block text-sm font-medium text-violet-50"
          >
            Threshold
          </label>
          <input
            onChange={(e) => setThreshold(e.target.value)}
            value={threshold}
            type="number"
            max={2}
            min={2}
            id="threshold"
            className="block w-20 rounded-lg bg-[#462a74] p-2.5 text-2xl text-white focus:outline-none focus:ring-1 focus:ring-violet-400"
          />
        </div>
        <button
          onClick={onInitMultisigWallet}
          className="h-full rounded bg-violet-500 px-3 py-1.5 font-medium hover:bg-violet-600 active:bg-violet-700"
        >
          Initialize Multisig Wallet
        </button>
      </div>
    </div>
  );
};

export default Home;
