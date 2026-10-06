import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Coins, Check, HeartCrack, ChevronRight, Users, Crosshair } from 'lucide-react';
import { ensureRoster, loadPlayerSave, getLastDeployedSoldierIds, setLastDeployedSoldierIds } from '@/game/persistence';
import { getEffectiveMaxHp } from '@/game/equipment';
import { getMaxSquadSize } from '@/game/squadUpgrades';
import { getMission, generateMapConfig } from '@/game/missions';
import { MISSION_TYPES } from '@/game/constants';
import { ensureMissionCommanderAssignment, getEnemyCommanderState, isCommanderEncountered } from '@/game/enemyCommanderAssignment';
import { getEnemyCommanderDisplayProfile, getEnemyCommanderProfile } from '@/game/enemyCommanders';
import BottomNav from '@/components/BottomNav';
import BossWarning from '@/components/battle/BossWarning';

const TYPE_ICONS = {
  [MISSION_TYPES.ELIMINATION]: '⚔️',
  [MISSION_TYPES.EXTRACTION]: '🏃',
  [MISSION_TYPES.RESCUE]: '❤️',
  [MISSION_TYPES.SABOTAGE]: '💣',
};

// Pre-mission deployment screen. The player selects which Ready soldiers to
// deploy (up to the current squad capacity). Injured soldiers are visible but
// cannot be selected. Tapping Deploy navigates to battle with the selected IDs.
export default function Deploy() {
  const { missionId } = useParams();
  const navigate = useNavigate();
  const mission = getMission(missionId);
  const [soldiers, setSoldiers] = useState([]);
  const [save, setSave] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(() => new Set());
  const [showBossWarning, setShowBossWarning] = useState(() => mission?.isBoss ?? false);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, p] = await Promise.all([ensureRoster(), loadPlayerSave()]);
    setSoldiers(s);
    setSave(p);
    // Ensure the hostile Commander assignment for this mission before launch
    // (spec §20: assignment must happen before battle initialization).
    if (mission?.chapterId === 'ch3' && mission?.type === MISSION_TYPES.SABOTAGE) {
      ensureMissionCommanderAssignment(mission.id, mission);
    }
    // Preselect the soldiers deployed on the last mission (if still ready).
    const lastIds = getLastDeployedSoldierIds();
    if (lastIds.length > 0) {
      const readyIds = new Set(s.filter((x) => x.alive && !x.injured && x.equipped_weapon).map((x) => x.id));
      const stillReady = lastIds.filter((id) => readyIds.has(id));
      if (stillReady.length > 0) setSelected(new Set(stillReady));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!mission) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-slate-950 text-slate-400">
        <button onClick={() => navigate('/missions')} className="px-4 py-2 rounded bg-slate-800 text-white text-sm">
          Invalid mission
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-700 border-t-slate-300 rounded-full animate-spin" />
      </div>
    );
  }

  const maxSquad = getMaxSquadSize(save);
  const readySoldiers = soldiers.filter((s) => s.alive && !s.injured && s.equipped_weapon);
  const injuredSoldiers = soldiers.filter((s) => s.injured);
  const noWeaponSoldiers = soldiers.filter((s) => s.alive && !s.injured && !s.equipped_weapon);

  // Hostile Commander indicator for this mission (spec §28). After the first
  // encounter, show the commander identity on the Deploy screen. Before the
  // first encounter, reveal only on mission launch (battle start).
  const commanderAssignment = mission?.chapterId === 'ch3' && mission?.type === MISSION_TYPES.SABOTAGE
    ? ensureMissionCommanderAssignment(mission.id, mission)
    : null;
  const vexarAssigned = commanderAssignment?.commanderId === 'vexar_huntsmaster';
  const vexarEncountered = isCommanderEncountered(getEnemyCommanderState(), 'vexar_huntsmaster');
  const showCommanderIndicator = vexarAssigned && vexarEncountered;
  const vexarDisplay = showCommanderIndicator
    ? getEnemyCommanderDisplayProfile(getEnemyCommanderProfile('vexar_huntsmaster'))
    : null;

  const toggleSoldier = (soldier) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(soldier.id)) {
        next.delete(soldier.id);
      } else {
        if (next.size >= maxSquad) return prev;
        next.add(soldier.id);
      }
      return next;
    });
  };

  const handleDeploy = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    // Remember this selection for the next Deploy screen.
    setLastDeployedSoldierIds(ids);
    // Generate (and cache) the battlefield for this mission attempt. The map
    // is selected automatically from compatible templates with anti-repeat;
    // the cached config is read by Battle so the same battlefield is used for
    // the entire attempt and recreated on restart.
    generateMapConfig(missionId);
    navigate(`/battle/${missionId}?s=${ids.join(',')}`);
  };

  return (
    <div className="min-h-[100dvh] bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-4 py-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-black text-lg tracking-wider uppercase">{mission.title}</h1>
            <p className="text-slate-500 text-[11px] mt-0.5">{mission.objectiveText}</p>
          </div>
          <span className="inline-flex items-center gap-1 text-amber-300 text-xs">
            <Coins className="w-3.5 h-3.5" /> {save?.credits ?? 0}
          </span>
        </div>
        {showCommanderIndicator && vexarDisplay && (
          <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-rose-950/60 border border-rose-700/50">
            <span className="text-rose-500 text-sm">⚠</span>
            <div className="flex flex-col">
              <span className="text-[8px] font-bold uppercase tracking-wider text-rose-400">Hostile Commander</span>
              <span className="text-rose-300 font-bold text-[11px] tracking-wide">
                {vexarDisplay.displayName} — {vexarDisplay.title}
              </span>
            </div>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            <Users className="w-3.5 h-3.5" />
            Squad {selected.size} / {maxSquad}
          </div>
          <button
            type="button"
            onClick={handleDeploy}
            disabled={selected.size === 0}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold tracking-widest uppercase transition touch-manipulation ${
              selected.size > 0
                ? 'bg-amber-600 text-white active:scale-95'
                : 'bg-slate-800 text-slate-500 border border-slate-700 opacity-60'
            }`}
          >
            Deploy {selected.size > 0 && <span className="text-amber-200">({selected.size})</span>} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Soldier selection */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 pb-4">
        {readySoldiers.map((s) => {
          const isSelected = selected.has(s.id);
          const effMaxHp = getEffectiveMaxHp(s);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggleSoldier(s)}
              className={`w-full text-left rounded-lg border p-3 transition touch-manipulation ${
                isSelected
                  ? 'border-amber-500 bg-amber-950/30'
                  : 'border-slate-700 bg-slate-900/60 active:scale-[0.98]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${isSelected ? 'bg-amber-900/50' : 'bg-slate-800'}`}>
                  {isSelected ? (
                    <Check className="w-4 h-4 text-amber-400" />
                  ) : (
                    <span className="text-lg">{TYPE_ICONS[s.class] || '⚔️'}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-sm tracking-wide">{s.name}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      Lv. {s.level}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 capitalize">{s.class}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-slate-500">HP</div>
                  <div className="text-white font-bold text-sm">{s.current_hp}/{effMaxHp}</div>
                </div>
              </div>
            </button>
          );
        })}

        {/* Injured soldiers — visible but unavailable */}
        {injuredSoldiers.map((s) => (
          <div key={s.id} className="rounded-lg border border-rose-900/50 bg-rose-950/20 p-3 opacity-70">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-rose-950/50 flex items-center justify-center shrink-0">
                <HeartCrack className="w-4 h-4 text-rose-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-rose-400 font-bold text-sm tracking-wide">{s.name}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-900/60 text-rose-400">
                    Injured
                  </span>
                </div>
                <div className="text-[11px] text-rose-400/70 capitalize">{s.class} — Treatment Required</div>
              </div>
            </div>
          </div>
        ))}

        {readySoldiers.length === 0 && injuredSoldiers.length > 0 && (
          <div className="text-center text-rose-400 text-xs py-6">
            No deployable soldiers. Treat injuries in the Squad screen.
          </div>
        )}

        {/* Soldiers without weapons — visible but cannot deploy */}
        {noWeaponSoldiers.map((s) => (
          <div key={s.id} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 opacity-70">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-slate-800 flex items-center justify-center shrink-0">
                <Crosshair className="w-4 h-4 text-slate-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold text-sm tracking-wide">{s.name}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">
                    Lv. {s.level}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 capitalize">{s.class}</div>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500 shrink-0">
                Weapon Required
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="h-[calc(4rem+env(safe-area-inset-bottom))]" />

      <BottomNav />

      {showBossWarning && (
        <BossWarning
          missionTitle={mission.title}
          onContinue={() => setShowBossWarning(false)}
          onBack={() => navigate('/missions')}
        />
      )}
    </div>
  );
}