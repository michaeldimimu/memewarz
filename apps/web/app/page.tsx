"use client";

import CreateRoomForm from "./components/create-room-form";
import JoinRoomForm from "./components/join-room-form";
import { useAccount, useConnect, useDisconnect } from "wagmi";

const WalletButton = () => {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3 mb-8 justify-center">
        <div className="bg-neutral-light-200 rounded-xl px-4 py-2 font-mono text-sm text-neutral-dark-200 border border-gray-200">
          {address.slice(0, 6)}…{address.slice(-4)}
        </div>
        <button
          onClick={() => disconnect()}
          className="font-bold text-sm text-neutral-dark-100 underline"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        const connector = connectors[0];
        if (connector) connect({ connector });
      }}
      className="font-bold mb-8 mx-auto block bg-neutral-dark-200 px-6 py-3 rounded-xl text-neutral-light-100 text-lg"
    >
      Connect Wallet
    </button>
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
