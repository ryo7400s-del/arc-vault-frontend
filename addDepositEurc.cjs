const fs = require("fs");
let code = fs.readFileSync("pages/vault.jsx", "utf8");

// EURC アドレスを追加
code = code.replace(
  `const ADDR = {
  USDC:      "0x3600000000000000000000000000000000000000",
  ARB_VAULT: "0x43b063f897c18558978739d1e5320ff4e6df58ec",
};`,
  `const ADDR = {
  USDC:      "0x3600000000000000000000000000000000000000",
  EURC:      "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  ARB_VAULT: "0x43b063f897c18558978739d1e5320ff4e6df58ec",
};`
);

// VAULT_ABI に depositEURC を追加
code = code.replace(
  `  { name: "getEURCBalance", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }] },
];`,
  `  { name: "getEURCBalance", type: "function", stateMutability: "view",
    inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "depositEURC", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "eurcAmount", type: "uint256" },{ name: "minUSDC", type: "uint256" }],
    outputs: [] },
];`
);

// ERC20_ABI に EURC の allowance/approve が使えるよう確認済み

fs.writeFileSync("pages/vault.jsx", code);
console.log("done");
