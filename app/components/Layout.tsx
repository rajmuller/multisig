import { ReactNode, useCallback } from "react";

type LayoutProps = {
  children?: ReactNode;
};

const HEADER_HEIGHT = "72px";

const Header = () => {
  const { isAuthenticated, authenticate, logout } = useMoralis();

  const onSignin = useCallback(async () => {
    authenticate({ type: "sol" });
  }, [authenticate]);

  console.log({ isAuthenticated });

  return (
    <header
      className={`flex w-full items-center justify-between border-b border-b-violet-900 px-8`}
      style={{
        height: HEADER_HEIGHT,
      }}
    >
      <div>LOGO</div>
      <div>
        <button
          onClick={isAuthenticated ? logout : onSignin}
          className="rounded bg-violet-500 px-3 py-3 font-semibold"
        >
          {isAuthenticated ? "Log out" : "Sign in with Phantom"}
        </button>
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
