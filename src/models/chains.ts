// barrel: Production chain buildings and truck cargo.
// Every 3D element lives in its own file in ./chains/ (one function per file, easy to find and improve).
export * from './chains/military';
export * from './chains/landfill';
export * from './chains/recycling';
export * from './chains/mill';
export * from './chains/millSails';
export * from './chains/bakery';
export * from './chains/sawmill';
export * from './chains/battery';
export * from './chains/kiosk';
export * from './chains/cargoOf';
export * from './chains/pigeon';
export { CARGO_KINDS } from './chains/_shared';
export type { CargoKind } from './chains/_shared';
