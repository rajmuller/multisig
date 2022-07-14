import "../styles/globals.css";

import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import {
  createDefaultAuthorizationResultCache,
  SolanaMobileWalletAdapter,
} from "@solana-mobile/wallet-adapter-mobile";
import type { AppProps } from "next/app";
import { useMemo } from "react";
import { QueryClient, QueryClientProvider } from "react-query";
import { ReactQueryDevtools } from "react-query/devtools";

import { Layout } from "@/components";

require("@solana/wallet-adapter-react-ui/styles.css");

const queryClient = new QueryClient();

function MyApp({ Component, pageProps }: AppProps) {
  const endpoint = useMemo(
    () => clusterApiUrl(WalletAdapterNetwork.Devnet),
    []
  );
  const wallets = useMemo(
    () => [
      new SolanaMobileWalletAdapter({
        appIdentity: { name: "Solana Multisig Wallet App" },
        authorizationResultCache: createDefaultAuthorizationResultCache(),
      }),
      new PhantomWalletAdapter(),
    ],
    []
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <Layout>
              <Component {...pageProps} />
            </Layout>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default MyApp;
