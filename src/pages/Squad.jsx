import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, Gem, Zap, Users, UserPlus, Crown } from 'lucide-react';
import {
  ensureRoster, loadPlayerSave,
  treatInjury, equipItem, unequipItem, selectSkill, respecSoldier,
  recruitSoldier, renameSoldier, setSoldierIconColor, setSoldierIcon, dismissSoldier,
} from '@/game/persistence';
import { getMaxSquadSize, isChessBoardUnlocked } from '@/game/squadUpgrades';
import { getAvailableSelections } from '@/game/skillTrees';
import SoldierCard from '@/components/squad/SoldierCard';
import MedicalPanel from '@/components/squad/MedicalPanel';
import SkillTreePanel from '@/components/squad/SkillTreePanel';
import BioPanel from '@/components/squad/BioPanel';
import RecruitMenu from '@/components/squad/RecruitMenu';
import SquadFilter from '@/components/squad/SquadFilter';
import QuickEquipModal from '@/components/squad/QuickEquipModal';

// Pre-mission squad management: review condition, treat injured soldiers,
// manage loadouts, and navigate to missions. Injured soldiers require paid
// treatment before they can deploy. Debug controls live in the global DebugOverlay.
export default function Squad() {
  const [soldiers, setSoldiers] = useState([]);
  const [save, setSave] = useState(null);
  const [loading, setLoading] = useState(true);
  const [managingId, setManagingId] = useState(null);
  const [activeTab, setActiveTab] = useState('medical');
  const [busy, setBusy] = useState(false);
  const [showRecruit, setShowRecruit] = useState(false);
  const [filter, setFilter] = useState('all');
  const [highlightId, setHighlightId] = useState(null);
  const [equipModalTarget, setEquipModalTarget] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    const [s, p] = await Promise.all([ensureRoster(), loadPlayerSave()]);
    setSoldiers(s);
    setSave(p);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh when debug controls change data in the global DebugOverlay.
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('debug-data-changed', handler);
    return () => window.removeEventListener('debug-data-changed', handler);
  }, [load]);

  const managingSoldier = soldiers.find((s) => s.id === managingId) || null;

  const openManage = (soldier) => {
    setManagingId(soldier.id);
    const unspent = getAvailableSelections(soldier);
    setActiveTab(unspent > 0 ? 'skill' : soldier.injured ? 'medical' : 'bio');
  };

  const handleLearnSkill = async (nodeId) => {
    if (!managingSoldier || busy) return;
    const updated = await selectSkill(managingSoldier.id, nodeId);
    setSoldiers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleTreatInjury = async () => {
    if (!managingSoldier || busy) return;
    setBusy(true);
    try {
      const { soldier, save: newSave } = await treatInjury(managingSoldier.id);
      setSoldiers((prev) => prev.map((s) => (s.id === soldier.id ? soldier : s)));
      setSave(newSave);
    } catch (e) { /* insufficient credits — panel handles */ }
    setBusy(false);
  };

  // Direct 1-tap quick equipping from soldier card buttons
  const handleQuickEquip = async (slotKey, itemId) => {
    if (!equipModalTarget || busy) return;
    setBusy(true);
    try {
      await equipItem(equipModalTarget.soldierId, slotKey, itemId);
      const s = await ensureRoster();
      setSoldiers(s);
    } catch (e) {
      console.error('Failed to equip item:', e);
    }
    setBusy(false);
  };

  const handleQuickUnequip = async (slotKey) => {
    if (!equipModalTarget || busy) return;
    setBusy(true);
    try {
      await unequipItem(equipModalTarget.soldierId, slotKey);
      const s = await ensureRoster();
      setSoldiers(s);
    } catch (e) {
      console.error('Failed to unequip item:', e);
    }
    setBusy(false);
  };

  // --- Recruitment ---
  const handleRecruit = async (cls) => {
    setBusy(true);
    try {
      const newSoldier = await recruitSoldier(cls);
      const s = await ensureRoster();
      setSoldiers(s);
      setShowRecruit(false);
      setHighlightId(newSoldier.id);
      setTimeout(() => setHighlightId(null), 2000);
    } catch (e) { /* no active campaign */ }
    setBusy(false);
  };

  // --- Bio: rename, color, dismiss ---
  const handleRename = async (newName) => {
    if (!managingSoldier || busy) return;
    setBusy(true);
    try {
      const updated = await renameSoldier(managingSoldier.id, newName);
      setSoldiers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (e) {}
    setBusy(false);
  };

  const handleColorChange = async (color) => {
    if (!managingSoldier || busy) return;
    setBusy(true);
    try {
      const updated = await setSoldierIconColor(managingSoldier.id, color);
      setSoldiers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (e) {}
    setBusy(false);
  };

  const handleIconChange = async (iconKey) => {
    if (!managingSoldier || busy) return;
    setBusy(true);
    try {
      const updated = await setSoldierIcon(managingSoldier.id, iconKey);
      setSoldiers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (e) {}
    setBusy(false);
  };

  const handleDismiss = async () => {
    if (!managingSoldier || busy) return;
    setBusy(true);
    try {
      await dismissSoldier(managingSoldier.id);
      setManagingId(null);
      const s = await ensureRoster();
      setSoldiers(s);
    } catch (e) {}
    setBusy(false);
  };

  // Respec: atomic transaction in persistence (deducts credits, clears skills,
  // sets new class, refunds skill selections). On success, refresh roster + save
  // and switch to the Skills tab so the player can immediately rebuild.
  const handleRespec = async (newClass) => {
    if (!managingSoldier || busy) return;
    setBusy(true);
    try {
      const updated = await respecSoldier(managingSoldier.id, newClass);
      setSoldiers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      const sv = await loadPlayerSave();
      setSave(sv);
      setActiveTab('skill');
    } catch (e) {}
    setBusy(false);
  };

  // Open the Chess Table minigame for the currently managed soldier. The route
  // carries the soldier id; the page reads the current name fresh from the save
  // so renames are reflected and identity never goes stale.
  const handleOpenChess = () => {
    if (!managingSoldier) return;
    navigate(`/chess-table/${managingSoldier.id}`);
  };

  const chessUnlocked = isChessBoardUnlocked(save);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-700 border-t-slate-300 rounded-full animate-spin" />
      </div>
    );
  }

  const maxSquad = getMaxSquadSize(save);
  const readyCount = soldiers.filter((s) => s.alive && !s.injured).length;
  const filteredSoldiers = filter === 'all'
    ? soldiers
    : soldiers.filter((s) => s.class === filter);

  return (
    <div className="h-[100dvh] bg-slate-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <h1 className="text-white font-black text-lg tracking-wider uppercase">Squad</h1>
        </div>
        <div className="flex items-center gap-4 mt-1 text-xs">
          <span className="inline-flex items-center gap-1 text-amber-300">
            <Coins className="w-3.5 h-3.5" /> {save?.credits ?? 0}
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-300">
            <Gem className="w-3.5 h-3.5" /> {save?.alien_materials ?? 0}
          </span>
          <span className="inline-flex items-center gap-1 text-fuchsia-300">
            <Zap className="w-3.5 h-3.5" /> {save?.powerCores ?? 0}
          </span>
          <span className="inline-flex items-center gap-1 text-slate-400">
            <Users className="w-3.5 h-3.5" /> {readyCount} / {maxSquad}
          </span>
        </div>
      </div>

      {/* Class filters */}
      <div className="shrink-0 px-3 py-2 border-b border-slate-800/50">
        <SquadFilter active={filter} onChange={setFilter} />
      </div>

      {/* Recruit */}
      <div className="shrink-0 px-3 pt-3">
        <button
          type="button"
          onClick={() => setShowRecruit(true)}
          disabled={busy}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold tracking-wide uppercase active:scale-95 transition touch-manipulation disabled:opacity-50"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Recruit
        </button>
      </div>

      {/* Soldier cards */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 pb-2">
        {filteredSoldiers.map((s) => (
          <div key={s.id} className={highlightId === s.id ? 'animate-pulse ring-2 ring-amber-400 rounded-lg' : ''}>
            <SoldierCard
              soldier={s}
              onManage={openManage}
              onOpenEquipSlot={(soldier, slot) => setEquipModalTarget({ soldierId: soldier.id, slot })}
            />
          </div>
        ))}
        {filteredSoldiers.length === 0 && (
          <div className="text-center text-slate-500 text-xs py-8">
            No {filter !== 'all' ? filter : ''} soldiers in roster.
          </div>
        )}
      </div>

      <div className="h-[calc(4rem+env(safe-area-inset-bottom))]" />

      {/* Management bottom sheet */}
      {managingSoldier && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setManagingId(null)} />
          <div className="relative bg-slate-900 border-t border-slate-700 rounded-t-xl max-h-[80dvh] overflow-y-auto">
            <div className="flex border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
              <TabButton active={activeTab === 'bio'} onClick={() => setActiveTab('bio')}>
                Bio
              </TabButton>
              <TabButton active={activeTab === 'medical'} onClick={() => setActiveTab('medical')}>
                Medical
              </TabButton>
              <TabButton
                active={activeTab === 'skill'}
                onClick={() => setActiveTab('skill')}
                badge={getAvailableSelections(managingSoldier)}
              >
                Skills
              </TabButton>
              {chessUnlocked && (
                <button
                  type="button"
                  onClick={handleOpenChess}
                  className="shrink-0 px-2.5 flex items-center justify-center text-amber-400 active:scale-95 transition touch-manipulation"
                  aria-label="Chess Board"
                >
                  <Crown className="w-4 h-4" />
                </button>
              )}
            </div>
            {activeTab === 'bio' ? (
              <BioPanel
                soldier={managingSoldier}
                credits={save?.credits ?? 0}
                chessBoardUnlocked={chessUnlocked}
                onOpenChess={handleOpenChess}
                onRename={handleRename}
                onColorChange={handleColorChange}
                onIconChange={handleIconChange}
                onRespec={handleRespec}
                onDismiss={handleDismiss}
                onClose={() => setManagingId(null)}
              />
            ) : activeTab === 'medical' ? (
              <MedicalPanel
                soldier={managingSoldier}
                credits={save?.credits ?? 0}
                onTreatInjury={handleTreatInjury}
                onClose={() => setManagingId(null)}
              />
            ) : (
              <SkillTreePanel
                soldier={managingSoldier}
                onLearnSkill={handleLearnSkill}
                onClose={() => setManagingId(null)}
              />
            )}
          </div>
        </div>
      )}

      {/* Direct Quick-Equip Modal */}
      {equipModalTarget && (
        <QuickEquipModal
          soldier={soldiers.find((s) => s.id === equipModalTarget.soldierId)}
          slot={equipModalTarget.slot}
          inventory={save?.inventory || {}}
          onEquip={handleQuickEquip}
          onUnequip={handleQuickUnequip}
          onChangeSlot={(newSlot) => setEquipModalTarget((prev) => ({ ...prev, slot: newSlot }))}
          onClose={() => setEquipModalTarget(null)}
          busy={busy}
        />
      )}

      {showRecruit && (
        <RecruitMenu
          onSelectClass={handleRecruit}
          onClose={() => setShowRecruit(false)}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2.5 text-xs font-bold tracking-wide uppercase transition flex items-center justify-center gap-1 ${
        active
          ? 'text-white border-b-2 border-amber-500'
          : 'text-slate-500 border-b-2 border-transparent'
      }`}
    >
      {children}
      {badge > 0 && (
        <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-amber-400 text-slate-900 text-[9px] font-black leading-none">
          {badge}
        </span>
      )}
    </button>
  );
}