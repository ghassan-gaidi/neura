"""Autonomous payment handling for the Neura SDK.

When the API returns 402 Payment Required, the SDK can automatically
send USDC on Base and retry the request.

Two modes:
  1. Callback — provide on_payment_required, SDK handles verification + retry
  2. Private key — provide private_key, SDK sends USDC via web3.py
"""

from typing import Optional, Callable, Awaitable
import time
import json
from urllib.request import Request, urlopen

USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
BASE_RPC = "https://mainnet.base.org"


class X402Details:
    """x402 payment details from the API."""

    def __init__(self, data: dict):
        self.chain = data.get("chain", "base")
        self.token = data.get("token", "USDC")
        self.amount = data.get("amount", "0")
        self.recipient = data.get("recipient", "")
        self.description = data.get("description", "")
        self.credits = data.get("credits", 0)

    def __repr__(self):
        return f"X402(amount={self.amount} USDC → {self.recipient[:10]}...)"


async def handle_payment_required(
    auto_pay: dict,
    x402: X402Details,
) -> Optional[str]:
    """Handle a 402 payment-required response.

    Returns the transaction hash if payment was made, None otherwise.
    """
    # Mode 1: Callback
    on_payment = auto_pay.get("on_payment_required")
    if on_payment:
        if callable(on_payment):
            result = on_payment(x402)
            if hasattr(result, "__await__"):
                return await result
            return result

    # Mode 2: Private key via web3.py
    private_key = auto_pay.get("private_key")
    if private_key:
        return await _send_usdc(private_key, x402, auto_pay.get("rpc_url"))

    return None


async def _send_usdc(private_key: str, x402: X402Details, rpc_url: Optional[str] = None) -> str:
    """Send USDC on Base using web3.py."""
    rpc = rpc_url or BASE_RPC

    try:
        from web3 import Web3
        from web3.middleware import SignAndSendRawMiddlewareBuilder
    except ImportError:
        raise ImportError(
            "web3.py is required for autoPay with private_key. "
            "Install it: pip install web3\n"
            "Alternatively, use on_payment_required callback instead."
        )

    w3 = Web3(Web3.HTTPProvider(rpc))
    account = w3.eth.account.from_key(private_key)

    # USDC has 6 decimal places
    amount_raw = int(float(x402.amount) * 1_000_000)

    # ERC20 transfer ABI
    transfer_abi = {
        "constant": False,
        "inputs": [
            {"name": "to", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "name": "transfer",
        "type": "function",
        "outputs": [{"name": "", "type": "bool"}],
    }

    contract = w3.eth.contract(address=Web3.to_checksum_address(USDC_CONTRACT), abi=[transfer_abi])
    tx = contract.functions.transfer(
        Web3.to_checksum_address(x402.recipient),
        amount_raw,
    ).build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "gas": 100_000,
        "gasPrice": w3.eth.gas_price,
    })

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)

    # Wait for 2 confirmations
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120, poll_latency=2)

    if receipt["status"] != 1:
        raise RuntimeError(f"USDC transfer failed: transaction reverted")

    return receipt["transactionHash"].hex()


def rpc_call(method: str, params: list) -> dict:
    """Make a JSON-RPC call to Base."""
    data = json.dumps({"jsonrpc": "2.0", "method": method, "params": params, "id": 1}).encode()
    req = Request(BASE_RPC, data=data, headers={"Content-Type": "application/json"})
    with urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())["result"]


def wait_for_confirmations(
    tx_hash: str,
    min_confirmations: int = 2,
    rpc_url: Optional[str] = None,
    max_wait_ms: int = 60_000,
) -> None:
    """Wait for a transaction to have enough confirmations."""
    rpc = rpc_url or BASE_RPC
    start = time.time() * 1000

    while (time.time() * 1000) - start < max_wait_ms:
        try:
            current_block = int(rpc_call("eth_blockNumber", []), 16)
            receipt = rpc_call("eth_getTransactionReceipt", [tx_hash])

            if receipt:
                tx_block = int(receipt["blockNumber"], 16)
                confirmations = current_block - tx_block + 1

                if confirmations >= min_confirmations:
                    return
        except Exception:
            pass

        time.sleep(2)

    raise TimeoutError(
        f"Transaction {tx_hash} did not reach {min_confirmations} confirmations"
    )
