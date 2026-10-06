// Guided Combat Tutorial — the complete step script.
//
// Data-driven: each step is a plain object. The engine advances through these;
// the presentation layer renders the current step's title/body/highlights.
// No JSX, no battle logic lives here — steps reference real systems by id.
//
// Step shape (see tutorialEngine.js for action types):
//   id              — unique step id
//   section         — spec section letter (A–V) for debug grouping
//   title           — short uppercase headline
//   body            — instructional text (snarky, concise, never condescending)
//   highlightTargets — string[] of highlight targets (see tutorialHighlights.js)
//   allowedActions  — TUT_ACTION[] whitelist; empty/omitted = full freedom
//   requiredAction  — { type, filter? } — the action that completes this step
//                     Omit for informational "Continue" steps.
//   successText     — feedback shown briefly after completion (optional)
//   optionalHint    — contextual hint shown after idle (Section U)
//   autoAdvance     — if true and no requiredAction, auto-advance after a beat
//   cameraTarget    — { x, y } reserved for future camera focus (unused now)
//
// Tone: playful, snarky, self-aware, helpful. Matches the New Campaign intro.

import { TUT_ACTION as A } from './tutorialEngine';

export const TUTORIAL_STEPS = [
  // ============================================================
  // SECTION A — WELCOME / SELECTING A SOLDIER
  // ============================================================
  {
    id: 'tut_welcome',
    section: 'A',
    title: 'WELCOME TO THE PART WHERE WE SHOOT THINGS',
    body: 'This is turn-based combat. Your squad gets a Player Phase. The aliens get an Enemy Phase. During your phase, soldiers spend Action Points — AP — to move, attack, reload, use abilities, and generally make questionable tactical decisions. We\'ll start easy. Tap your soldier.',
    highlightTargets: ['unit:tut_soldier_1'],
    allowedActions: [A.SELECT_UNIT],
    requiredAction: { type: A.SELECT_UNIT, filter: { team: 'player' } },
    successText: 'Congratulations. You have selected a person. We\'re making excellent progress.',
    optionalHint: 'Tap the highlighted soldier.',
  },
  {
    id: 'tut_select_soldier_success',
    section: 'A',
    title: 'SELECTED',
    body: 'Congratulations. You have selected a person. We\'re making excellent progress.',
    autoAdvance: true,
  },

  // ============================================================
  // SECTION B — ACTION POINTS
  // ============================================================
  {
    id: 'tut_ap_intro',
    section: 'B',
    title: 'ACTION POINTS — AP',
    body: 'Most soldiers begin their turn with 2 AP. Most important actions cost 1 AP. Move? AP. Shoot alien? AP. Reload? AP. Abilities may have their own rules, but AP is the basic currency of combat. Your soldier currently has AP 2 / 2.',
    highlightTargets: ['ui:ap_display'],
    optionalHint: 'The AP dots are in the bottom bar next to your soldier\'s name.',
  },

  // ============================================================
  // SECTION C — MOVEMENT + PREVIEW
  // ============================================================
  {
    id: 'tut_move_intro',
    section: 'C',
    title: 'MOVEMENT',
    body: 'Tap a highlighted tile to plan a move. The first tap does NOT immediately send your soldier running across the battlefield.',
    highlightTargets: ['tile:reachable'],
    allowedActions: [A.SELECT_DESTINATION],
    requiredAction: { type: A.SELECT_DESTINATION },
    successText: 'Before moving, the game shows you the path, AP cost, destination, nearby threats, and your cover position.',
    optionalHint: 'Tap one of the blue highlighted tiles.',
  },
  {
    id: 'tut_move_preview',
    section: 'C',
    title: 'MOVEMENT PREVIEW',
    body: 'Before moving, the game shows you: the path, AP cost, your destination, nearby threats, and your cover position. Tap the destination again to confirm.',
    highlightTargets: ['tile:destination'],
    allowedActions: [A.CONFIRM_MOVE],
    requiredAction: { type: A.CONFIRM_MOVE },
    successText: 'Movement accomplished. Nobody tripped. 1 AP remaining.',
    optionalHint: 'Tap the same tile again to confirm the move.',
  },
  {
    id: 'tut_confirm_move_success',
    section: 'C',
    title: 'MOVEMENT',
    body: 'Movement accomplished. Nobody tripped. 1 AP remaining.',
    autoAdvance: true,
  },

  // ============================================================
  // SECTION D — DIRECTIONAL COVER
  // ============================================================
  {
    id: 'tut_cover_intro',
    section: 'D',
    title: 'COVER',
    body: 'Cover is directional. Standing next to a wall does not magically protect you from every direction. The wall has to actually be between you and the thing trying to kill you. Revolutionary technology, I know.',
    highlightTargets: ['tile:cover'],
    optionalHint: 'The shield icons on tiles show cover direction.',
  },
  {
    id: 'tut_covered',
    section: 'D',
    title: 'COVERED',
    body: 'When cover protects you from the attacker, incoming damage is reduced to 50%.',
    autoAdvance: true,
  },
  {
    id: 'tut_exposed',
    section: 'D',
    title: 'EXPOSED',
    body: 'If the attacker has a clean angle around your cover, you take full damage.',
    autoAdvance: true,
  },
  {
    id: 'tut_flanked',
    section: 'D',
    title: 'FLANKED',
    body: 'And if somebody gets a proper flank: 150% damage. Flanking is good when you\'re doing it. Less good when they are.',
    autoAdvance: true,
  },
  {
    id: 'tut_cover_recap',
    section: 'D',
    title: 'COVER',
    body: 'You don\'t need to memorize every angle. The game previews this stuff before you commit.',
    autoAdvance: true,
  },

  // ============================================================
  // SECTION E — ATTACKING + DETERMINISTIC DAMAGE
  // ============================================================
  {
    id: 'tut_attack_intro',
    section: 'E',
    title: 'ATTACKING',
    body: 'Time to shoot something. Tap the alien.',
    highlightTargets: ['unit:tut_grunt_1'],
    allowedActions: [A.SELECT_ENEMY],
    requiredAction: { type: A.SELECT_ENEMY },
    successText: 'Attacks are deterministic. If the attack is valid, it hits.',
    optionalHint: 'Tap the highlighted alien.',
  },
  {
    id: 'tut_deterministic',
    section: 'E',
    title: 'DETERMINISTIC COMBAT',
    body: 'Attacks are deterministic. There is no "95% chance to hit" followed by "somehow you shot the moon." If the attack is valid, it hits.',
    highlightTargets: ['ui:fire'],
    allowedActions: [A.FIRE],
    requiredAction: { type: A.FIRE },
    successText: 'Nice. Math happened. Alien got shot. Everybody wins except the alien.',
    optionalHint: 'Tap FIRE to confirm the attack.',
  },
  {
    id: 'tut_attack_success',
    section: 'E',
    title: 'ATTACK',
    body: 'Nice. Math happened. Alien got shot. Everybody wins except the alien.',
    autoAdvance: true,
  },

  // ============================================================
  // SECTION F — FLANKING EXERCISE
  // ============================================================
  {
    id: 'tut_flank_practice',
    section: 'F',
    title: 'FLANKING',
    body: 'Now make positioning matter. This alien is protected from your current angle. Find a position that gives you a FLANK.',
    highlightTargets: ['unit:tut_grunt_2', 'tile:reachable'],
    allowedActions: [A.SELECT_UNIT, A.SELECT_DESTINATION, A.CONFIRM_MOVE, A.FLANK_ATTACK],
    requiredAction: { type: A.FLANK_ATTACK, filter: { state: 'flanked' } },
    successText: 'That\'s a flank. More damage. More satisfaction. Strongly recommended.',
    optionalHint: 'Try moving to a side where the enemy\'s cover is no longer between you.',
  },
  {
    id: 'tut_flank_success',
    section: 'F',
    title: 'FLANK',
    body: 'That\'s a flank. More damage. More satisfaction. Strongly recommended.',
    autoAdvance: true,
  },

  // ============================================================
  // SECTION G — ARMOR
  // ============================================================
  {
    id: 'tut_armor_intro',
    section: 'G',
    title: 'ARMOR',
    body: 'Some enemies wear Armor. Because apparently the aliens also discovered personal protective equipment. The yellow pips next to an enemy\'s HP are Armor.',
    highlightTargets: ['unit:tut_armored_1'],
    optionalHint: 'The yellow pips under the enemy\'s HP are Armor.',
  },
  {
    id: 'tut_armor_example',
    section: 'G',
    title: 'ARMOR',
    body: 'Armor reduces direct damage before it reaches HP. Example: Base Damage 5, Armor 2, HP Damage 3. You have to chew through the Armor first.',
    autoAdvance: true,
  },

  // ============================================================
  // SECTION H — ARMOR SHRED
  // ============================================================
  {
    id: 'tut_shred_intro',
    section: 'H',
    title: 'ARMOR SHRED',
    body: 'Some attacks permanently damage Armor for the rest of the battle. LMG hits Shred Armor. Explosives Shred even more. Select your LMG soldier and attack the armored alien.',
    highlightTargets: ['unit:tut_lmg_soldier', 'unit:tut_armored_1', 'ui:attack'],
    allowedActions: [A.SELECT_UNIT, A.SELECT_ENEMY, A.FIRE],
    requiredAction: { type: A.SHRED_ARMOR },
    successText: 'Notice the Armor pip disappeared. That Armor is gone for the rest of the battle.',
    optionalHint: 'Select the LMG soldier, enter Attack mode, and fire at the armored alien.',
  },
  {
    id: 'tut_shred_feedback',
    section: 'H',
    title: 'ARMOR SHRED',
    body: 'Notice the Armor pip disappeared. That Armor is gone for the rest of the battle. Shred the Armor. Then shoot what\'s underneath. Sophisticated tactics.',
    autoAdvance: true,
  },
  {
    id: 'tut_shred_order',
    section: 'H',
    title: 'RESOLUTION ORDER',
    body: 'Damage is calculated using CURRENT Armor first. Then the attack Shreds Armor afterward. So your first hit still pays full Armor — but the next hit pays less.',
    autoAdvance: true,
  },

  // ============================================================
  // SECTION I — RELOADING
  // ============================================================
  {
    id: 'tut_reload_setup',
    section: 'I',
    title: 'RELOAD',
    body: 'Weapons have ammunition. Eventually the gun makes the disappointing noise instead of the exciting noise. Your soldier is out of ammo.',
    highlightTargets: ['ui:reload'],
    allowedActions: [A.SELECT_UNIT, A.RELOAD],
    requiredAction: { type: A.RELOAD },
    successText: 'Excellent. We once again possess bullets.',
    optionalHint: 'Your weapon is empty. Reload is highlighted.',
  },
  {
    id: 'tut_reload_success',
    section: 'I',
    title: 'RELOAD',
    body: 'Excellent. We once again possess bullets.',
    autoAdvance: true,
  },

  // ============================================================
  // SECTION J — CLASS ABILITIES
  // ============================================================
  {
    id: 'tut_ability_intro',
    section: 'J',
    title: 'CLASS ABILITIES',
    body: 'Soldiers also have Class Abilities. This is where things start getting interesting.',
    highlightTargets: ['ui:ability:heal'],
    optionalHint: 'The ability buttons are in the bottom bar, next to Overwatch.',
  },
  {
    id: 'tut_ability_explain',
    section: 'J',
    title: 'CLASS ABILITIES',
    body: 'Abilities may have AP costs, cooldowns, targeting rules, and special effects. Read the preview. Then abuse them responsibly.',
    autoAdvance: true,
  },
  {
    id: 'tut_ability_action',
    section: 'J',
    title: 'CLASS ABILITIES',
    body: 'Now use the highlighted ability. Tap it, then pick a valid target.',
    highlightTargets: ['ui:ability:heal'],
    allowedActions: [A.SELECT_UNIT, A.ABILITY],
    requiredAction: { type: A.ABILITY },
    successText: 'Abilities are the spice of tactical life.',
    optionalHint: 'Tap the highlighted ability button, then choose a target.',
  },

  // ============================================================
  // SECTION K — UTILITIES + DESTRUCTIBLE TERRAIN
  // ============================================================
  {
    id: 'tut_utility_intro',
    section: 'K',
    title: 'UTILITIES',
    body: 'Utilities give soldiers additional tactical options. Your soldier is carrying a Grenade.',
    highlightTargets: ['ui:utility'],
    optionalHint: 'The Grenade is a Utility — found with the abilities in the bottom bar.',
  },
  {
    id: 'tut_grenade_intro',
    section: 'K',
    title: 'GRENADE',
    body: 'Grenade: 1 AP, limited use, area damage, terrain damage, Armor Shred, and friendly fire included at no additional charge.',
    autoAdvance: true,
  },
  {
    id: 'tut_grenade_targeting',
    section: 'K',
    title: 'AREA TARGETING',
    body: 'There\'s an enemy behind destructible cover. Preview the Grenade on the impact tile. The preview shows affected units, affected terrain, and any friendly units in the blast.',
    highlightTargets: ['unit:tut_grunt_3', 'tile:cover', 'ui:utility'],
    allowedActions: [A.SELECT_UNIT, A.GRENADE],
    requiredAction: { type: A.GRENADE },
    successText: 'Cover can be destroyed. The battlefield is not sacred.',
    optionalHint: 'Tap the Grenade, then tap the tile where the enemy and cover are.',
  },
  {
    id: 'tut_terrain_destruction',
    section: 'K',
    title: 'TERRAIN DESTRUCTION',
    body: 'Cover can be destroyed. The battlefield is not sacred. If a wall is causing problems, sometimes the correct tactical solution is: REMOVE WALL.',
    autoAdvance: true,
  },
  {
    id: 'tut_siege_note',
    section: 'K',
    title: 'SIEGE TERRAIN',
    body: 'Some massive structural blockers require much stronger Siege-level effects. Your normal grenade does not solve every architectural disagreement.',
    autoAdvance: true,
  },

  // ============================================================
  // SECTION L — OVERWATCH
  // ============================================================
  {
    id: 'tut_overwatch_intro',
    section: 'L',
    title: 'OVERWATCH',
    body: 'Sometimes you don\'t want to shoot now. You want to shoot the alien when IT makes the mistake of moving later.',
    highlightTargets: ['ui:overwatch'],
    optionalHint: 'Overwatch is the eye icon in the bottom bar.',
  },
  {
    id: 'tut_overwatch_rules',
    section: 'L',
    title: 'OVERWATCH',
    body: 'Overwatch costs 1 AP. You need ammunition. A valid moving enemy during the Enemy Phase may trigger the shot.',
    autoAdvance: true,
  },
  {
    id: 'tut_overwatch_action',
    section: 'L',
    title: 'OVERWATCH',
    body: 'Activate Overwatch with the highlighted soldier.',
    highlightTargets: ['unit:tut_soldier_2', 'ui:overwatch'],
    allowedActions: [A.SELECT_UNIT, A.OVERWATCH],
    requiredAction: { type: A.OVERWATCH },
    successText: 'Good. Now end the Player Phase. We wait. Briefly.',
    optionalHint: 'Select the soldier, then tap Overwatch.',
  },
  {
    id: 'tut_overwatch_end_phase',
    section: 'L',
    title: 'END PHASE',
    body: 'Good. Now end the Player Phase. We wait. Briefly. This is still supposed to be a fast game.',
    highlightTargets: ['ui:end_turn'],
    allowedActions: [A.END_PHASE],
    requiredAction: { type: A.END_PHASE },
    successText: 'There it is. Overwatch fires automatically when a valid enemy moves.',
    optionalHint: 'Tap End in the top-right to end your phase.',
  },
  {
    id: 'tut_overwatch_success',
    section: 'L',
    title: 'OVERWATCH',
    body: 'There it is. Overwatch fires automatically when a valid enemy moves through the reaction opportunity.',
    autoAdvance: true,
  },
  {
    id: 'tut_sprint_note',
    section: 'L',
    title: 'SPRINTING',
    body: 'If an enemy is taking its second movement action, they\'re Sprinting. Overwatch against a Sprinting target deals reduced damage. Apparently moving very quickly is a recognized defensive strategy.',
    autoAdvance: true,
  },

  // ============================================================
  // SECTION M — ENEMY PHASE
  // ============================================================
  {
    id: 'tut_enemy_phase_explain',
    section: 'M',
    title: 'ENEMY PHASE',
    body: 'During the Enemy Phase, aliens use the same battlefield. They move, attack, use abilities, reinforce, flank you, and occasionally make you reconsider every decision that brought you here. Then it\'s your turn again — Player Phase.',
    autoAdvance: true,
  },

  // ============================================================
  // SECTION N — STATUS EFFECTS
  // ============================================================
  {
    id: 'tut_status_intro',
    section: 'N',
    title: 'STATUS EFFECTS',
    body: 'Statuses can be applied by abilities, grenades, and enemy attacks. Tap units and read their statuses — the game tells you what\'s ruining their day. SUPPRESSED: reduced damage, cannot Overwatch. BURNING: damage after meaningful actions. STUNNED: loses AP on next activation. MARKED: next damaging attack gets bonus damage. DISRUPTED: abilities cost additional AP.',
    optionalHint: 'Tap any unit to inspect its statuses.',
  },
  {
    id: 'tut_status_recap',
    section: 'N',
    title: 'STATUS EFFECTS',
    body: 'You don\'t need to memorize everything right now. Tap units and read their statuses. The game will tell you what\'s ruining their day.',
    autoAdvance: true,
  },

  // ============================================================
  // SECTION O — DOWNED + REVIVE
  // ============================================================
  {
    id: 'tut_downed_event',
    section: 'O',
    title: 'UH OH.',
    body: 'One of your soldiers just hit 0 HP. Don\'t panic. Yet.',
    autoAdvance: true,
  },
  {
    id: 'tut_downed_explain',
    section: 'O',
    title: 'DOWNED',
    body: 'Soldiers do not immediately die at 0 HP. They become Downed. A Downed soldier cannot act and has limited time before becoming Injured.',
    highlightTargets: ['unit:tut_soldier_1'],
    optionalHint: 'The Downed soldier is lying on the ground with a bleed-out counter.',
  },
  {
    id: 'tut_bleedout',
    section: 'O',
    title: 'BLEEDOUT',
    body: 'See the bleed-out counter? When it reaches zero, the soldier becomes Injured after the mission. You can spend Credits to patch them up later. There is no permanent soldier death. We are cruel. We are not monsters.',
    autoAdvance: true,
  },
  {
    id: 'tut_revive_action',
    section: 'O',
    title: 'REVIVE',
    body: 'Move another soldier adjacent to the Downed one, then use Revive. The revived soldier comes back with some HP but 0 AP for the rest of this phase.',
    highlightTargets: ['unit:tut_soldier_1', 'unit:tut_soldier_2', 'ui:ability:heal'],
    allowedActions: [A.SELECT_UNIT, A.CONFIRM_MOVE, A.REVIVE],
    requiredAction: { type: A.REVIVE },
    successText: 'He\'s back. Barely.',
    optionalHint: 'Move next to the Downed soldier and use Revive.',
  },
  {
    id: 'tut_revive_success',
    section: 'O',
    title: 'REVIVED',
    body: 'He\'s back. Barely. The revived soldier returns with existing configured HP and 0 AP for the current phase.',
    autoAdvance: true,
  },
  {
    id: 'tut_injury_explain',
    section: 'O',
    title: 'INJURY',
    body: 'If a soldier bleeds out, they become Injured after the mission. You can spend Credits to patch them up. There is no permanent soldier death under the current campaign rules. We are cruel. We are not monsters.',
    autoAdvance: true,
  },

  // ============================================================
  // SECTION P — TACTICAL LENS
  // ============================================================
  {
    id: 'tut_lens_intro',
    section: 'P',
    title: 'TACTICAL LENS',
    body: 'Feeling overwhelmed? Use this.',
    highlightTargets: ['ui:lens'],
    optionalHint: 'The Tactical Lens button is in the top bar.',
  },
  {
    id: 'tut_lens_explain',
    section: 'P',
    title: 'TACTICAL LENS',
    body: 'It shows directional cover, enemy ranges, known lines of sight, the objective, reinforcement countdown and zones, destructible terrain, and hazard warnings. It shows what your squad knows. It does not reveal the future. Unfortunately, we have not unlocked time travel.',
    autoAdvance: true,
  },
  {
    id: 'tut_lens_toggle',
    section: 'P',
    title: 'TACTICAL LENS',
    body: 'Turn the Tactical Lens on. You can turn it back off after.',
    highlightTargets: ['ui:lens'],
    allowedActions: [A.TACTICAL_LENS_ON],
    requiredAction: { type: A.TACTICAL_LENS_ON },
    successText: 'There you go. Full battlefield awareness, on demand.',
    optionalHint: 'Tap the Lens button to turn it on.',
  },

  // ============================================================
  // SECTION Q — OVERWATCH ALL
  // ============================================================
  {
    id: 'tut_overwatch_all_intro',
    section: 'Q',
    title: 'OVERWATCH ALL',
    body: 'If several soldiers are ready and you\'re happy with their positions: OVERWATCH ALL.',
    highlightTargets: ['ui:overwatch_all'],
    optionalHint: 'Overwatch All is the eye button in the top bar.',
  },
  {
    id: 'tut_overwatch_all_explain',
    section: 'Q',
    title: 'OVERWATCH ALL',
    body: 'This attempts to put every eligible soldier into Overwatch using the normal rules. One button. Less tapping. You\'re welcome.',
    autoAdvance: true,
  },
  {
    id: 'tut_overwatch_all_action',
    section: 'Q',
    title: 'OVERWATCH ALL',
    body: 'Two soldiers are eligible. Hit OVERWATCH ALL.',
    highlightTargets: ['ui:overwatch_all'],
    allowedActions: [A.OVERWATCH_ALL],
    requiredAction: { type: A.OVERWATCH_ALL },
    successText: 'The whole squad is on overwatch. Now they just need someone to walk into it.',
    optionalHint: 'Tap the Overwatch All button in the top bar.',
  },

  // ============================================================
  // SECTION R — COMMANDER PREVIEW
  // ============================================================
  {
    id: 'tut_commander_intro',
    section: 'R',
    title: 'COMMANDER',
    body: 'Later, you can unlock Commander abilities from the Armory. Commander commands operate above your individual soldiers. For this tutorial, you get a temporary free look at one: TACTICAL ADVANCE.',
    highlightTargets: ['ui:commander'],
    optionalHint: 'The Commander button is in the top bar.',
  },
  {
    id: 'tut_commander_tactical_advance',
    section: 'R',
    title: 'TACTICAL ADVANCE',
    body: 'TACTICAL ADVANCE grants +1 AP to one soldier for the current Player Phase. For this tutorial demonstration, it\'s marked TUTORIAL — FREE. Do not alter the production 25 Credit cost outside the tutorial.',
    autoAdvance: true,
  },
  {
    id: 'tut_commander_action',
    section: 'R',
    title: 'COMMANDER',
    body: 'Open Commander, choose Tactical Advance, target a friendly soldier, and confirm. The +1 AP is real — granted through the production effect architecture.',
    highlightTargets: ['ui:commander'],
    allowedActions: [A.COMMANDER_USE],
    requiredAction: { type: A.COMMANDER_USE, filter: { skillId: 'player_tactical_advance' } },
    successText: 'Commander abilities can bend the normal tactical tempo. Useful. Also usually expensive.',
    optionalHint: 'Tap Commander, pick Tactical Advance, target a soldier, confirm.',
  },
  {
    id: 'tut_commander_success',
    section: 'R',
    title: 'COMMANDER',
    body: 'Commander abilities can bend the normal tactical tempo. Useful. Also usually expensive. Try not to solve every problem by throwing your retirement fund at it. (Tutorial-only Commander access is removed after this mission — it never leaks into your campaign.)',
    autoAdvance: true,
  },

  // ============================================================
  // SECTION S — END PHASE
  // ============================================================
  {
    id: 'tut_end_phase_explain',
    section: 'S',
    title: 'END PHASE',
    body: 'When you\'re finished moving, shooting, exploding, healing, reloading, and reconsidering your life choices: END PHASE.',
    highlightTargets: ['ui:end_turn'],
    optionalHint: 'End Phase is the button in the top-right.',
  },
  {
    id: 'tut_end_phase_rule',
    section: 'S',
    title: 'END PHASE',
    body: 'Unused normal AP is lost. Temporary effects may expire according to their rules. Then the aliens get their turn.',
    autoAdvance: true,
  },

  // ============================================================
  // SECTION T — FINAL FREE-FORM FIGHT
  // ============================================================
  {
    id: 'tut_final_free_form',
    section: 'T',
    title: 'THAT\'S ENOUGH HAND-HOLDING.',
    body: 'You\'ve got: movement, AP, directional cover, flanking, attacks, Armor, Armor Shred, Reloading, abilities, Utilities, destructible terrain, Overwatch, statuses, Revive, Tactical Lens, and Commander commands. That is enough information to become dangerous. Finish the mission. No forced actions from here — the controls are yours.',
    // Sentinel requiredAction — blocks the Continue button and manual advance.
    // signalFinalVictory() calls completeCurrentStep() directly to satisfy it.
    requiredAction: { type: '__final_victory__' },
    optionalHint: 'Defeat all the remaining aliens to finish the tutorial.',
  },

  // ============================================================
  // SECTION V — TUTORIAL COMPLETION
  // ============================================================
  {
    id: 'tut_victory',
    section: 'V',
    title: 'TUTORIAL COMPLETE',
    body: 'Look at that. Humanity may actually survive. Probably. From here: run missions, level soldiers, earn Credits and alien resources, upgrade weapons, upgrade armor, try Utilities, unlock Commander abilities, and seriously, eventually upgrade your Squad Size. If something gets difficult: run easier missions, get stronger, come back. Progress only goes forward. Now go make some aliens regret crossing interstellar space.',
    completionAction: 'start_campaign',
  },
];

export function getStepById(id) {
  return TUTORIAL_STEPS.find((s) => s.id === id) || null;
}

export function getStepIndex(id) {
  return TUTORIAL_STEPS.findIndex((s) => s.id === id);
}