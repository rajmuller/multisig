import "../styles/globals.css";

import type { AppProps } from "next/app";
import { MoralisProvider } from "react-moralis";

import { Layout } from "@/components";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <MoralisProvider
      serverUrl={process.env.NEXT_PUBLIC_SERVER_URL!}
      appId={process.env.NEXT_PUBLIC_APP_ID!}
    >
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </MoralisProvider>
  );
}

export default MyApp;
