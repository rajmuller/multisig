import { ReactNode, useCallback } from "react";
import { useMoralis } from "react-moralis";

type LayoutProps = {
  children?: ReactNode;
};

const Header = () => {
  const { isAuthenticated, authenticate, logout } = useMoralis();

  const onSignin = useCallback(async () => {
    authenticate({ type: "sol" });
  }, [authenticate]);

  console.log({ isAuthenticated });

  return (
    <nav className="flex h-16 w-full items-center justify-between px-8">
      <div>LOGO</div>
      <div>
        <button
          onClick={isAuthenticated ? logout : onSignin}
          className="rounded bg-violet-500 px-3 py-3 font-semibold"
        >
          {isAuthenticated ? "Log out" : "Sign in with Phantom"}
        </button>
      </div>
    </nav>
  );
};

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="h-screen w-screen bg-gradient-to-br from-[#21103a] to-[#0b0318] text-white">
      <Header />
      {children}
    </div>
  );
};

export default Layout;
