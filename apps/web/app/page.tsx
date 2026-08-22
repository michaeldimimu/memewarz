import JoinRoomForm from "./components/join-room-form";

const Home = () => {
  return (
    <>
      <h1 className="text-6xl font-bold text-center mb-4 tracking-tight">
        Welcome to <br /> <span className="font-black italic">MemeWarz</span>
      </h1>
      <p className="mb-8 text-2xl text-center">Enter a room code to join</p>
      <JoinRoomForm />
    </>
  );
};

export default Home;
