import { useState } from "react";
import "./App.css";
import {
  getContracts,
  getWalletContext,
  requestAccounts,
} from "./contractHelper";

function App() {
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState("not connected");
  const [partialClaimAmount, setPartialClaimAmount] = useState("");
  const [owner, setOwner] = useState("-");
  const [beneficiary, setBeneficiary] = useState("-");
  const [funded, setFunded] = useState(false);
  const [totalAllocation, setTotalAllocation] = useState("0");
  const [released, setReleased] = useState("0");
  const [vested, setVested] = useState("0");
  const [claimable, setClaimable] = useState("0");
  const [yourBalance, setYourBalance] = useState("0");
  const [beneficiaryBalance, setBeneficiaryBalance] = useState("0");
  const [vestingBalance, setVestingBalance] = useState("0");
  const [allowance, setAllowance] = useState("0");

  async function loadVestingContract() {
    const { token, vesting, signer } = await getContracts();
    const wallet = await signer.getAddress();
    const beneficiaryAddress = await vesting.beneficiary();
    const vestingAddress = await vesting.getAddress();

    setOwner(await vesting.owner());
    setBeneficiary(beneficiaryAddress);
    setFunded(await vesting.funded());
    setTotalAllocation((await vesting.totalAllocation()).toString());
    setReleased((await vesting.released()).toString());
    setYourBalance((await token.balanceOf(wallet)).toString());
    setBeneficiaryBalance((await token.balanceOf(beneficiaryAddress)).toString());
    setVestingBalance((await token.balanceOf(vestingAddress)).toString());
    setAllowance((await token.allowance(wallet, vestingAddress)).toString());

    // to show default 0 value before cliff ends 
    try {
      setVested((await vesting.getVestedAmount()).toString());
      setClaimable((await vesting.getClaimableAmount()).toString());
    } catch {
      setVested("cliff didn't end yet");
      setClaimable("cliff didn't end yet");
    }
  }

  async function handleConnectWallet() {
    try {
      // asks MetaMask for permission
      await requestAccounts();

      // gets the signer
      const { signer } = await getWalletContext();

      // gives the connected wallet address
      const wallet = await signer.getAddress();
      setAccount(wallet);
      await loadVestingContract();
      setStatus(wallet ? "connected" : "not connected");
    } catch (error) {
      setStatus(error.message || "connection failed");
    }
  }

  // TODO accept custom amounts to approve
  async function handleApprove() {
    try {
      setStatus("waiting for approve confirmation");
      const { token, vesting } = await getContracts();
      const vestingAddress = await vesting.getAddress();
      const allocation = await vesting.totalAllocation();
      const tx = await token.approve(vestingAddress, allocation);

      setStatus("approve transaction submitted");
      await tx.wait();

      await loadVestingContract();
      setStatus("approve successful");
    } catch (error) {
      setStatus(error.message || "approve failed");
    }
  }

  async function handleFund() {
    try {
      setStatus("waiting for fund confirmation");
      const { vesting } = await getContracts();
      const tx = await vesting.fund();

      setStatus("fund transaction submitted");
      await tx.wait();

      await loadVestingContract();
      setStatus("fund successful");
    } catch (error) {
      setStatus(error.message || "fund failed");
    }
  }

  // a lot of redundant setup code can be separated 
  // TODO add possibility to manipulate time from UI to test this
  async function handleClaimAll() {
    try {
      setStatus("waiting for claim confirmation");
      const { vesting } = await getContracts();
      const tx = await vesting.claim();

      setStatus("claim transaction submitted");
      await tx.wait();

      await loadVestingContract();
      setStatus("claim successful");
    } catch (error) {
      setStatus(error.message || "claim failed");
    }
  }

  async function handlePartialClaim() {
    try {
      setStatus("waiting for partial claim confirmation");
      const { vesting } = await getContracts();
      const tx = await vesting.partialClaim(partialClaimAmount);

      setStatus("partial claim transaction submitted");
      await tx.wait();

      await loadVestingContract();
      setStatus("partial claim successful");
    } catch (error) {
      setStatus(error.message || "partial claim failed");
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
        <p>owner: {owner}</p>
        <p>beneficiary: {beneficiary}</p>
        <p>funded: {String(funded)}</p>
        <p>allocation: {totalAllocation}</p>
        <p>vested: {vested}</p>
        <p>claimable: {claimable}</p>
        <p>released: {released}</p>
        <p>your balance: {yourBalance}</p>
        <p>beneficiary balance: {beneficiaryBalance}</p>
        <p>vesting balance: {vestingBalance}</p>
        <p>allowance: {allowance}</p>
      </section>

      <section className="panel">
        <h2>actions</h2>
        <div className="actions">
          <button onClick={handleApprove}>approve</button>
          <button onClick={handleFund}>fund</button>
          <button onClick={handleClaimAll}>claim all</button>
        </div>

        <div className="actions">
          <input
            type="number"
            placeholder="amount"
            value={partialClaimAmount}
            onChange={(event) => setPartialClaimAmount(event.target.value)}
          />
          <button onClick={handlePartialClaim}>partial claim</button>
        </div>
      </section>
    </div>
  );
}

export default App;
