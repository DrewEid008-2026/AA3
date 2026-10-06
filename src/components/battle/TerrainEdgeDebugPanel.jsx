import React, { useState } from 'react';
import {
  EDGE_TYPES,
  WALL_STATES,
  createTerrainEdge,
  applyTerrainDamage,
} from '@/game/terrainEdges';

export default function TerrainEdgeDebugPanel({
  debug,
  edges,
  setEdges,
  selectedEdgeId,
  setSelectedEdgeId,
}) {
  const [testLog, setTestLog] = useState([]);
  const [newWallCoord, setNewWallCoord] = useState('3,4,e');

  if (!debug) return null;

  const edgeList = edges instanceof Map ? Array.from(edges.values()) : Object.values(edges || {});
  const activeEdge = edges ? (edges[selectedEdgeId] || (edges instanceof Map ? edges.get(selectedEdgeId) : null)) : null;

  const handleApplyDamage = (amount) => {
    if (!activeEdge) return;
    const res = applyTerrainDamage(edges, activeEdge.id, amount, { source: 'debug_tool' });
    setEdges(res.edges);
    setTestLog((prev) => [
      `Dmg -${amount} -> HP ${res.edge.currentHP}/${res.edge.maxHP} [State: ${res.edge.state}]`,
      ...prev.slice(0, 5),
    ]);
  };

  const handleDestroy = () => {
    if (!activeEdge) return;
    const res = applyTerrainDamage(edges, activeEdge.id, activeEdge.currentHP || 8, {
      canDestroySiege: true,
      tileDestructionClass: 'siege',
      source: 'debug_destroy',
    });
    setEdges(res.edges);
    setTestLog((prev) => [
      `Destroyed -> HP 0/${res.edge.maxHP} [State: ${res.edge.state}]`,
      ...prev.slice(0, 5),
    ]);
  };

  // Run the full Section 29 state transition test on active or new edge:
  // Start 8 HP FULL -> Apply 3 (5 HP FULL) -> Apply 1 (4 HP LOW) -> Apply 4 (0 HP OPEN)
  const handleRunTransitionTest = () => {
    let targetId = selectedEdgeId;
    let currentEdges = edges || {};

    if (!targetId || !activeEdge) {
      // Create a test edge at (3, 4) East
      const testEdge = createTerrainEdge({
        id: 'v:3:4',
        tileA: { x: 3, y: 4 },
        tileB: { x: 4, y: 4 },
        orientation: 'vertical',
        edgeType: EDGE_TYPES.FULL_WALL,
        wallTier: 1,
      });
      currentEdges = { ...currentEdges, [testEdge.id]: testEdge };
      targetId = testEdge.id;
    }

    // Step 1: Start 8 HP FULL
    let log = [];
    let stateEdges = currentEdges;

    // Reset to 8 HP Full Wall first
    const resetEdge = createTerrainEdge({
      id: targetId,
      tileA: { x: 3, y: 4 },
      tileB: { x: 4, y: 4 },
      orientation: 'vertical',
      edgeType: EDGE_TYPES.FULL_WALL,
      wallTier: 1,
    });
    stateEdges = { ...stateEdges, [targetId]: resetEdge };
    log.push(`1. Start: ${resetEdge.currentHP} HP [${resetEdge.state}]`);

    // Step 2: Apply 3 -> 5 HP FULL
    const res1 = applyTerrainDamage(stateEdges, targetId, 3, { source: 'test' });
    stateEdges = res1.edges;
    log.push(`2. Apply 3 dmg: ${res1.edge.currentHP} HP [${res1.edge.state}] - ${res1.edge.state === 'FULL' ? 'PASS' : 'FAIL'}`);

    // Step 3: Apply 1 -> 4 HP LOW
    const res2 = applyTerrainDamage(stateEdges, targetId, 1, { source: 'test' });
    stateEdges = res2.edges;
    log.push(`3. Apply 1 dmg: ${res2.edge.currentHP} HP [${res2.edge.state}] - ${res2.edge.state === 'LOW' ? 'PASS' : 'FAIL'}`);

    // Step 4: Apply 4 -> 0 HP OPEN
    const res3 = applyTerrainDamage(stateEdges, targetId, 4, { source: 'test' });
    stateEdges = res3.edges;
    log.push(`4. Apply 4 dmg: ${res3.edge.currentHP} HP [${res3.edge.state}] - ${res3.edge.state === 'OPEN' ? 'PASS' : 'FAIL'}`);

    setEdges(stateEdges);
    setSelectedEdgeId(targetId);
    setTestLog(log);
  };

  const handleSpawnEdge = (type) => {
    const parts = newWallCoord.split(',');
    const x = parseInt(parts[0], 10) || 3;
    const y = parseInt(parts[1], 10) || 4;
    const dir = parts[2]?.trim() || 'e';
    const isHoriz = dir === 'n' || dir === 's';

    let id, tileA, tileB;
    if (dir === 'e') {
      id = `v:${x}:${y}`;
      tileA = { x, y };
      tileB = { x: x + 1, y };
    } else if (dir === 'w') {
      id = `v:${x - 1}:${y}`;
      tileA = { x: x - 1, y };
      tileB = { x, y };
    } else if (dir === 's') {
      id = `h:${x}:${y}`;
      tileA = { x, y };
      tileB = { x, y: y + 1 };
    } else {
      id = `h:${x}:${y - 1}`;
      tileA = { x, y: y - 1 };
      tileB = { x, y };
    }

    const newEdge = createTerrainEdge({
      id,
      tileA,
      tileB,
      orientation: isHoriz ? 'horizontal' : 'vertical',
      edgeType: type,
      wallTier: 1,
    });

    setEdges({ ...(edges || {}), [id]: newEdge });
    setSelectedEdgeId(id);
    setTestLog([`Created ${type} at ${id}`, ...testLog]);
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 mt-2 space-y-2">
      <div className="flex items-center justify-between border-b border-slate-700 pb-1 font-bold text-amber-400 uppercase tracking-wider">
        <span>Terrain Edge Debug (3.6.1)</span>
        <span className="text-[10px] text-slate-400 font-mono">{edgeList.length} edges</span>
      </div>

      {/* Selected Edge Info (Section 27) */}
      {activeEdge ? (
        <div className="bg-slate-950/80 p-2 rounded border border-slate-800 space-y-1">
          <div className="flex justify-between items-center font-mono">
            <span className="text-amber-300 font-bold">EDGE ID: {activeEdge.id}</span>
            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
              {activeEdge.orientation}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[11px]">
            <div>
              <span className="text-slate-400">Type:</span> <span className="font-semibold text-white">{activeEdge.edgeType}</span>
            </div>
            <div>
              <span className="text-slate-400">Tier:</span> <span className="font-semibold text-white">Tier {activeEdge.wallTier}</span>
            </div>
            <div>
              <span className="text-slate-400">HP:</span>{' '}
              <span className="font-semibold text-white">
                {activeEdge.currentHP != null ? `${activeEdge.currentHP} / ${activeEdge.maxHP}` : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-400">State:</span>{' '}
              <span
                className={`font-bold uppercase ${
                  activeEdge.state === WALL_STATES.FULL
                    ? 'text-emerald-400'
                    : activeEdge.state === WALL_STATES.LOW
                      ? 'text-amber-400'
                      : 'text-slate-500'
                }`}
              >
                {activeEdge.state}
              </span>
            </div>
          </div>

          {/* Debug Damage Actions (Section 28) */}
          <div className="pt-1.5 flex gap-1 items-center">
            <span className="text-[10px] text-slate-400 mr-1">Damage:</span>
            <button
              type="button"
              onClick={() => handleApplyDamage(1)}
              className="px-2 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700 font-bold active:scale-95 transition"
            >
              -1
            </button>
            <button
              type="button"
              onClick={() => handleApplyDamage(2)}
              className="px-2 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700 font-bold active:scale-95 transition"
            >
              -2
            </button>
            <button
              type="button"
              onClick={() => handleApplyDamage(4)}
              className="px-2 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700 font-bold active:scale-95 transition"
            >
              -4
            </button>
            <button
              type="button"
              onClick={handleDestroy}
              className="px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-white font-bold active:scale-95 transition"
            >
              Destroy
            </button>
          </div>
        </div>
      ) : (
        <div className="text-slate-400 text-[11px] italic bg-slate-950/40 p-2 rounded border border-slate-800">
          No edge selected. Select from below or spawn one to test.
        </div>
      )}

      {/* State Transition Sequence Test (Section 29) */}
      <div className="flex gap-2 items-center pt-1">
        <button
          type="button"
          onClick={handleRunTransitionTest}
          className="flex-1 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 font-bold active:scale-95 transition text-[11px]"
        >
          Run State Transition Test (8→5→4→0)
        </button>
      </div>

      {/* Spawn Edge Controls */}
      <div className="flex gap-1.5 items-center pt-1 text-[11px]">
        <input
          type="text"
          value={newWallCoord}
          onChange={(e) => setNewWallCoord(e.target.value)}
          placeholder="x,y,dir (e.g. 3,4,e)"
          className="w-20 px-1.5 py-1 rounded bg-slate-950 border border-slate-700 font-mono text-[10px]"
        />
        <button
          type="button"
          onClick={() => handleSpawnEdge(EDGE_TYPES.FULL_WALL)}
          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-medium active:scale-95"
        >
          + Full Wall
        </button>
        <button
          type="button"
          onClick={() => handleSpawnEdge(EDGE_TYPES.LOW_WALL)}
          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-medium active:scale-95"
        >
          + Low Wall
        </button>
        <button
          type="button"
          onClick={() => handleSpawnEdge(EDGE_TYPES.SIEGE_STRUCTURE)}
          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-medium active:scale-95"
        >
          + Siege
        </button>
      </div>

      {/* Edge Selector Dropdown if multiple edges exist */}
      {edgeList.length > 0 && (
        <div className="flex items-center gap-2 pt-1 text-[11px]">
          <span className="text-slate-400">Select:</span>
          <select
            value={selectedEdgeId || ''}
            onChange={(e) => setSelectedEdgeId(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-slate-200 font-mono text-[10px]"
          >
            <option value="">-- Choose Edge --</option>
            {edgeList.map((e) => (
              <option key={e.id} value={e.id}>
                {e.id} · {e.edgeType} · HP {e.currentHP != null ? e.currentHP : 'SIEGE'} [{e.state}]
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Test Log */}
      {testLog.length > 0 && (
        <div className="bg-black/50 p-1.5 rounded font-mono text-[9px] text-emerald-400/90 space-y-0.5 max-h-24 overflow-y-auto border border-slate-800">
          {testLog.map((log, idx) => (
            <div key={idx}>{log}</div>
          ))}
        </div>
      )}
    </div>
  );
}
