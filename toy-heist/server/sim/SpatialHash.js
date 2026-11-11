// Uniform-grid spatial hash on the XZ plane, used as the broad phase for
// network interest management (and later for tag / flashlight queries).
// Rebuilt from scratch every tick: with <=32 dynamic entities that is cheaper
// than tracking cell transitions, and bucket arrays are pooled so the rebuild
// allocates nothing in steady state.

export class SpatialHash {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.cells = new Map();   // packed cell key -> array of items
    this.pool = [];
  }

  cellCoord(v) { return Math.floor(v / this.cellSize); }

  // Pack two signed 16-bit cell coords into one integer key.
  key(cx, cz) { return ((cx + 0x8000) << 16) | ((cz + 0x8000) & 0xffff); }

  clear() {
    for (const bucket of this.cells.values()) { bucket.length = 0; this.pool.push(bucket); }
    this.cells.clear();
  }

  insert(item, x, z) {
    const k = this.key(this.cellCoord(x), this.cellCoord(z));
    let bucket = this.cells.get(k);
    if (!bucket) { bucket = this.pool.pop() || []; this.cells.set(k, bucket); }
    bucket.push(item);
  }

  // Calls fn(item) for everything in the (2*range+1)^2 block of cells around (x, z).
  queryCells(x, z, range, fn) {
    const cx = this.cellCoord(x), cz = this.cellCoord(z);
    for (let ix = cx - range; ix <= cx + range; ix++) {
      for (let iz = cz - range; iz <= cz + range; iz++) {
        const bucket = this.cells.get(this.key(ix, iz));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) fn(bucket[i]);
      }
    }
  }
}
