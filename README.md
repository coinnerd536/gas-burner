# gas-burner

Generate diverse on-chain activity on any EVM testnet. One command deploys a contract and fires varied transaction types — builds a rich wallet profile for airdrop farming.

## Usage

```bash
# With chain preset
npx gas-burner --chain sepolia --pk 0xYourPrivateKey

# Custom RPC
npx gas-burner --rpc https://rpc.example.com --pk 0x... --count 20

# Environment variable for key
GAS_BURNER_PK=0x... npx gas-burner --chain base-sepolia
```

## What it does

1. Deploys a multi-purpose smart contract
2. Generates N diverse transactions (default: 10):
   - `increment` — counter updates
   - `store` — arbitrary storage writes
   - `post` — on-chain message posting
   - `mint` — NFT-style minting with ownership
   - `burn` — gas-heavy loop operations
   - `self-transfer` — native token transfer

Each run creates a unique contract + varied tx history. Projects reward diverse on-chain activity over repetitive self-transfers.

## Supported Chains (10 presets)

sepolia, base-sepolia, op-sepolia, arb-sepolia, scroll-sepolia, linea-sepolia, polygon-amoy, monad, megaeth, tempo

Or use `--rpc` for any EVM chain.

## Example Output

```
gas-burner — Generating on-chain activity

  Chain:   Ethereum Sepolia
  Wallet:  0x410a...CA8
  Target:  10 transactions

  Balance: 0.94 ETH

  [1/2] Deploying Burner contract... 0x1234...5678
  [2/2] Generating 10 transactions...

    1. increment      0xabc123...  (gas: 47291)
    2. store          0xdef456...  (gas: 29443)
    3. post           0x789abc...  (gas: 73821)
    4. mint           0xcde012...  (gas: 68432)
    5. burn           0x345678...  (gas: 34221)
    6. self-transfer  0x901234...  (gas: 21000)
    ...

  Done! 10/10 transactions | 6 unique types | 384208 total gas
  Contract: 0x1234...5678
```

## Requirements

- Node.js 18+
- ethers + solc (auto-installed via npx)
- Funded wallet on target testnet

## License

MIT
