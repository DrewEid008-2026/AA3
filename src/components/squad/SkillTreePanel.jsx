import React, { useState } from 'react';
import {
  Zap, Swords, Shield, Crosshair, Wrench, Heart, Bomb, Package, Wind, Eye,
  Gauge, Hammer, Battery, Radio, DoorOpen, Lock, Check, X, Star, ChevronDown,
  Footprints, Flame, Expand, Rocket, Grid3x3,
} from 'lucide-react';
import {
  getTiers, getBranches, getNodeState, getNodeStateReason,
  getAvailableSelections, branchInvestment, getTreeBaseAbilities, NODE_STATES,
} from '@/game/skillTrees';
import { getUnitAbility } from '@/game/abilities';

const ICONS = {
  zap: Zap, swords: Swords, shield: Shield, crosshair: Crosshair, wrench: Wrench,
  heart: Heart, bomb: Bomb, package: Package, wind: Wind, eye: Eye, gauge: Gauge,
  hammer: Hammer, battery: Battery, radio: Radio, door: DoorOpen,
  footprints: Footprints, flame: Flame, expand: Expand, rocket: Rocket, grid: Grid3x3,
};

function NodeIcon({ name, className }) {
  const Icon = ICONS[name] || Star;
  return <Icon className={className} />;
}

function nodeClasses(state) {
  switch (state) {
    case NODE_STATES.PURCHASED:
      return 'border-emerald-500 bg-emerald-950/40';
    case NODE_STATES.AVAILABLE:
      return 'border-amber-400 bg-amber-950/30 shadow-[0_0_8px_-1px] shadow-amber-500/40';
    case NODE_STATES.BLOCKED:
      return 'border-slate-800 bg-slate-900/40 opacity-50';
    default:
      return 'border-slate-700 bg-slate-900/40 opacity-70';
  }
}

function StateBadge({ state }) {
  switch (state) {
    case NODE_STATES.PURCHASED:
      return (
        <span className="inline-flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-400">
          <Check className="w-2.5 h-2.5" /> Learned
        </span>
      );
    case NODE_STATES.AVAILABLE:
      return (
        <span className="inline-flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-400">
          <Star className="w-2.5 h-2.5" fill="currentColor" /> Available
        </span>
      );
    case NODE_STATES.BLOCKED:
      return (
        <span className="inline-flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-500">
          <X className="w-2.5 h-2.5" /> Blocked
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-500">
          <Lock className="w-2.5 h-2.5" /> Locked
        </span>
      );
  }
}

// Portrait-friendly skill tree with two named branches. Renders all five tiers
// (Level 2-10) so the player sees the entire tree from Level 1. Every node is
// inspectable; tapping a locked node opens its detail card with requirements.
export default function SkillTreePanel({ soldier, onLearnSkill, onClose }) {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedBaseAbilityId, setSelectedBaseAbilityId] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);

  const tiers = getTiers(soldier.class);
  const branches = getBranches(soldier.class);
  const available = getAvailableSelections(soldier);
  const baseAbilityIds = getTreeBaseAbilities(soldier.class);
  const baseAbilities = baseAbilityIds
    .map((id) => getUnitAbility({ class: soldier.class, upgrades: soldier.upgrades }, id))
    .filter(Boolean);
  const allNodes = tiers.flatMap(([, nodes]) => nodes);
  const selectedNode = selectedNodeId ? allNodes.find((n) => n.id === selectedNodeId) : null;
  const selectedState = selectedNode ? getNodeState(selectedNode, soldier) : null;
  const selectedReason = selectedNode ? getNodeStateReason(selectedNode, soldier) : null;
  const selectedBranch = selectedNode
    ? branches.find((b) => b.id === selectedNode.branchId) || null
    : null;
  const selectedBaseAbility = selectedBaseAbilityId
    ? baseAbilities.find((a) => a.id === selectedBaseAbilityId) || null
    : null;

  const handleLearn = async () => {
    if (!selectedNode || busy) return;
    setBusy(true);
    try {
      await onLearnSkill(selectedNode.id);
      setConfirming(null);
      setSelectedNodeId(null);
    } catch (e) {
      // invalid state; keep the detail open
    }
    setBusy(false);
  };

  return (
    <div className="p-4 pb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-bold text-sm tracking-wide">Skill Tree - {soldier.name}</h3>
        <button onClick={onClose} className="text-slate-400 active:scale-95"><X className="w-4 h-4" /></button>
      </div>

      {/* Available Skill Points badge (earned by level - selected skills). */}
      <div className="flex items-center justify-between mb-3 rounded-md bg-slate-900/60 border border-slate-700 px-2.5 py-1.5">
        <span className="text-[10px] uppercase tracking-wider text-slate-400">Skill Points</span>
        <span className={`text-sm font-black ${available > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
          {available}
        </span>
      </div>

      {/* When points are available but every existing skill is already
          purchased (or none are purchasable yet), say so without deleting the
          saved points; they remain for future high-level skills. */}
      {available > 0 && !allNodes.some((n) => getNodeState(n, soldier) === NODE_STATES.AVAILABLE) && (
        <div className="mb-3 rounded-md border border-slate-700 bg-slate-900/40 px-2.5 py-2 text-center text-[10px] text-slate-500 leading-snug">
          No additional skills currently available. Points are saved for future skills.
        </div>
      )}

      {/* Selected skill description — persistent area near the top so tapping
          a node shows its details without scrolling to the bottom. */}
      {selectedNode ? (
        <div className="mb-3 rounded-lg border border-slate-600 bg-slate-900/80 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <NodeIcon name={selectedNode.icon} className="w-4 h-4 text-amber-300" />
            <span className="text-white font-bold text-sm tracking-wide">{selectedNode.name}</span>
            {selectedNode.capstone && (
              <span className="text-[8px] font-bold uppercase tracking-wider text-amber-500 bg-amber-950/50 border border-amber-800/50 px-1.5 py-0.5 rounded">
                Capstone
              </span>
            )}
            <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-slate-500">
              Lv. {selectedNode.levelRequirement}
            </span>
          </div>

          {selectedBranch && (
            <div className="text-[10px] text-slate-400 mb-1.5">
              {soldier.class.charAt(0).toUpperCase() + soldier.class.slice(1)} - {selectedBranch.name}
            </div>
          )}

          <div className="text-slate-300 text-[11px] leading-snug mb-1.5">{selectedNode.description}</div>
          <div className="text-slate-500 text-[10px] mb-2">
            <span className="uppercase tracking-wider">Effect: </span>{selectedNode.effect}
          </div>

          {/* Requirements block */}
          <div className="space-y-0.5 mb-2 text-[10px]">
            <div className="text-slate-500">
              <span className="uppercase tracking-wider">Requires: </span>
              Level {selectedNode.levelRequirement}
            </div>
            {selectedNode.minimumBranchInvestment > 0 && (
              <div className="text-slate-500">
                <span className="uppercase tracking-wider">Branch: </span>
                At least {selectedNode.minimumBranchInvestment} prior {selectedBranch?.name} skills
                {' '}({branchInvestment(soldier, selectedNode.branchId)} selected)
              </div>
            )}
            {selectedNode.prerequisites && selectedNode.prerequisites.length > 0 && (
              <div className="text-slate-500">
                <span className="uppercase tracking-wider">Prereq: </span>
                {selectedNode.prerequisites
                  .map((id) => {
                    const n = allNodes.find((x) => x.id === id);
                    return n ? n.name : id;
                  })
                  .join(', ')}
              </div>
            )}
            <div className="text-slate-500">
              <span className="uppercase tracking-wider">Selectable: </span>
              {selectedState === NODE_STATES.AVAILABLE ? 'Yes' : 'No'}
            </div>
          </div>

          {selectedState === NODE_STATES.AVAILABLE ? (
            <button
              type="button"
              onClick={() => setConfirming(selectedNode)}
              disabled={busy}
              className="w-full py-2.5 rounded-lg bg-amber-500 text-slate-900 text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation disabled:opacity-50"
            >
              Learn Skill
            </button>
          ) : selectedState === NODE_STATES.PURCHASED ? (
            <div className="w-full py-2 text-center text-emerald-400 text-xs font-bold uppercase tracking-wide">
              Already Learned
            </div>
          ) : (
            <div className="w-full py-2 text-center text-rose-400/80 text-[11px] font-semibold">
              {selectedReason || 'Unavailable'}
            </div>
          )}
        </div>
      ) : selectedBaseAbility ? (
        <div className="mb-3 rounded-lg border border-emerald-600 bg-slate-900/80 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <NodeIcon name={selectedBaseAbility.icon || 'star'} className="w-4 h-4 text-emerald-400" />
            <span className="text-white font-bold text-sm tracking-wide">{selectedBaseAbility.name}</span>
            <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-emerald-400">
              Base Ability
            </span>
          </div>
          <div className="text-slate-300 text-[11px] leading-snug mb-2">{selectedBaseAbility.desc}</div>
          <div className="flex gap-3 text-[10px] text-slate-500 mb-2">
            <span><span className="uppercase tracking-wider">AP: </span>{selectedBaseAbility.apCost ?? 0}</span>
            <span><span className="uppercase tracking-wider">CD: </span>{selectedBaseAbility.cooldown ?? 0}</span>
            <span><span className="uppercase tracking-wider">Range: </span>{selectedBaseAbility.range ?? '-'}</span>
          </div>
          <div className="w-full py-2 text-center text-emerald-400 text-xs font-bold uppercase tracking-wide">
            Learned
          </div>
        </div>
      ) : (
        <div className="mb-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-center text-[10px] text-slate-500 leading-snug">
          Tap a skill to inspect it.
        </div>
      )}

      {/* Base Class Abilities: inherent to the class, not purchasable. */}
      {baseAbilities.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Base Abilities</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {baseAbilities.map((ab) => {
              const isBaseSelected = selectedBaseAbilityId === ab.id;
              return (
                <button
                  key={ab.id}
                  type="button"
                  onClick={() => {
                    setSelectedBaseAbilityId(isBaseSelected ? null : ab.id);
                    setSelectedNodeId(null);
                  }}
                  className={`text-left rounded-lg border border-emerald-500 bg-emerald-950/40 p-2.5 transition touch-manipulation ${
                    isBaseSelected ? 'ring-2 ring-sky-400' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <NodeIcon name={ab.icon || 'star'} className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-white font-bold text-[11px] tracking-wide leading-tight">
                      {ab.name}
                    </span>
                  </div>
                  <div className="mt-1">
                    <span className="inline-flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-400">
                      <Check className="w-2.5 h-2.5" /> Learned
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Branch headers */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        {branches.map((b) => {
          const invested = branchInvestment(soldier, b.id);
          return (
            <div key={b.id} className="rounded-md border border-slate-700 bg-slate-900/50 px-2 py-1.5 text-center">
              <div className="text-white font-bold text-[11px] tracking-wide uppercase">{b.name}</div>
              <div className="text-[8px] text-slate-500 leading-tight mt-0.5">{b.identity}</div>
              <div className="text-[8px] text-slate-600 mt-0.5">{invested} selected</div>
            </div>
          );
        })}
      </div>

      {/* Tree: 5 tiers, two columns (left/right branch) */}
      <div className="space-y-0">
        {tiers.map(([tier, nodes], ti) => {
          const sorted = [...nodes].sort((a, b) => a.position - b.position);
          const levelReq = sorted[0].levelRequirement;
          return (
            <div key={tier}>
              <div className="flex items-center gap-2 mb-1.5 mt-1">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  Level {levelReq}
                </span>
                <div className="flex-1 h-px bg-slate-800" />
                {levelReq === 10 && (
                  <span className="text-[8px] font-bold uppercase tracking-wider text-amber-500">Capstone</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {sorted.map((node) => {
                  const state = getNodeState(node, soldier);
                  const isSelected = selectedNodeId === node.id;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => {
                        setSelectedNodeId(isSelected ? null : node.id);
                        setSelectedBaseAbilityId(null);
                      }}
                      className={`text-left rounded-lg border p-2.5 transition touch-manipulation ${nodeClasses(state)} ${
                        isSelected ? 'ring-2 ring-sky-400' : ''
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <NodeIcon name={node.icon} className="w-4 h-4 text-slate-300 shrink-0" />
                        <span className="text-white font-bold text-[11px] tracking-wide leading-tight">
                          {node.name}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <StateBadge state={state} />
                      </div>
                    </button>
                  );
                })}
              </div>
              {ti < tiers.length - 1 && (
                <div className="flex justify-center py-1">
                  <ChevronDown className="w-3.5 h-3.5 text-slate-700" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation dialog */}
      {confirming && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-600 bg-slate-900 p-4">
            <div className="text-amber-400 font-black text-xs tracking-widest uppercase mb-1">Learn Skill</div>
            <div className="text-white font-bold text-base mb-1">{confirming.name}</div>
            <div className="text-slate-300 text-xs leading-snug mb-1">{confirming.description}</div>
            <div className="text-slate-500 text-[11px] mb-4">{confirming.effect}</div>
            <div className="text-slate-400 text-[10px] mb-4">This choice is permanent.</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                disabled={busy}
                className="flex-1 py-2.5 rounded-lg border border-slate-600 bg-slate-800 text-slate-300 text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLearn}
                disabled={busy}
                className="flex-1 py-2.5 rounded-lg bg-amber-500 text-slate-900 text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation disabled:opacity-50"
              >
                Learn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}