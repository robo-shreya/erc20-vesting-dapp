import { useEffect, useRef, useState } from "react";
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

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return "-";
  }

  return new Date(timestamp * 1000).toLocaleString();
}

function formatMetricValue(value) {
  const numericValue = Number.parseFloat(value);

  if (!Number.isFinite(numericValue)) {
    return value;
  }

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(numericValue);
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
  const [startTimestamp, setStartTimestamp] = useState(0);
  const [cliffTimestamp, setCliffTimestamp] = useState(0);
  const [endTimestamp, setEndTimestamp] = useState(0);
  const [currentTimestamp, setCurrentTimestamp] = useState(0);
  const [chainId, setChainId] = useState("");
  const [blockNumber, setBlockNumber] = useState("");
  const [rawStart, setRawStart] = useState("0");
  const [rawCliffDuration, setRawCliffDuration] = useState("0");
  const [rawDuration, setRawDuration] = useState("0");
  const [resolvedVestingAddress, setResolvedVestingAddress] = useState("-");
  const [providerLabel, setProviderLabel] = useState("MetaMask / injected provider");
  const [consistencyWarning, setConsistencyWarning] = useState("");
  const [genesisBlockHash, setGenesisBlockHash] = useState("-");
  const [providerEvents, setProviderEvents] = useState([]);
  const previousSnapshotRef = useRef(null);
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    if (!window.ethereum?.on) {
      return undefined;
    }

    function pushProviderEvent(label, details) {
      setProviderEvents((events) => [
        {
          id: `${Date.now()}-${label}`,
          time: new Date().toLocaleTimeString(),
          label,
          details,
        },
        ...events,
      ].slice(0, 8));
    }

    function handleDisconnect(error) {
      pushProviderEvent(
        "disconnect",
        error?.message || JSON.stringify(error) || "provider disconnected",
      );
    }

    function handleAccountsChanged(accounts) {
      pushProviderEvent(
        "accountsChanged",
        Array.isArray(accounts) ? accounts.join(", ") || "no accounts" : "unknown",
      );
    }

    function handleChainChanged(nextChainId) {
      pushProviderEvent("chainChanged", String(nextChainId));
    }

    window.ethereum.on("disconnect", handleDisconnect);
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      if (!window.ethereum?.removeListener) {
        return;
      }

      window.ethereum.removeListener("disconnect", handleDisconnect);
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  async function loadTokenState(
    token,
    wallet,
    beneficiaryAddress,
    vestingAddress,
    tokenDecimals
  ) {
    return {
      yourBalance: formatTokenAmount(await token.balanceOf(wallet), tokenDecimals),
      beneficiaryBalance: formatTokenAmount(
        await token.balanceOf(beneficiaryAddress),
        tokenDecimals,
      ),
      vestingBalance: formatTokenAmount(
        await token.balanceOf(vestingAddress),
        tokenDecimals,
      ),
      allowance: formatTokenAmount(
        await token.allowance(wallet, vestingAddress),
        tokenDecimals,
      ),
    };
  }

  async function loadClaimState(vesting, tokenDecimals) {
    try {
      return {
        vested: formatTokenAmount(await vesting.getVestedAmount(), tokenDecimals),
        claimable: formatTokenAmount(await vesting.getClaimableAmount(), tokenDecimals),
      };
    } catch {
      return {
        vested: "cliff didn't end yet",
        claimable: "cliff didn't end yet",
      };
    }
  }

  async function loadVestingContract() {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    const { token, vesting, signer, provider } = await getContracts();
    const wallet = await signer.getAddress();
    const tokenDecimals = Number(await token.decimals());
    const beneficiaryAddress = await vesting.beneficiary();
    const vestingAddress = await vesting.getAddress();
    const tokenAddress = await token.getAddress();
    const latestBlock = await provider.getBlock("latest");
    const genesisBlock = await provider.getBlock(0);
    const network = await provider.getNetwork();
    const ownerAddress = await vesting.owner();
    const fundedState = await vesting.funded();
    const startRaw = await vesting.start();
    const cliffDurationRaw = await vesting.cliffDuration();
    const durationRaw = await vesting.duration();
    const totalAllocationRaw = await vesting.totalAllocation();
    const releasedRaw = await vesting.released();
    const providerDebugLabel =
      window.ethereum?.isMetaMask
        ? "MetaMask injected provider (RPC URL not exposed)"
        : "Injected browser provider";
    const start = Number(startRaw);
    const cliffDuration = Number(cliffDurationRaw);
    const duration = Number(durationRaw);
    const nextSnapshot = {
      chainId: String(network.chainId),
      vestingAddress,
      tokenAddress,
      start: String(startRaw),
      cliffDuration: String(cliffDurationRaw),
      duration: String(durationRaw),
      totalAllocation: String(totalAllocationRaw),
      genesisBlockHash: genesisBlock?.hash || "-",
    };
    const previousSnapshot = previousSnapshotRef.current;

    if (loadRequestIdRef.current !== requestId) {
      return;
    }

    setDecimals(tokenDecimals);
    setAccount(wallet);
    setChainId(String(network.chainId));
    setBlockNumber(latestBlock ? String(latestBlock.number) : "-");
    setCurrentTimestamp(latestBlock ? Number(latestBlock.timestamp) : 0);
    setGenesisBlockHash(genesisBlock?.hash || "-");
    setResolvedVestingAddress(vestingAddress);
    setProviderLabel(providerDebugLabel);
    setOwner(ownerAddress);
    setBeneficiary(beneficiaryAddress);
    setFunded(fundedState);
    setTotalAllocation(formatTokenAmount(totalAllocationRaw, tokenDecimals));
    setReleased(formatTokenAmount(releasedRaw, tokenDecimals));
    setStartTimestamp(start);
    setCliffTimestamp(start + cliffDuration);
    setEndTimestamp(start + duration);
    setRawStart(String(startRaw));
    setRawCliffDuration(String(cliffDurationRaw));
    setRawDuration(String(durationRaw));

    if (previousSnapshot) {
      const changedFields = [];

      if (previousSnapshot.chainId !== nextSnapshot.chainId) {
        changedFields.push("chain ID");
      }

      if (previousSnapshot.vestingAddress !== nextSnapshot.vestingAddress) {
        changedFields.push("vesting address");
      }

      if (previousSnapshot.tokenAddress !== nextSnapshot.tokenAddress) {
        changedFields.push("token address");
      }

      if (previousSnapshot.start !== nextSnapshot.start) {
        changedFields.push("start");
      }

      if (previousSnapshot.cliffDuration !== nextSnapshot.cliffDuration) {
        changedFields.push("cliff duration");
      }

      if (previousSnapshot.duration !== nextSnapshot.duration) {
        changedFields.push("duration");
      }

      if (previousSnapshot.totalAllocation !== nextSnapshot.totalAllocation) {
        changedFields.push("total allocation");
      }

      if (previousSnapshot.genesisBlockHash !== genesisBlock?.hash) {
        changedFields.push("genesis block hash");
      }

      setConsistencyWarning(
        changedFields.length > 0
          ? `Inconsistent chain state across refreshes. Changed: ${changedFields.join(", ")}. This usually means the app is reading a different localhost chain session or a different deployment.`
          : "",
      );
    } else {
      setConsistencyWarning("");
    }

    previousSnapshotRef.current = nextSnapshot;

    const tokenState = await loadTokenState(
      token,
      wallet,
      beneficiaryAddress,
      vestingAddress,
      tokenDecimals,
    );
    const claimState = await loadClaimState(vesting, tokenDecimals);

    if (loadRequestIdRef.current !== requestId) {
      return;
    }

    setYourBalance(tokenState.yourBalance);
    setBeneficiaryBalance(tokenState.beneficiaryBalance);
    setVestingBalance(tokenState.vestingBalance);
    setAllowance(tokenState.allowance);
    setVested(claimState.vested);
    setClaimable(claimState.claimable);
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
  const numericAllowance = Number.parseFloat(allowance) || 0;
  const numericClaimable = Number.parseFloat(claimable);
  const hasConnectedWallet = Boolean(account);
  const accountLower = account.toLowerCase();
  const ownerLower = owner.toLowerCase();
  const beneficiaryLower = beneficiary.toLowerCase();
  const isOwner = hasConnectedWallet && owner !== "-" && accountLower === ownerLower;
  const isBeneficiary =
    hasConnectedWallet &&
    beneficiary !== "-" &&
    accountLower === beneficiaryLower;
  const cliffReached = currentTimestamp >= cliffTimestamp && cliffTimestamp > 0;
  const vestingEnded = currentTimestamp >= endTimestamp && endTimestamp > 0;
  const canApprove = hasConnectedWallet && isOwner && !funded && numericAllocation > 0;
  const canFund =
    hasConnectedWallet &&
    isOwner &&
    !funded &&
    numericAllowance >= numericAllocation &&
    numericAllocation > 0;
  const canClaim =
    hasConnectedWallet &&
    isBeneficiary &&
    funded &&
    cliffReached &&
    Number.isFinite(numericClaimable) &&
    numericClaimable > 0;
  const partialClaimAmountNumber = Number.parseFloat(partialClaimAmount);
  const canPartialClaim =
    canClaim &&
    Number.isFinite(partialClaimAmountNumber) &&
    partialClaimAmountNumber > 0 &&
    partialClaimAmountNumber <= numericClaimable;
  let roleLabel = "Viewer";

  if (isOwner && isBeneficiary) {
    roleLabel = "Owner + Beneficiary";
  } else if (isOwner) {
    roleLabel = "Owner";
  } else if (isBeneficiary) {
    roleLabel = "Beneficiary";
  }

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

  const schedule = [
    { label: "Start", value: formatTimestamp(startTimestamp) },
    { label: "Cliff unlock", value: formatTimestamp(cliffTimestamp) },
    { label: "Vesting end", value: formatTimestamp(endTimestamp) },
    { label: "Chain time", value: formatTimestamp(currentTimestamp) },
  ];

  const debugValues = [
    { label: "Active account", value: account || "-" },
    { label: "Provider", value: providerLabel },
    { label: "Chain ID", value: chainId || "-" },
    { label: "Latest block", value: blockNumber || "-" },
    { label: "Genesis block hash", value: genesisBlockHash },
    { label: "Vesting contract", value: resolvedVestingAddress || TOKEN_VESTING_ADDRESS },
    { label: "Raw start", value: rawStart },
    { label: "Raw cliff duration", value: rawCliffDuration },
    { label: "Raw duration", value: rawDuration },
    { label: "Current block timestamp", value: String(currentTimestamp || "-") },
  ];

  let actionHint = "Connect a wallet to interact with the contracts.";

  if (hasConnectedWallet && !isOwner && !isBeneficiary) {
    actionHint = "This wallet is read-only here. Funding is owner-only and claims are beneficiary-only.";
  } else if (isOwner && !funded && numericAllowance < numericAllocation) {
    actionHint = "Approve the full allocation before funding the vesting contract.";
  } else if (isOwner && !funded) {
    actionHint = "The owner can fund the vesting contract now.";
  } else if (isBeneficiary && funded && !cliffReached) {
    actionHint = "The beneficiary must wait until the cliff timestamp before claiming.";
  } else if (isBeneficiary && canClaim) {
    actionHint = "Tokens are claimable now. The beneficiary can claim all or a custom amount.";
  } else if (funded && vestingEnded) {
    actionHint = "Vesting has ended. Any remaining vested tokens can be claimed by the beneficiary.";
  }

  return (
    <div className="app">
      <section className="hero panel">
        <div className="hero-copy">
          <p className="eyebrow">Token Vesting Dashboard</p>
          <h1>Track funding, release progress, and beneficiary claims in one view.</h1>
        </div>

        <div className="wallet-card">
          <span className={`pill ${account ? "pill-live" : "pill-idle"}`}>
            {account ? "Wallet connected" : "Wallet offline"}
          </span>
          <p className="wallet-address">{formatAddress(account || "-")}</p>
          <div className="role-line">
            <span className="role-label">Current role</span>
            <strong>{roleLabel}</strong>
          </div>
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
            <h2 className="metric-value" title={metric.value}>
              {formatMetricValue(metric.value)}
            </h2>
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
              <span>Owner wallet</span>
              <code>{owner}</code>
            </div>
            <div className="detail-row">
              <span>Beneficiary wallet</span>
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

      <section className="content-grid">
        <article className="panel detail-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Schedule</p>
              <h2>Vesting timeline</h2>
            </div>
            <span className={`pill ${cliffReached ? "pill-live" : "pill-idle"}`}>
              {cliffReached ? "Cliff reached" : "Cliff locked"}
            </span>
          </div>

          <div className="detail-list">
            {schedule.map((item) => (
              <div className="detail-row" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel detail-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Interaction rules</p>
              <h2>What this wallet can do</h2>
            </div>
          </div>

          <p className="action-hint">{actionHint}</p>
          <div className="permission-list">
            <div className="balance-row">
              <span>Approve allocation</span>
              <strong>{canApprove ? "Available" : "Unavailable"}</strong>
            </div>
            <div className="balance-row">
              <span>Fund vesting</span>
              <strong>{canFund ? "Available" : "Unavailable"}</strong>
            </div>
            <div className="balance-row">
              <span>Claim all</span>
              <strong>{canClaim ? "Available" : "Unavailable"}</strong>
            </div>
            <div className="balance-row">
              <span>Partial claim</span>
              <strong>{canPartialClaim ? "Available" : "Unavailable"}</strong>
            </div>
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
          <button
            className="primary-button"
            onClick={handleApprove}
            disabled={!canApprove}
          >
            Approve allocation
          </button>
          <button
            className="secondary-button"
            onClick={handleFund}
            disabled={!canFund}
          >
            Fund vesting
          </button>
          <button
            className="secondary-button"
            onClick={handleClaimAll}
            disabled={!canClaim}
          >
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
            <button
              className="secondary-button"
              onClick={handlePartialClaim}
              disabled={!canPartialClaim}
            >
              Claim custom amount
            </button>
          </div>
        </div>
      </section>

      <section className="panel detail-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Debug</p>
            <h2>Chain and contract state</h2>
          </div>
        </div>

        {consistencyWarning ? (
          <p className="debug-warning">{consistencyWarning}</p>
        ) : null}

        <div className="detail-list">
          {debugValues.map((item) => (
            <div className="detail-row" key={item.label}>
              <span>{item.label}</span>
              <code>{item.value}</code>
            </div>
          ))}
        </div>

        <div className="debug-events">
          <p className="eyebrow">Provider events</p>
          {providerEvents.length === 0 ? (
            <p className="debug-empty">No provider events captured yet.</p>
          ) : (
            <div className="detail-list">
              {providerEvents.map((event) => (
                <div className="detail-row" key={event.id}>
                  <span>{`${event.time} • ${event.label}`}</span>
                  <code>{event.details}</code>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default App;
