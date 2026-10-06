// Debug panel for the Chapter enemy spawn-weight framework
// (chapterEnemyPools.js). Dev-only — accessed via the debug overlay.
//
// Exposes:
//   - Chapter candidate weight inspection (spec 24)
//   - Sample composition generation with debug overrides (spec 23)
//   - Distribution simulation (100 / 500 / 1000 runs) (spec 25-26)
//
// Debug overrides:
//   - Force Flash Claw / Dislocator / Executioner
//   - Disable featured-enemy guarantee
//   - Set all weights to 1.0 (flat distribution)
import React, { useState, useMemo } from 'react';
import {
  generateComposition,
  inspectCandidateWeights,
  simulateCompositions,
  getFeaturedEnemies,
  isEnemyImplemented,
} from '@/game/chapterEnemyPools';
import { ENEMY_ARCHETYPES } from '@/game/unitTypes';

const CHAPTER_OPTIONS = [
  { id: 'ch1', label: 'Chapter 1 — First Contact' },
  { id: 'ch2', label: 'Chapter 2 — Escalation' },
  { id: 'ch3', label: 'Chapter 3 — Adaptation' },
];

const FORCE_OPTIONS = [
  { id: null, label: 'None' },
  { id: 'flash_claw', label: 'Flash Claw' },
  { id: 'dislocator', label: 'Dislocator' },
  { id: 'executioner', label: 'Executioner' },
];

const SIM_RUNS = [100, 500, 1000];

function archetypeName(key) {
  return ENEMY_ARCHETYPES[key]?.name || key;
}

export default function CompositionDebugPanel() {
  const [chapterId, setChapterId] = useState('ch3');
  const [forceEnemy, setForceEnemy] = useState(null);
  const [disableFeatured, setDisableFeatured] = useState(false);
  const [allWeightsOne, setAllWeightsOne] = useState(false);
  const [count, setCount] = useState(4);
  const [hardenedChance, setHardenedChance] = useState(0.5);
  const [simResult, setSimResult] = useState(null);
  const [sample, setSample] = useState(null);

  const candidates = useMemo(
    () => inspectCandidateWeights(chapterId, { allWeightsOne }),
    [chapterId, allWeightsOne]
  );
  const featured = useMemo(() => getFeaturedEnemies(chapterId), [chapterId]);

  const overrides = { forceEnemy, disableFeatured, allWeightsOne, count, hardenedChance };

  const handleGenerate = () => {
    setSample(generateComposition(chapterId, overrides));
  };

  const handleSimulate = (runs) => {
    setSimResult(simulateCompositions(chapterId, runs, overrides));
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Chapter selector */}
      <div>
        <label className="text-muted-foreground uppercase tracking-wide">Chapter</label>
        <select
          value={chapterId}
          onChange={(e) => setChapterId(e.target.value)}
          className="w-full mt-1 bg-secondary border border-border rounded px-2 py-1.5"
        >
          {CHAPTER_OPTIONS.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Debug overrides */}
      <div className="space-y-2">
        <div className="text-muted-foreground uppercase tracking-wide">Debug Overrides</div>
        <div>
          <label className="block text-muted-foreground">Force Enemy</label>
          <select
            value={forceEnemy || ''}
            onChange={(e) => setForceEnemy(e.target.value || null)}
            className="w-full mt-1 bg-secondary border border-border rounded px-2 py-1.5"
          >
            {FORCE_OPTIONS.map((o) => (
              <option key={o.id ?? 'none'} value={o.id || ''}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={disableFeatured}
              onChange={(e) => setDisableFeatured(e.target.checked)}
            />
            Disable featured
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={allWeightsOne}
              onChange={(e) => setAllWeightsOne(e.target.checked)}
            />
            All weights = 1.0
          </label>
        </div>
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="text-muted-foreground">Count: {count}</span>
            <input
              type="range"
              min={1}
              max={8}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full"
            />
          </label>
          <label className="flex-1">
            <span className="text-muted-foreground">Harden: {Math.round(hardenedChance * 100)}%</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={hardenedChance}
              onChange={(e) => setHardenedChance(Number(e.target.value))}
              className="w-full"
            />
          </label>
        </div>
      </div>

      {/* Candidate weights */}
      <div>
        <div className="text-muted-foreground uppercase tracking-wide mb-1">
          Valid Candidates {allWeightsOne && '(flat 1.0)'}
        </div>
        <div className="bg-secondary border border-border rounded divide-y divide-border">
          {candidates.length === 0 && (
            <div className="px-2 py-1.5 text-muted-foreground">No implemented enemies in pool</div>
          )}
          {candidates.map((c) => (
            <div key={c.archetype} className="flex items-center justify-between px-2 py-1">
              <span>
                {c.name}
                {c.featured && <span className="ml-1.5 text-tech">[FEATURED]</span>}
                {!c.implemented && <span className="ml-1.5 text-muted-foreground">(unimplemented)</span>}
              </span>
              <span className="flex items-center gap-2">
                {c.cap > 0 && <span className="text-muted-foreground">max {c.cap}</span>}
                <span className={c.weight >= 1.4 ? 'text-bio font-bold' : c.weight <= 0.3 ? 'text-muted-foreground' : ''}>
                  {c.weight.toFixed(2)}
                </span>
              </span>
            </div>
          ))}
        </div>
        {featured.length > 0 && (
          <div className="mt-1 text-muted-foreground">
            Featured: {featured.map((f) => `${archetypeName(f)}${isEnemyImplemented(f) ? '' : ' (pending)'}`).join(', ')}
          </div>
        )}
      </div>

      {/* Sample composition */}
      <div>
        <button
          onClick={handleGenerate}
          className="w-full bg-primary text-primary-foreground rounded px-3 py-1.5 font-medium"
        >
          Generate Sample Composition
        </button>
        {sample && (
          <div className="mt-2 bg-secondary border border-border rounded p-2">
            <div className="text-muted-foreground uppercase tracking-wide mb-1">Selected</div>
            {sample.length === 0 ? (
              <div className="text-muted-foreground">(empty)</div>
            ) : (
              <div className="space-y-0.5">
                {sample.map((e, i) => (
                  <div key={i}>
                    {archetypeName(e.archetype)}{e.hardened && <span className="text-blood"> (hardened)</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Simulation */}
      <div>
        <div className="text-muted-foreground uppercase tracking-wide mb-1">Simulation</div>
        <div className="flex gap-2">
          {SIM_RUNS.map((runs) => (
            <button
              key={runs}
              onClick={() => handleSimulate(runs)}
              className="flex-1 bg-secondary border border-border rounded px-2 py-1.5 hover:bg-accent"
            >
              {runs}×
            </button>
          ))}
        </div>
        {simResult && (
          <div className="mt-2 bg-secondary border border-border rounded p-2">
            <div className="text-muted-foreground">
              {simResult.simulations} runs · {simResult.compositionSize} enemies each · {simResult.totalEntries} total entries
            </div>
            <div className="mt-1 divide-y divide-border">
              {simResult.distribution.map((d) => (
                <div key={d.archetype} className="flex items-center justify-between py-0.5">
                  <span>
                    {d.name}
                    {d.featured && <span className="ml-1 text-tech">★</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">{d.appearances}×</span>
                    <span className={d.frequency > 0.3 ? 'text-bio font-bold' : ''}>
                      {(d.frequency * 100).toFixed(1)}%
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}