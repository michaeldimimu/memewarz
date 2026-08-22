"use client";

import CreateRoomForm from "./components/create-room-form";
import JoinRoomForm from "./components/join-room-form";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

const WalletButton = () => {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex flex-col items-center gap-2 mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-neutral-light-200 rounded-xl px-4 py-2 font-mono text-sm text-neutral-dark-200 border border-gray-200 font-bold shadow-xs">
            🟢 {address.slice(0, 6)}…{address.slice(-4)}
          </div>
          <button
            type="button"
            onClick={() => disconnect()}
            className="font-bold text-sm text-neutral-dark-100 hover:text-red-500 underline transition-colors cursor-pointer"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  const handleConnect = async () => {
    // Check if browser has an injected Web3 provider (e.g. MetaMask)
    if (typeof window !== "undefined" && !(window as any).ethereum) {
      alert(
        "No Web3 wallet extension detected! Please install MetaMask or another Web3 browser extension to connect."
      );
      return;
    }

    try {
      const targetConnector = connectors.find((c) => c.id === "injected") || injected();
      connect({ connector: targetConnector });
    } catch (err: any) {
      console.error("Wallet connection error:", err);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 mb-8">
      <button
        type="button"
        disabled={isPending}
        onClick={handleConnect}
        className="font-bold mx-auto block bg-neutral-dark-200 hover:bg-neutral-dark-100 px-6 py-3 rounded-xl text-neutral-light-100 text-lg disabled:opacity-50 transition-all shadow-md active:scale-95 cursor-pointer"
      >
        {isPending ? "Connecting..." : "Connect Wallet"}
      </button>

      {error && (
        <p className="text-red-500 text-sm font-semibold max-w-xs text-center">
          {error.message.includes("User rejected")
            ? "Connection request cancelled."
            : error.message}
        </p>
      )}
    </div>
  );
};

const Home = () => {
  return (
    <>
      <h1 className="text-6xl font-bold text-center mb-4 tracking-tight">
        Welcome to <br /> <span className="font-black italic">MemeWarz</span>
      </h1>
      <p className="mb-8 text-2xl text-center">Enter a room code to join</p>
      <WalletButton />
      <JoinRoomForm />
      <CreateRoomForm />
    </>
  );
};

export default Home;
