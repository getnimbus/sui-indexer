import { CoinBalance, SuiObjectResponse } from "@mysten/sui.js/dist/cjs/client";

export interface SuiContext {
  ownedObj: SuiObjectResponse[];
  balances: CoinBalance[];
}
export interface Protocol {
  name: string;
  logo: string;
  url: string;
}

export interface Token {
  contract_address: string;
  symbol: string;
  name?: string;
  decimals: number;
  logo: string;
  chain: string; // TODO: CHAIN
}

export interface Price {
  name: number;
  price: number;
  decimals: number;
  symbol: string;
}

type TokenWithPrice = Token & Price;

export interface TokenState {
  amount: number;
  value: number;
  token: TokenWithPrice;
}

export type TokenStateYield = TokenState & {
  claimable: boolean;
};
export interface FeeState {
  value: number;
  amount?: number;
}

export interface AMM {
  positionId: string;
  type: "AMM";
  owner: string;
  input: TokenState[];
  current: {
    tokens: TokenState[];
    yield: TokenStateYield[];
  };
  fee: FeeState;
  chain: string;
  meta: {
    protocol: Protocol;
  };
}

export interface CLMM {
  positionId: string;
  type: "CLMM";
  owner: string;
  input: TokenState[];
  yieldCollected: TokenWithPrice[];
  current: {
    tokens: TokenState[];
    currentPrice: number;
    lowerPrice: number;
    upperPrice: number;
    isInRange: boolean;
    yield: TokenStateYield[];
  };
  chain: string;
  meta: {
    protocol: Protocol;
  };
}

export interface Lending {
  positionId: string;
  type: "Lending";
  owner: string;
  input: TokenState[];
  yieldCollected: TokenState[];
  current: {
    tokens: TokenState[];
    yield: TokenStateYield[];
  };
  fee: FeeState;
  chain: string;
  meta: {
    protocol: Protocol;
  };
}

export interface Borrow {
  positionId: string;
  type: "Borrow";
  owner: string;
  input: Lending[] | TokenState[] | TokenState[];
  yieldCollected: TokenState[];
  current: {
    tokens: TokenState[];
    yield: TokenStateYield[]; // Yield negative value
    healthy?: number;
  };
  fee: FeeState;
  chain: string;
  meta: {
    protocol: Protocol;
  };
}

export interface Stake {
  positionId: string;
  type: "Stake";
  owner: string;
  input: TokenState[];
  yieldCollected: TokenState[];
  current: {
    tokens: TokenState[];
    yield: TokenStateYield[];
  };
  fee: FeeState;
  chain: string;
  meta: {
    protocol: Protocol;
  };
}

export interface Vest {
  positionId: string;
  type: "Vest";
  owner: string;
  input: {
    amount: number;
    token: TokenWithPrice;
  };
  claimed: {
    amount: number;
    token: TokenWithPrice;
  };
  current: {
    tokens: TokenState[];
    yield: TokenStateYield[];
    fee?: {
      amount: number;
      token: TokenWithPrice;
    };
    endDate: Date;
  };
  chain: string;
  meta: {
    protocol: Protocol;
  };
}

export interface Farm {
  positionId: string;
  type: "Farm";
  owner: string;
  input: AMM[] | CLMM[];
  feeCollected: {
    amount: number;
    token: TokenWithPrice;
  }[];
  current: {
    amount: number;
    token: TokenWithPrice;
    fee?: {
      amount: number;
      token: TokenWithPrice;
    };
    healthy?: number;
  };
  chain: string;
  meta: {
    protocol: Protocol;
  };
}

export interface Reward {
  positionId: string;
  type: "Reward";
  owner: string;
  feeCollected: {
    amount: number;
    token: TokenWithPrice;
  }[];
  current: {
    amount: number;
    token: TokenWithPrice;
  };
  chain: string;
  meta: {
    protocol: Protocol;
  };
}

export type Position = AMM | CLMM | Lending | Borrow | Stake | Vest | Farm;
