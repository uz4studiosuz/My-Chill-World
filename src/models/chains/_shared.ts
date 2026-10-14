// Shared colours and helpers of the chains models.
// Production-chain, service and street-life buildings, plus the cargo trucks carry. Models face +z.
export const METAL = '#5d6670';
export const PAVE = '#bdb7aa';
/** Cargo on a truck bed, by kind (the truck bed sits around y = 0.15, z = -0.08). */
export type CargoKind = 'stone' | 'logs' | 'planks' | 'grain' | 'flour' | 'bread' | 'trash' | 'veg' | 'bricks' | 'steel' | 'milk' | 'dairy' | 'cotton' | 'corn';
export const CARGO_KINDS: CargoKind[] = ['stone', 'logs', 'planks', 'grain', 'flour', 'bread', 'trash', 'veg', 'bricks', 'steel', 'milk', 'dairy', 'cotton', 'corn'];
