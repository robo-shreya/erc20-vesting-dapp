import { useState } from "react";
import "./App.css";
import {
  formatTokenAmount,
  getContracts,
  getWalletContext,
  parseTokenAmount,
  requestAccounts,
} from "./contractHelper";

import { MY_TOKEN_ADDRESS, TOKEN_VESTING_ADDRESS } from "./config";

function formatAddress(address) {
  if (!address || address === "-") {
    return "-";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function App() {
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState("not connected");
  const [decimals, setDecimals] = useState(18);
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

  async function loadBasicVestingState(
    vesting,
    tokenDecimals,
    beneficiaryAddress,
  ) {
    setOwner(await vesting.owner());
    setBeneficiary(beneficiaryAddress);
    setFunded(await vesting.funded());
    setTotalAllocation(
      formatTokenAmount(await vesting.totalAllocation(), tokenDecimals),
    );
    setReleased(formatTokenAmount(await vesting.released(), tokenDecimals));
  }

  async function loadTokenState(
    token,
    wallet,
    beneficiaryAddress,
    vestingAddress,
    tokenDecimals
  ) {
    setYourBalance(formatTokenAmount(await token.balanceOf(wallet), tokenDecimals));
    setBeneficiaryBalance(
      formatTokenAmount(await token.balanceOf(beneficiaryAddress), tokenDecimals),
    );
    setVestingBalance(
      formatTokenAmount(await token.balanceOf(vestingAddress), tokenDecimals),
    );
    setAllowance(
      formatTokenAmount(await token.allowance(wallet, vestingAddress), tokenDecimals),
    );
  }

  async function loadClaimState(vesting, tokenDecimals) {
    try {
      setVested(formatTokenAmount(await vesting.getVestedAmount(), tokenDecimals));
      setClaimable(
        formatTokenAmount(await vesting.getClaimableAmount(), tokenDecimals),
      );
    } catch {
      setVested("cliff didn't end yet");
      setClaimable("cliff didn't end yet");
    }
  }

  async function loadVestingContract() {
    const { token, vesting, signer } = await getContracts();
    const wallet = await signer.getAddress();
    const tokenDecimals = Number(await token.decimals());
    const beneficiaryAddress = await vesting.beneficiary();
    const vestingAddress = await vesting.getAddress();

    setDecimals(tokenDecimals);

    await loadBasicVestingState(vesting, tokenDecimals, beneficiaryAddress);
    await loadTokenState(
      token,
      wallet,
      beneficiaryAddress,
      vestingAddress,
      tokenDecimals
    );
    await loadClaimState(vesting, tokenDecimals);
  }

  async function handleConnectWallet() {
    try {
      await requestAccounts();
      const { signer } = await getWalletContext();
      const wallet = await signer.getAddress();
      setAccount(wallet);
      await loadVestingContract();
      setStatus(wallet ? "connected" : "not connected");
    } catch (error) {
      setStatus(error.message || "connection failed");
    }
  }

  async function handleRefresh() {
    try {
      setStatus("refreshing state");
      await loadVestingContract();
      setStatus("state refreshed");
    } catch (error) {
      setStatus(error.message || "refresh failed");
    }
  }

  async function runTransaction(
    action,
    pendingMessage,
    submittedMessage,
    successMessage,
    failureMessage
  ) {
    try {
      setStatus(pendingMessage);
      const tx = await action();

      setStatus(submittedMessage);
      await tx.wait();

      await loadVestingContract();
      setStatus(successMessage);
    } catch (error) {
      setStatus(error.message || failureMessage);
    }
  }

  async function handleApprove() {
    const { token, vesting } = await getContracts();
    const vestingAddress = await vesting.getAddress();
    const allocation = await vesting.totalAllocation();

    await runTransaction(
      () => token.approve(vestingAddress, allocation),
      "waiting for approve confirmation",
      "approve transaction submitted",
      "approve successful",
      "approve failed"
    );
  }

  async function handleFund() {
    const { vesting } = await getContracts();

    await runTransaction(
      () => vesting.fund(),
      "waiting for fund confirmation",
      "fund transaction submitted",
      "fund successful",
      "fund failed"
    );
  }

  async function handleClaimAll() {
    const { vesting } = await getContracts();

    await runTransaction(
      () => vesting.claim(),
      "waiting for claim confirmation",
      "claim transaction submitted",
      "claim successful",
      "claim failed"
    );
  }

  async function handlePartialClaim() {
    const { vesting } = await getContracts();
    const amount = parseTokenAmount(partialClaimAmount || "0", decimals);

    await runTransaction(
      () => vesting.partialClaim(amount),
      "waiting for partial claim confirmation",
      "partial claim transaction submitted",
      "partial claim successful",
      "partial claim failed"
    );
  }

  const numericAllocation = Number.parseFloat(totalAllocation) || 0;
  const numericReleased = Number.parseFloat(released) || 0;
  const releaseProgress = numericAllocation
    ? Math.min((numericReleased / numericAllocation) * 100, 100)
    : 0;
  const fundingProgress = numericAllocation
    ? Math.min(
        ((Number.parseFloat(vestingBalance) || 0) / numericAllocation) * 100,
        100,
      )
    : 0;

  const metrics = [
    { label: "Total allocation", value: totalAllocation, note: "locked for vesting" },
    { label: "Released", value: released, note: "already sent out" },
    { label: "Claimable now", value: claimable, note: "available to withdraw" },
    { label: "Vested so far", value: vested, note: "earned by schedule" },
  ];

  const balances = [
    { label: "Your wallet", value: yourBalance },
    { label: "Beneficiary", value: beneficiaryBalance },
    { label: "Vesting contract", value: vestingBalance },
    { label: "Allowance", value: allowance },
  ];

  return (
    <div className="app">
      <section className="hero panel">
        <div className="hero-copy">
          <p className="eyebrow">Token Vesting Dashboard</p>
          <h1>Track funding, release progress, and beneficiary claims in one view.</h1>
          <p className="hero-text">
            This UI is wired to your local Hardhat deployment and surfaces the key
            token and vesting states without changing the contract flow.
          </p>
        </div>

        <div className="wallet-card">
          <span className={`pill ${account ? "pill-live" : "pill-idle"}`}>
            {account ? "Wallet connected" : "Wallet offline"}
          </span>
          <p className="wallet-address">{formatAddress(account || "-")}</p>
          <p className="wallet-status">{status}</p>
          <div className="wallet-actions">
            <button className="primary-button" onClick={handleConnectWallet}>
              {account ? "Reconnect wallet" : "Connect wallet"}
            </button>
            <button className="secondary-button" onClick={handleRefresh}>
              Refresh state
            </button>
          </div>
        </div>
      </section>

      <section className="overview-grid">
        {metrics.map((metric) => (
          <article className="metric-card panel" key={metric.label}>
            <p className="metric-label">{metric.label}</p>
            <h2>{metric.value}</h2>
            <p className="metric-note">{metric.note}</p>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <article className="panel detail-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Contracts</p>
              <h2>Addresses and roles</h2>
            </div>
            <span className={`pill ${funded ? "pill-live" : "pill-idle"}`}>
              {funded ? "Funded" : "Waiting for funding"}
            </span>
          </div>

          <div className="detail-list">
            <div className="detail-row">
              <span>Connected account</span>
              <code>{account || "-"}</code>
            </div>
            <div className="detail-row">
              <span>Owner</span>
              <code>{owner}</code>
            </div>
            <div className="detail-row">
              <span>Beneficiary</span>
              <code>{beneficiary}</code>
            </div>
            <div className="detail-row">
              <span>Token contract</span>
              <code>{MY_TOKEN_ADDRESS}</code>
            </div>
            <div className="detail-row">
              <span>Vesting contract</span>
              <code>{TOKEN_VESTING_ADDRESS}</code>
            </div>
          </div>
        </article>

        <article className="panel detail-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Progress</p>
              <h2>Funding and release</h2>
            </div>
          </div>

          <div className="progress-block">
            <div className="progress-labels">
              <span>Funding</span>
              <span>{fundingProgress.toFixed(0)}%</span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill progress-fill-funding"
                style={{ width: `${fundingProgress}%` }}
              />
            </div>
          </div>

          <div className="progress-block">
            <div className="progress-labels">
              <span>Released</span>
              <span>{releaseProgress.toFixed(0)}%</span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill progress-fill-release"
                style={{ width: `${releaseProgress}%` }}
              />
            </div>
          </div>

          <div className="balance-list">
            {balances.map((item) => (
              <div className="balance-row" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel action-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Actions</p>
            <h2>Move the vesting flow forward</h2>
          </div>
        </div>

        <div className="actions">
          <button className="primary-button" onClick={handleApprove}>
            Approve allocation
          </button>
          <button className="secondary-button" onClick={handleFund}>
            Fund vesting
          </button>
          <button className="secondary-button" onClick={handleClaimAll}>
            Claim all
          </button>
        </div>

        <div className="partial-claim">
          <label htmlFor="partial-claim-input">Partial claim amount</label>
          <div className="partial-claim-controls">
            <input
              id="partial-claim-input"
              type="number"
              placeholder="0.0"
              value={partialClaimAmount}
              onChange={(event) => setPartialClaimAmount(event.target.value)}
            />
            <button className="secondary-button" onClick={handlePartialClaim}>
              Claim custom amount
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
