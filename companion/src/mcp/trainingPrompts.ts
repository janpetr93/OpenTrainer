/**
 * Coaching copy for week planning.
 * The model reads Training Summary (no 1 Hz samples) and may write a Workout Repeat.
 */

export const planTrainingWeekPrompt = [
  'Plan my next training week using OpenTrainer MCP tools.',
  '1) Call get_rider_profile. If FTP is null, ask me for FTP watts and call set_ftp.',
  '2) If Training Intent (intent) is null, ask once for goal (optional horizon/note and optional constraints: maxHardDaysPerWeek, preferredLongRideWeekday 0=Sun-6=Sat, constraintsNote) and call set_training_intent — or continue without Intent if I decline. Never invent a goal.',
  '3) Call get_mmp for Mean Maximal Power and Estimated FTP (20 min MMP × 0.95). Estimated FTP is a hint only. Do not call set_ftp from it. A 20 min best taken from an interval workout is not a paced test. If set FTP sits well above recent 8-20 min MMP, warn that ERG targets will feel too hard and ask before changing FTP.',
  '4) Ask what days and time I have available this week (do not assume; availability is not stored). Honor Intent constraints when set (maxHardDaysPerWeek, preferred long-ride weekday, constraintsNote).',
  '5) Call get_training_summary (pastDays 14). Do not call list_activities for planning; it includes 1 Hz Power Profiles. Use the rollup (tssSum, easySec, moderateSec, thresholdSec, aboveSec, hardSessionCount, missedCount) instead of summing by hand. moderateSec is zone 3 (75-90% FTP) from timeInZonesSec. If moderateSec dominates thresholdSec + aboveSec, this week gets easier, not another threshold day. If rollup.lastHard.targetAdherence is under 0.85, lower the next hard session percentFtp by about 5 points instead of adding a repeat. Read the Intent note for which week of a block this is. Do not invent a stored phase. Call list_scheduled_rides for the week you are about to write.',
  '6) Call clear_scheduled_rides for that week\'s since/until before replacing the plan.',
  '7) create_workout with the prescription rules below. Do not leave working steps without a target. absolute targetWatts only when I ask. For 30 s on / 15 s off, use a repeat item (type "repeat", count, inner steps) instead of unrolling every rep. Name the Workout by training content only (e.g. "4x8 min at 106% FTP") — never a weekday or calendar date; the Scheduled Ride startsAt already carries when it runs.',
  '8) create_scheduled_ride for each day (workoutId + startsAt ISO + purpose). Session Purpose is required in week planning: one short sentence on what the session is for (e.g. improve endurance, raise the top of threshold) — not Training Intent.',
  '9) Call check_training_week for that week\'s since/until. If violations is not empty, fix the Workouts or Scheduled Rides and call check_training_week again before you summarize.',
  '10) Summarize dates, workout names, Session Purpose, and percentFtp. If the week advances a block, offer a one-line Intent note such as "week 2 of 4x8". Ask before set_training_intent. Omitted fields on set_training_intent keep their current values, so a note update does not clear maxHardDaysPerWeek.',
  '',
  'Prescription:',
  '- Default load: at most two hard sessions. Leave an easy day between them. Every other ride stays under 75% FTP. A long Z2 ride is not hard because it is long. Honor maxHardDaysPerWeek when set; that cap counts sweet-spot sessions as hard.',
  '- When available time is about 6 hours or less: one HIT session, and the second hard session may be sweet spot at 88-94% FTP. When available time is clearly more than 6 hours and the cap allows: up to two HIT sessions and no sweet-spot day. Do not add a third day in the 76-94% band.',
  '- Place the long ride on preferredLongRideWeekday when set, at 60-70% FTP or zone 2.',
  '- Quality steps use percentFtp. A zone number resolves to the middle of that Coggan band, so zone 3 is not sweet spot (~82% FTP) and zone 5 is ~112% FTP, too hot for 8 min repeats. Use zone only for Z1-Z2. Never use zone 6 or 7: ERG cannot sprint.',
  '- Hold one HIT shape for 2-3 weeks. Add a repeat or minutes before raising percentFtp. Shapes: 4x8 min at 105-108% FTP with equal time recovery near 55% FTP; or 3 sets of 13x(30 s on / 15 s off) with 3 min easy between sets. Start 30 s on-steps at 120% FTP if the sustainable repeat power is unknown, and set 15 s off-steps at about half that percent. Those on-steps are a ceiling, not an all-out lock at 130% FTP.',
  '- Warm up and cool down in steps (there is no ramp step): for example 5 min at 50% FTP, 5 min at 65%, a few minutes near 80% before hard work, and a cooldown under 60% FTP.',
  '- Every 3rd or 4th week of the same HIT shape, cut duration by about a third and keep a single hard session. Record the block week in the Intent note.',
  '- Indoor: for any session with work above tempo, tell me to use a fan. ERG has no coasting, so the same percent feels harder than outdoors. Do not lower FTP by a fixed indoor percentage. Start a new interval shape at the low end of its range.',
].join('\n')

export const reviewTrainingPrompt = [
  'Review my recent training using OpenTrainer MCP tools. Do not invent Activities.',
  '1) Call get_rider_profile (FTP, zones, Training Intent).',
  '2) Call get_mmp for Mean Maximal Power and Estimated FTP vs set FTP. Estimated FTP (20 min MMP × 0.95) is individually unreliable. Do not call set_ftp unless I agree after a paced test. If set FTP sits well above recent 8-20 min MMP, say ERG targets will feel too hard.',
  '3) Call get_training_summary (pastDays 14). Do not call list_activities; it includes 1 Hz Power Profiles. For each ride note Session Purpose, kind (easy/moderate/hard), Session Load (NP/IF/TSS, timeInZonesSec), and adherence when present. Flag Free Rides (no workout) vs planned rides.',
  '4) The summary includes Scheduled Rides in that window (missed and skipped). Call list_scheduled_rides for a few days ahead. Note planned vs completed vs skipped; treat past planned-without-Activity as missed.',
  '5) Use the rollup instead of summing by hand: tssSum, easySec, moderateSec (zone 3, 75-90% FTP), thresholdSec, aboveSec, hardSessionCount, missedCount. A long Z2 ride is not hard. If moderateSec dominates thresholdSec + aboveSec, the next week should get easier, not another threshold day. If lastHard.targetAdherence is under 0.85, lower the next hard percentFtp instead of adding a repeat.',
  '6) Propose an Intent note update (block week, such as "week 2 of 4x8", or a recovery week) and what to change next week: at most two hard sessions, an easy day between them, other rides under 75% FTP. Ask before writing Intent. Omitted fields on set_training_intent keep their current values. Do not create Workouts or Scheduled Rides unless I ask.',
].join('\n')

export const createWorkoutToolDescription =
  'Create a Workout for a Scheduled Ride. Quality steps use percentFtp (sweet spot 88-94, threshold 95-100, 4x8 min 105-108). A zone number resolves to the Coggan band midpoint, so zone 3 is not sweet spot. Use zone only for Z1-Z2 easy spinning. Never use zone 6 or 7 (ERG cannot sprint). A repeat item ({type:"repeat", count, steps}) plays its inner steps count times — use that for 30s/15s instead of unrolling reps. Do not nest repeats. Do not omit all targets. absolute targetWatts only when the rider asks. Name by training content only — never a weekday or calendar date. After create, call create_scheduled_ride.'

export const getMmpToolDescription =
  'Get cached Mean Maximal Power (lifetime best averages for fixed durations), Estimated FTP (20 min MMP × 0.95) vs set FTP, and stale flag. Cache refreshes automatically when an Activity is saved; Profile UI Recompute remains as a manual override. Empty when never computed. Estimated FTP is a hint only. Do not call set_ftp from it unless the rider agrees after a paced test.'

export const workoutStepPercentFtpDescription =
  'Percent of FTP. Use this for sweet spot (88-94), threshold, and VO2. A 4x8 min repeat is 105-108.'

export const workoutStepZoneDescription =
  'Coggan zone. Use only 1-2 for easy spinning. A zone number resolves to the band midpoint. Do not use 6 or 7.'
