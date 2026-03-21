// frontend/src/contract.js
import { ethers } from "ethers";
import abi from "./abi/MyContract.json";
import { CONTRACT_ADDRESS } from "./config";

export async function getContract() {
    if (!window.ethereum) {
        throw new Error("MetaMask not found");
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    return new ethers.Contract(CONTRACT_ADDRESS, abi.abi, signer);
}