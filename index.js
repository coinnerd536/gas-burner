#!/usr/bin/env node
/**
 * gas-burner — Generate diverse on-chain activity on any EVM testnet
 *
 * Deploys a mini multi-purpose contract, then fires varied tx types:
 * deploys, transfers, approvals, storage writes, event emissions, mints.
 * Builds a rich wallet profile for testnet airdrop farming.
 *
 * Usage:
 *   npx gas-burner --chain sepolia --pk 0x...
 *   npx gas-burner --rpc https://rpc.example.com --pk 0x...
 *   npx gas-burner --chain base-sepolia --pk 0x... --count 20
 *   GAS_BURNER_PK=0x... npx gas-burner --chain sepolia
 */

const CHAINS = {
  'sepolia':        { rpc: 'https://ethereum-sepolia-rpc.publicnode.com', name: 'Ethereum Sepolia' },
  'base-sepolia':   { rpc: 'https://sepolia.base.org', name: 'Base Sepolia' },
  'op-sepolia':     { rpc: 'https://sepolia.optimism.io', name: 'Optimism Sepolia' },
  'arb-sepolia':    { rpc: 'https://sepolia-rollup.arbitrum.io/rpc', name: 'Arbitrum Sepolia' },
  'scroll-sepolia': { rpc: 'https://sepolia-rpc.scroll.io', name: 'Scroll Sepolia' },
  'linea-sepolia':  { rpc: 'https://rpc.sepolia.linea.build', name: 'Linea Sepolia' },
  'polygon-amoy':   { rpc: 'https://rpc-amoy.polygon.technology', name: 'Polygon Amoy' },
  'monad':          { rpc: 'https://testnet-rpc.monad.xyz', name: 'Monad Testnet' },
  'megaeth':        { rpc: 'https://carrot.megaeth.com/rpc', name: 'MegaETH Testnet' },
  'tempo':          { rpc: 'https://rpc.moderato.tempo.xyz', name: 'Tempo Testnet' },
  'unichain':       { rpc: 'https://sepolia.unichain.org', name: 'Unichain Sepolia' },
  'soneium':        { rpc: 'https://rpc.minato.soneium.org', name: 'Soneium Minato' },
  'ink':            { rpc: 'https://rpc-gel-sepolia.inkonchain.com', name: 'Ink Sepolia' },
};

// Minimal multi-purpose contract — handles storage, events, minting, messaging
// Compiled bytecode for this Solidity contract:
//   contract Burner {
//     uint256 public counter;
//     string[] public messages;
//     mapping(uint256 => address) public owners;
//     event Action(address indexed user, string action, uint256 value);
//     event Mint(address indexed to, uint256 id);
//     function increment() external { counter++; emit Action(msg.sender, "increment", counter); }
//     function store(uint256 val) external { counter = val; emit Action(msg.sender, "store", val); }
//     function post(string calldata msg_) external { messages.push(msg_); emit Action(msg.sender, "post", messages.length); }
//     function mint() external { uint256 id = counter++; owners[id] = msg.sender; emit Mint(msg.sender, id); }
//     function burn(uint256 n) external { for(uint256 i=0; i<n; i++) counter++; emit Action(msg.sender, "burn", n); }
//   }
const BURNER_ABI = [
  'function increment() external',
  'function store(uint256 val) external',
  'function post(string msg_) external',
  'function mint() external',
  'function burn(uint256 n) external',
  'function counter() view returns (uint256)',
  'event Action(address indexed user, string action, uint256 value)',
  'event Mint(address indexed to, uint256 id)',
];

// Solidity source for compilation
const BURNER_SOL = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract Burner {
    uint256 public counter;
    string[] public messages;
    mapping(uint256 => address) public owners;
    event Action(address indexed user, string action, uint256 value);
    event Mint(address indexed to, uint256 id);
    function increment() external { counter++; emit Action(msg.sender, "increment", counter); }
    function store(uint256 val) external { counter = val; emit Action(msg.sender, "store", val); }
    function post(string calldata msg_) external { messages.push(msg_); emit Action(msg.sender, "post", messages.length); }
    function mint() external { uint256 id = counter++; owners[id] = msg.sender; emit Mint(msg.sender, id); }
    function burn(uint256 n) external { for(uint256 i=0; i<n; i++) counter++; emit Action(msg.sender, "burn", n); }
}`;

function usage() {
  console.log(`
\x1b[1mgas-burner\x1b[0m — Generate diverse on-chain activity on any EVM testnet

Usage:
  gas-burner --chain <preset> --pk <private-key>
  gas-burner --rpc <url> --pk <private-key> [--count N]

Options:
  --chain <name>   Chain preset (${Object.keys(CHAINS).join(', ')})
  --rpc <url>      Custom RPC URL (overrides --chain)
  --pk <key>       Private key (or set GAS_BURNER_PK env var)
  --count <N>      Number of transactions to generate (default: 10)
  --json           JSON output

Environment:
  GAS_BURNER_PK    Private key

Examples:
  gas-burner --chain sepolia --pk 0xabc...
  GAS_BURNER_PK=0xabc... gas-burner --chain base-sepolia --count 20
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    usage();
    process.exit(0);
  }

  const get = (flag) => { const i = args.indexOf(flag); return i >= 0 && i + 1 < args.length ? args[i + 1] : null; };
  const chain = get('--chain');
  const rpc = get('--rpc') || (chain && CHAINS[chain] ? CHAINS[chain].rpc : null);
  const pk = get('--pk') || process.env.GAS_BURNER_PK;
  const count = parseInt(get('--count') || '10', 10);
  const json = args.includes('--json');
  const name = chain && CHAINS[chain] ? CHAINS[chain].name : (rpc || 'Unknown');

  if (!rpc) { console.error('Error: --chain or --rpc required. Use --help for presets.'); process.exit(1); }
  if (!pk) { console.error('Error: --pk or GAS_BURNER_PK required.'); process.exit(1); }

  return { rpc, pk, count, json, name };
}

async function main() {
  const { rpc, pk, count, json, name } = parseArgs();

  // Dynamic import ethers
  let ethers;
  try { ethers = require('ethers'); } catch { console.error('Error: ethers required. Run: npm install ethers'); process.exit(1); }

  // Dynamic import solc
  let solc;
  try { solc = require('solc'); } catch { console.error('Error: solc required. Run: npm install solc'); process.exit(1); }

  const provider = new ethers.JsonRpcProvider(rpc, undefined, { staticNetwork: true });
  const signer = new ethers.Wallet(pk, provider);
  const address = signer.address;

  if (!json) {
    console.log(`\n\x1b[1mgas-burner\x1b[0m — Generating on-chain activity\n`);
    console.log(`  Chain:   ${name}`);
    console.log(`  Wallet:  ${address}`);
    console.log(`  Target:  ${count} transactions\n`);
  }

  // Check balance
  const balance = await provider.getBalance(address);
  if (balance === 0n) {
    console.error('Error: Zero balance. Fund your wallet first.');
    process.exit(1);
  }
  if (!json) console.log(`  Balance: ${ethers.formatEther(balance)} ETH\n`);

  // Compile and deploy Burner contract
  if (!json) process.stdout.write('  [1/2] Deploying Burner contract... ');
  const input = {
    language: 'Solidity',
    sources: { 'Burner.sol': { content: BURNER_SOL } },
    settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } } },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const compiled = output.contracts['Burner.sol']['Burner'];
  const factory = new ethers.ContractFactory(compiled.abi, compiled.evm.bytecode.object, signer);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const contractAddr = await contract.getAddress();
  if (!json) console.log(`\x1b[32m${contractAddr}\x1b[0m`);

  // Generate diverse transactions
  if (!json) console.log(`  [2/2] Generating ${count} transactions...\n`);

  const txTypes = [
    { name: 'increment', fn: () => contract.increment() },
    { name: 'store',     fn: () => contract.store(Math.floor(Math.random() * 1000000)) },
    { name: 'post',      fn: () => contract.post(`[${new Date().toISOString().slice(0,16)}] gas-burner tx #${Math.floor(Math.random()*9999)}`) },
    { name: 'mint',      fn: () => contract.mint() },
    { name: 'burn',      fn: () => contract.burn(Math.floor(Math.random() * 5) + 1) },
    { name: 'self-transfer', fn: () => signer.sendTransaction({ to: address, value: 0 }) },
  ];

  const results = [];
  for (let i = 0; i < count; i++) {
    const txType = txTypes[i % txTypes.length];
    try {
      const tx = await txType.fn();
      const receipt = await tx.wait();
      results.push({ index: i + 1, type: txType.name, hash: tx.hash, gas: receipt.gasUsed.toString(), status: 'ok' });
      if (!json) {
        const idx = String(i + 1).padStart(3);
        console.log(`  ${idx}. \x1b[32m${txType.name.padEnd(14)}\x1b[0m ${tx.hash.slice(0, 14)}... (gas: ${receipt.gasUsed})`);
      }
    } catch (err) {
      results.push({ index: i + 1, type: txType.name, error: err.message.slice(0, 80), status: 'error' });
      if (!json) {
        const idx = String(i + 1).padStart(3);
        console.log(`  ${idx}. \x1b[31m${txType.name.padEnd(14)}\x1b[0m error: ${err.message.slice(0, 60)}`);
      }
    }
  }

  const succeeded = results.filter(r => r.status === 'ok').length;
  const failed = results.filter(r => r.status === 'error').length;
  const totalGas = results.filter(r => r.status === 'ok').reduce((sum, r) => sum + BigInt(r.gas), 0n);
  const uniqueTypes = new Set(results.filter(r => r.status === 'ok').map(r => r.type)).size;

  if (json) {
    console.log(JSON.stringify({ chain: name, wallet: address, contract: contractAddr, transactions: results, summary: { total: count, succeeded, failed, uniqueTypes, totalGas: totalGas.toString() } }, null, 2));
  } else {
    console.log(`\n  \x1b[1mDone!\x1b[0m ${succeeded}/${count} transactions | ${uniqueTypes} unique types | ${totalGas} total gas`);
    if (failed > 0) console.log(`  \x1b[33m${failed} failed\x1b[0m`);
    console.log(`  Contract: ${contractAddr}\n`);
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
