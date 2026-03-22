import { useState } from "react";
import "./App.css";
import { getWalletContext, requestAccounts } from "./contractHelper";

function App() {
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState("not connected");

  async function handleConnectWallet() {
    try {
      await requestAccounts();
      const { signer } = await getWalletContext();
      const wallet = await signer.getAddress();
      setAccount(wallet);
      setStatus(wallet ? "connected" : "not connected");
    } catch (error) {
      setStatus(error.message || "connection failed");
    }
  }

  return (
    <div className="app">
      <h1>vesting skeleton frontend</h1>

      <section className="panel">
        <div className="row">
          <button onClick={handleConnectWallet}>connect wallet</button>
          <span className="status">{status}</span>
        </div>
        <p>account: {account || "-"}</p>
        <p>token: -</p>
        <p>vesting: -</p>
      </section>

      <section className="panel">
        <h2>state</h2>
        <p>owner: -</p>
        <p>beneficiary: -</p>
        <p>funded: false</p>
        <p>allocation: 0</p>
        <p>vested: 0</p>
        <p>claimable: 0</p>
        <p>released: 0</p>
        <p>your balance: 0</p>
        <p>beneficiary balance: 0</p>
        <p>vesting balance: 0</p>
        <p>allowance: 0</p>
      </section>

      <section className="panel">
        <h2>actions</h2>
        <div className="actions">
          <button>approve</button>
          <button>fund</button>
          <button>claim all</button>
        </div>

        <div className="actions">
          <input type="number" placeholder="amount" />
          <button>partial claim</button>
        </div>
      </section>
    </div>
  );
}

export default App;
