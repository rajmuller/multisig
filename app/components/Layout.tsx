import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";

type LayoutProps = {
  children?: ReactNode;
};

const HEADER_HEIGHT = "72px";

const Header = () => {
  return (
    <header
      style={{
        height: HEADER_HEIGHT,
      }}
    >
      <div
        className={`mx-auto flex w-full max-w-7xl items-center justify-between px-8`}
      >
        <Image width={60} height={60} src="/miros.webp" alt="Miros" />
        <nav>
          <ul className="flex items-center justify-center gap-8 font-semibold">
            <li className="hover:text-violet-300 active:text-violet-500">
              <Link href="/">
                <a className="p-4">Create</a>
              </Link>
            </li>
            <li className="hover:text-violet-300 active:text-violet-500">
              <Link href="/wallets">
                <a className="p-4">Wallets</a>
              </Link>
            </li>
            <li className="p-4 pr-0">
              <WalletMultiButton />
            </li>
          </ul>
        </nav>
      </div>
      <div className="h-px w-screen bg-violet-900" />
    </header>
  );
};

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex w-screen flex-col items-center bg-gradient-to-br from-[#21103a] to-[#0b0318] text-center text-white">
      <Header />
      <main
        className="w-full max-w-7xl"
        style={{
          minHeight: `calc(100vh - ${HEADER_HEIGHT})`,
        }}
      >
        {children}
      </main>
    </div>
  );
};

export default Layout;
