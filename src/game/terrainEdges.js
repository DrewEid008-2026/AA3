// Edge-Based Terrain & Wall State Foundation (Implementation 3.6.1)
//
// Core Architectural Principle:
//   Floor lives on tiles.
//   Walls / cover live on EDGES between tiles.
//
// A physical edge between two adjacent tiles is represented by:
//   ONE SHARED TERRAIN EDGE OBJECT.
//
// Tile A (East) and Tile B (West) both reference the exact same edge ID and state.
// Both sides resolve to the same source of truth.

export const EDGE_TYPES = {
  OPEN: 'OPEN',
  LOW_WALL: 'LOW_WALL',
  FULL_WALL: 'FULL_WALL',
  SIEGE_STRUCTURE: 'SIEGE_STRUCTURE',
};

export const WALL_STATES = {
  FULL: 'FULL',
  LOW: 'LOW',
  OPEN: 'OPEN',
};

export const EDGE_DESTRUCTION_CLASSES = {
  NORMAL: 'NORMAL',
  SIEGE_ONLY: 'SIEGE_ONLY',
};

export const EDGE_ORIENTATIONS = {
  HORIZONTAL: 'horizontal',
  VERTICAL: 'vertical',
};

// Centralized wall material tier configuration.
// Architectural support for future Tier 2 (Reinforced Wall) and Tier 3 (Alien Material Wall),
// but ONLY Tier 1 is populated with production stats in this phase.
export const WALL_TIERS = {
  1: {
    tier: 1,
    id: 'wall',
    displayName: 'Wall',
    maxHP: 8,
    fullThresholdMin: 5, // HP 8–5: FULL WALL
    lowThresholdMin: 1,  // HP 4–1: LOW WALL
    openThresholdMax: 0, // HP 0: OPEN
  },
  // Tier 2 & Tier 3 will be defined in later phases.
};

// Pub/Sub listeners for terrain edge state changes (e.g. FULL -> LOW, LOW -> OPEN).
const stateChangeListeners = new Set();

export function onTerrainEdgeStateChange(listener) {
  stateChangeListeners.add(listener);
  return () => stateChangeListeners.delete(listener);
}

export function emitTerrainEdgeStateChange(event) {
  for (const listener of stateChangeListeners) {
    try {
      listener(event);
    } catch (err) {
      console.error('[TerrainEdge] Error in state change listener:', err);
    }
  }
}

// Canonical edge ID generator for a tile and direction.
//
// Direction conventions:
//   'n': Horizontal edge separating (x, y-1) and (x, y) -> 'h:x:y-1'
//   's': Horizontal edge separating (x, y) and (x, y+1) -> 'h:x:y'
//   'w': Vertical edge separating (x-1, y) and (x, y)   -> 'v:x-1:y'
//   'e': Vertical edge separating (x, y) and (x+1, y)   -> 'v:x:y'
export function getTileEdgeId(x, y, dir) {
  switch (dir) {
    case 'n':
      return `h:${x}:${y - 1}`;
    case 's':
      return `h:${x}:${y}`;
    case 'w':
      return `v:${x - 1}:${y}`;
    case 'e':
      return `v:${x}:${y}`;
    default:
      throw new Error(`Invalid edge direction: ${dir}`);
  }
}

// Canonical edge ID between two adjacent tiles (order independent).
export function getEdgeIdBetweenTiles(tileA, tileB) {
  if (!tileA || !tileB) return null;
  const dx = tileB.x - tileA.x;
  const dy = tileB.y - tileA.y;

  // Cardinal horizontal neighbors
  if (dy === 0) {
    if (dx === 1) return getTileEdgeId(tileA.x, tileA.y, 'e'); // tileA East === tileB West
    if (dx === -1) return getTileEdgeId(tileA.x, tileA.y, 'w'); // tileA West === tileB East
  }

  // Cardinal vertical neighbors
  if (dx === 0) {
    if (dy === 1) return getTileEdgeId(tileA.x, tileA.y, 's'); // tileA South === tileB North
    if (dy === -1) return getTileEdgeId(tileA.x, tileA.y, 'n'); // tileA North === tileB South
  }

  return null;
}

// Authoritative function for evaluating wall state from current HP.
// Tier 1 transition model:
//   HP 8–5: FULL WALL
//   HP 4–1: LOW WALL
//   HP 0:   OPEN
export function getWallState(currentHP, maxHP = 8, wallTier = 1) {
  const hp = Math.max(0, currentHP ?? 0);
  if (hp <= 0) return WALL_STATES.OPEN;

  const tierConfig = WALL_TIERS[wallTier];
  if (tierConfig) {
    if (hp >= tierConfig.fullThresholdMin) return WALL_STATES.FULL;
    if (hp >= tierConfig.lowThresholdMin) return WALL_STATES.LOW;
    return WALL_STATES.OPEN;
  }

  // Fallback Tier 1
  if (hp >= 5) return WALL_STATES.FULL;
  if (hp >= 1) return WALL_STATES.LOW;
  return WALL_STATES.OPEN;
}

// Create a canonical TerrainEdge object.
export function createTerrainEdge({
  id,
  tileA,
  tileB = null,
  orientation,
  edgeType = EDGE_TYPES.OPEN,
  wallTier = 1,
  maxHP = null,
  currentHP = null,
  state = null,
  destructionClass = EDGE_DESTRUCTION_CLASSES.NORMAL,
}) {
  let resolvedMaxHP = maxHP;
  let resolvedCurrentHP = currentHP;
  let resolvedState = state;
  let resolvedDestructionClass = destructionClass;

  if (edgeType === EDGE_TYPES.FULL_WALL) {
    const tierConfig = WALL_TIERS[wallTier] || WALL_TIERS[1];
    if (resolvedMaxHP == null) resolvedMaxHP = tierConfig.maxHP;
    if (resolvedCurrentHP == null) resolvedCurrentHP = resolvedMaxHP;
    if (!resolvedState) resolvedState = getWallState(resolvedCurrentHP, resolvedMaxHP, wallTier);
    resolvedDestructionClass = EDGE_DESTRUCTION_CLASSES.NORMAL;
  } else if (edgeType === EDGE_TYPES.LOW_WALL) {
    if (resolvedMaxHP == null) resolvedMaxHP = 4;
    if (resolvedCurrentHP == null) resolvedCurrentHP = resolvedMaxHP;
    if (!resolvedState) resolvedState = WALL_STATES.LOW;
    resolvedDestructionClass = EDGE_DESTRUCTION_CLASSES.NORMAL;
  } else if (edgeType === EDGE_TYPES.SIEGE_STRUCTURE) {
    resolvedMaxHP = null;
    resolvedCurrentHP = null;
    resolvedState = WALL_STATES.FULL;
    resolvedDestructionClass = EDGE_DESTRUCTION_CLASSES.SIEGE_ONLY;
  } else {
    // OPEN
    resolvedMaxHP = 0;
    resolvedCurrentHP = 0;
    resolvedState = WALL_STATES.OPEN;
    resolvedDestructionClass = EDGE_DESTRUCTION_CLASSES.NORMAL;
  }

  return {
    id,
    tileA: { x: tileA.x, y: tileA.y },
    tileB: tileB ? { x: tileB.x, y: tileB.y } : null,
    orientation: orientation || (id.startsWith('h') ? EDGE_ORIENTATIONS.HORIZONTAL : EDGE_ORIENTATIONS.VERTICAL),
    edgeType,
    wallTier,
    maxHP: resolvedMaxHP,
    currentHP: resolvedCurrentHP,
    state: resolvedState,
    destructionClass: resolvedDestructionClass,
  };
}

// Authoritative wall damage entry point.
// Responsibilities:
//   1. Validate edge is damageable
//   2. Reduce HP
//   3. Clamp HP >= 0
//   4. Recalculate wall state
//   5. Emit terrain-state-change event if state changes
//   6. Return updated authoritative state
export function applyTerrainDamage(edges, edgeId, amount, source = null) {
  if (!edges || !edgeId || amount <= 0) {
    return { edges, edge: null, damageApplied: 0, stateChanged: false };
  }

  const edge = edges[edgeId] || (edges instanceof Map ? edges.get(edgeId) : null);
  if (!edge) {
    return { edges, edge: null, damageApplied: 0, stateChanged: false };
  }

  // Edge is already open — cannot damage further
  if (edge.edgeType === EDGE_TYPES.OPEN || edge.state === WALL_STATES.OPEN) {
    return { edges, edge, damageApplied: 0, stateChanged: false };
  }

  // Siege structure immunity: normal damage cannot destroy it; only explicit SIEGE effects
  if (edge.edgeType === EDGE_TYPES.SIEGE_STRUCTURE || edge.destructionClass === EDGE_DESTRUCTION_CLASSES.SIEGE_ONLY) {
    const isSiege = source?.canDestroySiege || source?.tileDestructionClass === 'siege' || source?.isSiege;
    if (!isSiege) {
      return { edges, edge, damageApplied: 0, stateChanged: false, reason: 'IMMUNE_NON_SIEGE' };
    }
  }

  const prevHP = edge.currentHP ?? 0;
  const newHP = Math.max(0, prevHP - amount);
  const damageApplied = prevHP - newHP;
  const prevState = edge.state;
  const newState = getWallState(newHP, edge.maxHP, edge.wallTier);
  const stateChanged = prevState !== newState;

  const updatedEdge = {
    ...edge,
    currentHP: newHP,
    state: newState,
  };

  let updatedEdges;
  if (edges instanceof Map) {
    updatedEdges = new Map(edges);
    updatedEdges.set(edgeId, updatedEdge);
  } else {
    updatedEdges = {
      ...edges,
      [edgeId]: updatedEdge,
    };
  }

  const event = {
    type: 'TERRAIN_EDGE_STATE_CHANGE',
    edgeId,
    previousState: prevState,
    newState,
    edge: updatedEdge,
    source,
    damageApplied,
  };

  if (stateChanged) {
    emitTerrainEdgeStateChange(event);
  }

  return {
    edges: updatedEdges,
    edge: updatedEdge,
    damageApplied,
    stateChanged,
    previousState: prevState,
    newState,
    event: stateChanged ? event : null,
  };
}

// Movement crossing query helper.
// Expected behavior:
//   OPEN: crossable (true)
//   LOW_WALL: crossable (true)
//   FULL_WALL: not crossable (false)
//   SIEGE_STRUCTURE: not crossable (false)
export function canCrossEdge(edge) {
  if (!edge) return true;
  if (edge.edgeType === EDGE_TYPES.OPEN || edge.state === WALL_STATES.OPEN) return true;
  if (edge.edgeType === EDGE_TYPES.LOW_WALL || edge.state === WALL_STATES.LOW) return true;
  if (edge.edgeType === EDGE_TYPES.FULL_WALL && edge.state === WALL_STATES.FULL) return false;
  if (edge.edgeType === EDGE_TYPES.SIEGE_STRUCTURE) return false;
  return false;
}

// Visual LOS query helper.
// Expected behavior:
//   OPEN: LOS passes (false = does not block)
//   LOW_WALL: LOS passes (false = does not block)
//   FULL_WALL: visual LOS blocked (true = blocks)
//   SIEGE_STRUCTURE: visual LOS blocked (true = blocks)
export function doesEdgeBlockVisualLOS(edge) {
  if (!edge) return false;
  if (edge.edgeType === EDGE_TYPES.OPEN || edge.state === WALL_STATES.OPEN) return false;
  if (edge.edgeType === EDGE_TYPES.LOW_WALL || edge.state === WALL_STATES.LOW) return false;
  if (edge.edgeType === EDGE_TYPES.FULL_WALL && edge.state === WALL_STATES.FULL) return true;
  if (edge.edgeType === EDGE_TYPES.SIEGE_STRUCTURE) return true;
  return false;
}

// Lookup edge between two adjacent tiles
export function getEdgeBetweenTiles(tileA, tileB, edges) {
  if (!edges || !tileA || !tileB) return null;
  const edgeId = getEdgeIdBetweenTiles(tileA, tileB);
  if (!edgeId) return null;
  return edges[edgeId] || (edges instanceof Map ? edges.get(edgeId) : null) || null;
}

// High-performance direct getter by ID
export function getEdge(edges, edgeId) {
  if (!edges || !edgeId) return null;
  return edges[edgeId] || (edges instanceof Map ? edges.get(edgeId) : null) || null;
}

// Get all 4 edges of a tile
export function getTileEdges(edges, x, y) {
  if (!edges) return { n: null, s: null, e: null, w: null };
  return {
    n: getEdge(edges, getTileEdgeId(x, y, 'n')),
    s: getEdge(edges, getTileEdgeId(x, y, 's')),
    e: getEdge(edges, getTileEdgeId(x, y, 'e')),
    w: getEdge(edges, getTileEdgeId(x, y, 'w')),
  };
}

// Deep clone edges collection (for clean restart / initial state separation)
export function cloneEdges(edges) {
  if (!edges) return {};
  if (edges instanceof Map) {
    const cloned = new Map();
    for (const [k, v] of edges.entries()) {
      cloned.set(k, { ...v, tileA: { ...v.tileA }, tileB: v.tileB ? { ...v.tileB } : null });
    }
    return cloned;
  }
  const cloned = {};
  for (const [k, v] of Object.entries(edges)) {
    if (v) {
      cloned[k] = { ...v, tileA: { ...v.tileA }, tileB: v.tileB ? { ...v.tileB } : null };
    }
  }
  return cloned;
}

// Serialization & Deserialization Foundation (for save/load)
export function serializeEdges(edges) {
  if (!edges) return [];
  const list = edges instanceof Map ? Array.from(edges.values()) : Object.values(edges);
  return list.map((edge) => ({
    id: edge.id,
    tileA: { x: edge.tileA.x, y: edge.tileA.y },
    tileB: edge.tileB ? { x: edge.tileB.x, y: edge.tileB.y } : null,
    orientation: edge.orientation,
    edgeType: edge.edgeType,
    wallTier: edge.wallTier,
    maxHP: edge.maxHP,
    currentHP: edge.currentHP,
    state: edge.state,
    destructionClass: edge.destructionClass,
  }));
}

export function deserializeEdges(serializedList) {
  const edges = {};
  if (!Array.isArray(serializedList)) return edges;
  for (const item of serializedList) {
    if (!item || !item.id) continue;
    edges[item.id] = createTerrainEdge(item);
  }
  return edges;
}

// --- Future Combat Support Stubs (Contracts established for Phase 3.6.2+) ---

// Get all edges intersecting a line from shooter to target
export function getEdgesIntersectingShot(shooter, target, edges) {
  if (!edges || !shooter || !target) return [];
  // Bresenham-traversed edge lookup stub
  const intersected = [];
  let currX = shooter.x;
  let currY = shooter.y;
  const dx = Math.sign(target.x - shooter.x);
  const dy = Math.sign(target.y - shooter.y);

  while (currX !== target.x || currY !== target.y) {
    const nextX = currX + (currX !== target.x ? dx : 0);
    const nextY = currY + (currY !== target.y ? dy : 0);
    const edge = getEdgeBetweenTiles({ x: currX, y: currY }, { x: nextX, y: nextY }, edges);
    if (edge) intersected.push(edge);
    currX = nextX;
    currY = nextY;
  }
  return intersected;
}

// Get the first FULL_WALL blocking projectile path
export function getFirstFullWallOnProjectilePath(shooter, target, edges) {
  const edgesAlongPath = getEdgesIntersectingShot(shooter, target, edges);
  return edgesAlongPath.find((e) => e.edgeType === EDGE_TYPES.FULL_WALL && e.state === WALL_STATES.FULL) || null;
}

// Get adjacent low wall providing directional cover to a target
export function getTargetAdjacentLowWall(target, shooterDir, edges) {
  if (!edges || !target || !shooterDir) return null;
  const edgeId = getTileEdgeId(target.x, target.y, shooterDir);
  const edge = getEdge(edges, edgeId);
  if (edge && (edge.edgeType === EDGE_TYPES.LOW_WALL || edge.state === WALL_STATES.LOW)) {
    return edge;
  }
  return null;
}

// Future terrain protection multiplier stub
export function getTerrainProtectionMultiplier(edge) {
  if (!edge || edge.state === WALL_STATES.OPEN) return 1.0;
  if (edge.state === WALL_STATES.LOW) return 0.5; // Future 50% cover
  if (edge.state === WALL_STATES.FULL) return 0.25; // Future 75% cover
  return 1.0;
}

// Get all wall edges inside an explosion radius
export function getWallsInsideExplosionArea(center, radius, edges) {
  if (!edges || !center) return [];
  const results = [];
  const allEdges = edges instanceof Map ? Array.from(edges.values()) : Object.values(edges);
  for (const edge of allEdges) {
    const distA = Math.max(Math.abs(edge.tileA.x - center.x), Math.abs(edge.tileA.y - center.y));
    const distB = edge.tileB ? Math.max(Math.abs(edge.tileB.x - center.x), Math.abs(edge.tileB.y - center.y)) : distA;
    if (Math.min(distA, distB) <= radius) {
      results.push(edge);
    }
  }
  return results;
}
