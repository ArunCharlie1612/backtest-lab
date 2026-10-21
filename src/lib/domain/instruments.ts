import type { InstrumentSpec } from "./types";

/**
 * Reference instrument specifications. Values are industry-standard contract
 * conventions; adjust per broker when wiring real execution. Clean-room data,
 * no third-party proprietary content.
 */
export const INSTRUMENTS: Record<string, InstrumentSpec> = {
  "EURUSD": {
    symbol: "EURUSD",
    assetClass: "forex",
    pip: 0.0001,
    pricePrecision: 5,
    contractSize: 100_000,
    quoteCurrency: "USD",
    defaultSpreadPips: 0.3,
    commissionPerLot: 7,
  },
  "GBPUSD": {
    symbol: "GBPUSD",
    assetClass: "forex",
    pip: 0.0001,
    pricePrecision: 5,
    contractSize: 100_000,
    quoteCurrency: "USD",
    defaultSpreadPips: 0.5,
    commissionPerLot: 7,
  },
  "USDJPY": {
    symbol: "USDJPY",
    assetClass: "forex",
    pip: 0.01,
    pricePrecision: 3,
    contractSize: 100_000,
    quoteCurrency: "JPY",
    defaultSpreadPips: 0.4,
    commissionPerLot: 7,
  },
  "XAUUSD": {
    symbol: "XAUUSD",
    assetClass: "metal",
    pip: 0.1,
    pricePrecision: 2,
    contractSize: 100, // 100 oz per lot
    quoteCurrency: "USD",
    defaultSpreadPips: 2,
    commissionPerLot: 10,
  },
  "US100": {
    symbol: "US100",
    assetClass: "index",
    pip: 1,
    pricePrecision: 1,
    contractSize: 1,
    quoteCurrency: "USD",
    defaultSpreadPips: 1,
    commissionPerLot: 0,
  },
  "BTCUSD": {
    symbol: "BTCUSD",
    assetClass: "crypto",
    pip: 1,
    pricePrecision: 1,
    contractSize: 1,
    quoteCurrency: "USD",
    defaultSpreadPips: 5,
    commissionPerLot: 0,
  },
  "ETHUSD": {
    symbol: "ETHUSD",
    assetClass: "crypto",
    pip: 0.1,
    pricePrecision: 2,
    contractSize: 1,
    quoteCurrency: "USD",
    defaultSpreadPips: 5,
    commissionPerLot: 0,
  },
  "SOLUSD": {
    symbol: "SOLUSD",
    assetClass: "crypto",
    pip: 0.01,
    pricePrecision: 3,
    contractSize: 1,
    quoteCurrency: "USD",
    defaultSpreadPips: 5,
    commissionPerLot: 0,
  },
  "BNBUSD": {
    symbol: "BNBUSD",
    assetClass: "crypto",
    pip: 0.1,
    pricePrecision: 2,
    contractSize: 1,
    quoteCurrency: "USD",
    defaultSpreadPips: 5,
    commissionPerLot: 0,
  },
  "XRPUSD": {
    symbol: "XRPUSD",
    assetClass: "crypto",
    pip: 0.0001,
    pricePrecision: 4,
    contractSize: 1,
    quoteCurrency: "USD",
    defaultSpreadPips: 5,
    commissionPerLot: 0,
  },
};

export function getInstrument(symbol: string): InstrumentSpec {
  const spec = INSTRUMENTS[symbol];
  if (!spec) {
    throw new Error(`Unknown instrument: ${symbol}`);
  }
  return spec;
}
