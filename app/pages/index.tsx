import type { NextPage } from "next";
import { useEffect } from "react";
import { useMoralisSolanaApi, useMoralisSolanaCall } from "react-moralis";

const Home: NextPage = () => {
  const { account } = useMoralisSolanaApi();

  const { fetch, data, isLoading } = useMoralisSolanaCall(account.balance, {
    // @ts-ignore
    network: "devnet",
    address: "AwLaRY7N92bnHf7pLaxEV1Vj94nrBp1Hm8MR11qcQT15",
  });

  console.log({ isLoading });
  console.log({ account });
  console.log({ data });

  return (
    <>
      <button
        onClick={() => fetch()}
        className="rounded bg-violet-500 px-3 py-1.5 font-medium"
      >
        Fetch
      </button>
      {data?.solana}
    </>
  );
};

export default Home;
