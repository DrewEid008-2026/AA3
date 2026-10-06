import React from 'react';
import CommanderSkillsPanel from '@/components/battle/CommanderSkillsPanel';
import CommanderTargetingOverlay from '@/components/battle/CommanderTargetingOverlay';
import CommanderPreviewPanel from '@/components/battle/CommanderPreviewPanel';
import CommanderDebugPanel from '@/components/battle/CommanderDebugPanel';
import EnemyCommanderPanel from '@/components/battle/EnemyCommanderPanel';
import EnemyCommanderBanner from '@/components/battle/EnemyCommanderBanner';
import EnemyCommanderTutorial from '@/components/battle/EnemyCommanderTutorial';
import EnemyCommanderDebugPanel from '@/components/battle/EnemyCommanderDebugPanel';
import { getCommanderSkill, getCommanderSkillPreview, COMMANDER_TARGET_TYPES } from '@/game/commanderSkills';

// Renders all Commander-related overlays (player + enemy) extracted from
// Battle.jsx to keep the page file manageable. Pure presentational delegation.
export default function CommanderOverlays({
  // Player commander
  commanderPanelOpen,
  setCommanderPanelOpen,
  commanderUnlockedSkills,
  commanderResources,
  handleCommanderSkillSelect,
  canUseCommanderSkill,
  commanderTargeting,
  handleCommanderCancelTargeting,
  handleCommanderConfirm,
  handleCommanderCancelPreview,
  commanderFeedback,
  debug,
  selectedUnitId,
  units,
  grid,
  commanderTxHistory,
  committedTxCount,
  handleInjectDevSkills,
  handleClearDevSkills,
  handleToggleCommanderImmune,
  handleSetCommanderResource,
  handleRunDevSkill,
  handleSimulateTxFail,
  handleResetTxState,
  handleUnlockTacticalAdvance,
  handleRemoveTacticalAdvance,
  commanderLastUnitEffect,
  // Enemy commander
  enemyCommanderPanelOpen,
  setEnemyCommanderPanelOpen,
  enemyCommanderDisplay,
  enemyBudgetCurrent,
  enemyBudgetMax,
  showEnemyCommanderBanner,
  enemyCommanderNotification,
  enemyCommanderFirstEncounter,
  showEnemyCommanderTutorial,
  handleDismissEnemyCommanderTutorial,
  enemyCommanderProfile,
  enemyCommanderBattleState,
  enemyCommanderSource,
  enemyCommanderValid,
  enemyCommanderReason,
  enemyCommanderDevOverride,
  enemyCommanderLastResult,
  enemyCommanderLastEvaluation,
  enemyCommanderAiOverrides,
  handleSetEnemyCommanderDevOverride,
  handleSpendEnemyCommandPoint,
  handleResetEnemyBudget,
  handleForceEnemyCommand,
  handleSimulateEnemyDuplicate,
  handleTriggerEnemyActionWindow,
  handleRunEnemyEvaluation,
  handleSetEnemyHoldThreshold,
  handleSetEnemyReserveBias,
  handleSetEnemyInvalidateTarget,
  // Tutorial
  tutorial,
  TUT_ACTION,
}) {
  return (
    <>
      {/* Commander Skills Panel (modal) */}
      {commanderPanelOpen && (
        <CommanderSkillsPanel
          skills={commanderUnlockedSkills}
          resources={commanderResources}
          onSelect={handleCommanderSkillSelect}
          onClose={() => setCommanderPanelOpen(false)}
          disabled={false}
          getSkillStatus={canUseCommanderSkill}
        />
      )}

      {/* Commander targeting overlay (instruction banner) */}
      {commanderTargeting && !commanderTargeting.selectedTarget && (() => {
        const skill = getCommanderSkill(commanderTargeting.skillId);
        if (skill?.targetType === COMMANDER_TARGET_TYPES.GLOBAL) return null;
        return <CommanderTargetingOverlay skillId={commanderTargeting.skillId} onCancel={handleCommanderCancelTargeting} />;
      })()}

      {/* Commander preview + confirmation panel */}
      {commanderTargeting?.selectedTarget && (() => {
        const preview = getCommanderSkillPreview(
          commanderTargeting.skillId,
          commanderTargeting.selectedTarget,
          { units, grid, GRID_WIDTH: 9, GRID_HEIGHT: 14, campaignResources: commanderResources }
        );
        return preview ? (
          <CommanderPreviewPanel
            preview={preview}
            resources={commanderResources}
            onConfirm={() => { if (commanderTargeting?.skillId === 'player_tactical_advance') tutorial?.onEvent?.(TUT_ACTION.COMMANDER_USE, { skillId: 'player_tactical_advance' }); handleCommanderConfirm(); }}
            onCancel={handleCommanderCancelPreview}
          />
        ) : null;
      })()}

      {/* Commander feedback banner (debug completion message) */}
      {commanderFeedback && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="px-4 py-2.5 rounded-lg bg-slate-950/95 border-2 border-violet-500/70 shadow-2xl shadow-violet-900/40 text-center">
            <div className="text-[9px] font-black tracking-wider uppercase text-violet-300">Commander</div>
            <div className="text-white font-bold text-xs tracking-wide mt-0.5">{commanderFeedback.text}</div>
          </div>
        </div>
      )}

      {/* Commander debug panel (dev only) */}
      <CommanderDebugPanel
        debug={debug}
        commanderUnlockedSkills={commanderUnlockedSkills}
        commanderTargeting={commanderTargeting}
        units={units}
        selectedUnitId={selectedUnitId}
        resources={commanderResources}
        transactionHistory={commanderTxHistory}
        committedTxCount={committedTxCount}
        onInjectDevSkills={handleInjectDevSkills}
        onClearDevSkills={handleClearDevSkills}
        onToggleImmune={handleToggleCommanderImmune}
        onSetResource={handleSetCommanderResource}
        onRunDevSkill={handleRunDevSkill}
        onSimulateFail={handleSimulateTxFail}
        onResetTxState={handleResetTxState}
        onUnlockTacticalAdvance={handleUnlockTacticalAdvance}
        onRemoveTacticalAdvance={handleRemoveTacticalAdvance}
        lastUnitEffect={commanderLastUnitEffect}
      />

      {/* Enemy Commander info panel (modal) */}
      {enemyCommanderPanelOpen && enemyCommanderDisplay && (
        <EnemyCommanderPanel
          displayProfile={enemyCommanderDisplay}
          budgetCurrent={enemyBudgetCurrent}
          budgetMax={enemyBudgetMax}
          onClose={() => setEnemyCommanderPanelOpen(false)}
        />
      )}

      {/* Enemy Commander battle-start banner */}
      <EnemyCommanderBanner visible={showEnemyCommanderBanner} displayProfile={enemyCommanderDisplay} commandNotification={enemyCommanderNotification} isFirstEncounter={enemyCommanderFirstEncounter} />

      {/* Enemy Commander first-encounter tutorial (shown once, then never again) */}
      {showEnemyCommanderTutorial && enemyCommanderDisplay && (
        <EnemyCommanderTutorial
          displayProfile={enemyCommanderDisplay}
          budgetMax={enemyBudgetMax}
          onDismiss={handleDismissEnemyCommanderTutorial}
        />
      )}

      {/* Enemy Commander debug inspector (dev only) */}
      <EnemyCommanderDebugPanel
        debug={debug}
        profile={enemyCommanderProfile}
        displayProfile={enemyCommanderDisplay}
        battleState={enemyCommanderBattleState}
        budgetCurrent={enemyBudgetCurrent}
        budgetMax={enemyBudgetMax}
        assignmentSource={enemyCommanderSource}
        assignmentValid={enemyCommanderValid}
        assignmentReason={enemyCommanderReason}
        devOverride={enemyCommanderDevOverride}
        lastExecutionResult={enemyCommanderLastResult}
        lastEvaluation={enemyCommanderLastEvaluation}
        aiOverrides={enemyCommanderAiOverrides}
        onSetDevOverride={handleSetEnemyCommanderDevOverride}
        onSpendCommandPoint={handleSpendEnemyCommandPoint}
        onResetBudget={handleResetEnemyBudget}
        onForceCommand={handleForceEnemyCommand}
        onSimulateDuplicate={handleSimulateEnemyDuplicate}
        onTriggerActionWindow={handleTriggerEnemyActionWindow}
        onRunEvaluation={handleRunEnemyEvaluation}
        onSetHoldThreshold={handleSetEnemyHoldThreshold}
        onSetReserveBias={handleSetEnemyReserveBias}
        onSetInvalidateTarget={handleSetEnemyInvalidateTarget}
        units={units}
      />
    </>
  );
}