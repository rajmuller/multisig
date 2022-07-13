import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { ReactNode, useCallback } from "react";

type LayoutProps = {
  children?: ReactNode;
};

const HEADER_HEIGHT = "72px";

const Header = () => {
  const { connection } = useConnection();
  const { connected } = useWallet();

  console.log({ connected });

  return (
    <header
      className={`flex w-full items-center justify-between border-b border-b-violet-900 px-8`}
      style={{
        height: HEADER_HEIGHT,
      }}
    >
      <div>LOGO</div>
      <div>
        <WalletMultiButton />
      </div>
    </header>
  );
};

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="h-screen w-screen bg-gradient-to-br from-[#21103a] to-[#0b0318] text-white">
      <Header />
      <main
        style={{
          height: `calc(100vh - ${HEADER_HEIGHT}`,
        }}
      >
        {children}
      </main>
    </div>
  );
};

export default Layout;
