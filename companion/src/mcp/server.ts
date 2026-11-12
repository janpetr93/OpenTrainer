#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import * as z from 'zod/v4'
import { loadMmpView } from '../domain/mmpView.js'
import { mergeTrainingIntent, type TrainingIntentPatch } from '../domain/trainingIntentPatch.js'
import { buildTrainingSummary, checkTrainingWeek } from '../domain/trainingSummary.js'
import type { PowerZoneId } from '../domain/cogganZones.js'
import type { WorkoutItem, WorkoutStep } from '../domain/types.js'
import { loadCompanionEnv } from '../env.js'
import {
  createWorkoutToolDescription,
  getFormToolDescription,
  getMmpToolDescription,
  planTrainingWeekPrompt,
  reviewTrainingPrompt,
  serverInstructions,
  workoutStepPercentFtpDescription,
  workoutStepZoneDescription,
} from './trainingPrompts.js'
import { readGoogleCalendarConfigFromEnv } from '../googleCalendar/config.js'
import { CalendarMirror } from '../googleCalendar/service.js'
import { LocalStore } from '../store/localStore.js'
import { resolveDataDir } from '../paths.js'

const stepSchema = z.object({
  type: z.enum(['warmup', 'steady', 'recovery', 'cooldown', 'open']),
  durationSec: z.number().positive(),
  targetWatts: z.number().nonnegative().nullable().optional(),
  percentFtp: z
    .number()
    .min(0)
    .max(300)
    .nullable()
    .optional()
    .describe(workoutStepPercentFtpDescription),
  zone: z
    .number()
    .int()
    .min(1)
    .max(7)
    .nullable()
    .optional()
    .describe(workoutStepZoneDescription),
})

const repeatSchema = z.object({
  type: z.literal('repeat'),
  count: z
    .number()
    .int()
    .min(2)
    .max(40)
    .describe('How many times to play steps. One level only; do not nest repeats.'),
  steps: z.array(stepSchema).min(1).max(6),
})

const workoutItemSchema = z.union([repeatSchema, stepSchema])

function mcpFlatStep(step: {
  type: 'warmup' | 'steady' | 'recovery' | 'cooldown' | 'open'
  durationSec: number
  targetWatts?: number | null
  percentFtp?: number | null
  zone?: number | null
}): WorkoutStep {
  return {
    type: step.type,
    durationSec: step.durationSec,
    targetWatts: step.targetWatts ?? null,
    percentFtp: step.percentFtp ?? null,
    zone: (step.zone ?? null) as PowerZoneId | null,
  }
}

function mcpWorkoutItem(item: {
  type: 'repeat' | 'warmup' | 'steady' | 'recovery' | 'cooldown' | 'open'
  count?: number
  steps?: Array<{
    type: 'warmup' | 'steady' | 'recovery' | 'cooldown' | 'open'
    durationSec: number
    targetWatts?: number | null
    percentFtp?: number | null
    zone?: number | null
  }>
  durationSec?: number
  targetWatts?: number | null
  percentFtp?: number | null
  zone?: number | null
}): WorkoutItem {
  if (item.type === 'repeat') {
    return {
      type: 'repeat',
      count: item.count ?? 0,
      steps: (item.steps ?? []).map(mcpFlatStep),
    }
  }
  return mcpFlatStep({
    type: item.type,
    durationSec: item.durationSec ?? 0,
    targetWatts: item.targetWatts,
    percentFtp: item.percentFtp,
    zone: item.zone,
  })
}

function jsonResult(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  }
}

function summaryBounds(
  pastDays: number,
  since?: string,
  until?: string,
): { since: string; until: string } {
  if (!Number.isFinite(pastDays) || pastDays < 0) {
    throw new Error('pastDays must be a non-negative number')
  }
  const untilMs = until ? Date.parse(until) : Date.now()
  if (Number.isNaN(untilMs)) throw new Error('Invalid until timestamp')
  let sinceMs = since ? Date.parse(since) : null
  if (sinceMs !== null && Number.isNaN(sinceMs)) {
    throw new Error('Invalid since timestamp')
  }
  const fromPast = Date.now() - pastDays * 24 * 60 * 60 * 1000
  sinceMs = sinceMs === null ? fromPast : Math.max(sinceMs, fromPast)
  return {
    since: new Date(sinceMs).toISOString(),
    until: new Date(untilMs).toISOString(),
  }
}

async function main(): Promise<void> {
  loadCompanionEnv()
  const dataDir = resolveDataDir()
  const store = new LocalStore(dataDir)
  await store.ensureReady()
  await store.backfillActivityMetrics()
  const port = Number(process.env.D100_COMPANION_PORT ?? 8787)
  const calendarMirror = new CalendarMirror({
    store,
    config: readGoogleCalendarConfigFromEnv(),
    companionOrigin:
      process.env.D100_COMPANION_ORIGIN ?? `http://127.0.0.1:${port}`,
    webOrigin: process.env.D100_WEB_ORIGIN ?? 'http://127.0.0.1:5173',
  })
  await calendarMirror.reconcile()

  const server = new McpServer(
    {
      name: 'open-trainer',
      version: '0.4.0',
    },
    { instructions: serverInstructions },
  )

  server.registerPrompt(
    'plan_training_week',
    {
      title: 'Plan training week',
      description:
        'Workflow for planning a week: profile, FTP, activities, intensity split, %FTP workouts, schedule them.',
    },
    async () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: planTrainingWeekPrompt,
          },
        },
      ],
    }),
  )

  server.registerPrompt(
    'review_training',
    {
      title: 'Review recent training',
      description:
        'Workflow for reviewing recent rides: profile, MMP, time-in-zone, adherence, and calendar outcomes. Proposes an Intent note. Does not write the calendar.',
    },
    async () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: reviewTrainingPrompt,
          },
        },
      ],
    }),
  )

  server.registerTool(
    'get_rider_profile',
    {
      description:
        'Get Rider Profile (UI: Profile): FTP (watts), LTHR (lthrBpm), Threshold Pace (runThresholdPaceSecPerKm), derived Coggan Power Zones (Z1–Z7), and Training Intent. Call before prescribing zone/%FTP workouts, computing run External Load, and when planning a week. If LTHR or Threshold Pace is null, ask once and call set_physiology.',
      inputSchema: {},
    },
    async () => jsonResult(await store.getRiderProfile()),
  )

  server.registerTool(
    'get_mmp',
    {
      description: getMmpToolDescription,
      inputSchema: {},
    },
    async () => jsonResult(await loadMmpView(store)),
  )

  server.registerTool(
    'get_form',
    {
      description: getFormToolDescription,
      inputSchema: {},
    },
    async () => {
      let cache = await store.getFormCache()
      if (!cache) cache = await store.recomputeForm()
      return jsonResult(cache)
    },
  )

  server.registerTool(
    'set_physiology',
    {
      description:
        'Set Rider Profile physiology. Omitted fields keep their current values; pass null to clear. ftpWatts (bike FTP), lthrBpm (LTHR), runThresholdPaceSecPerKm (run threshold as seconds per km, e.g. 293 for 4:53/km). Prefer this over set_ftp when setting multiple fields.',
      inputSchema: {
        ftpWatts: z
          .number()
          .positive()
          .max(2000)
          .nullable()
          .optional()
          .describe('FTP in watts; null clears'),
        lthrBpm: z
          .number()
          .min(80)
          .max(230)
          .nullable()
          .optional()
          .describe('Lactate-threshold heart rate bpm; null clears'),
        runThresholdPaceSecPerKm: z
          .number()
          .min(150)
          .max(900)
          .nullable()
          .optional()
          .describe('Threshold pace as seconds per km; null clears'),
      },
    },
    async ({ ftpWatts, lthrBpm, runThresholdPaceSecPerKm }) =>
      jsonResult(
        await store.setPhysiology({
          ftpWatts,
          lthrBpm,
          runThresholdPaceSecPerKm,
        }),
      ),
  )

  server.registerTool(
    'set_ftp',
    {
      description:
        'Alias for set_physiology with only ftpWatts. Prefer set_physiology when also setting LTHR or Threshold Pace. Required before zone/%FTP workouts resolve to watts.',
      inputSchema: {
        ftpWatts: z.number().positive().max(2000).describe('FTP in watts'),
      },
    },
    async ({ ftpWatts }) => jsonResult(await store.setFtp(ftpWatts)),
  )

  server.registerTool(
    'set_training_intent',
    {
      description:
        'Set or clear durable Training Intent on the Rider Profile. Omitted fields keep their current values; pass null to clear horizon, note, maxHardDaysPerWeek, preferredLongRideWeekday, or constraintsNote. goal is required only when Intent is currently null. Pass clear:true to remove Intent entirely. Does not store weekly availability or training phase.',
      inputSchema: {
        clear: z
          .boolean()
          .optional()
          .describe('If true, clear Training Intent (ignore other fields)'),
        goal: z
          .string()
          .min(1)
          .max(500)
          .optional()
          .describe('Training goal, e.g. raise FTP / climbing'),
        horizon: z
          .string()
          .max(200)
          .nullable()
          .optional()
          .describe('Optional free-text horizon, e.g. May gran fondo'),
        note: z
          .string()
          .max(1000)
          .nullable()
          .optional()
          .describe('Optional override note the AI would not infer from history'),
        maxHardDaysPerWeek: z
          .number()
          .int()
          .min(0)
          .max(7)
          .nullable()
          .optional()
          .describe('Optional max hard sessions per week'),
        preferredLongRideWeekday: z
          .number()
          .int()
          .min(0)
          .max(6)
          .nullable()
          .optional()
          .describe('Optional preferred long-ride weekday (0=Sun … 6=Sat)'),
        constraintsNote: z
          .string()
          .max(1000)
          .nullable()
          .optional()
          .describe('Optional equipment / injury / schedule caveats'),
      },
    },
    async ({
      clear,
      goal,
      horizon,
      note,
      maxHardDaysPerWeek,
      preferredLongRideWeekday,
      constraintsNote,
    }) => {
      if (clear) {
        return jsonResult(await store.setTrainingIntent(null))
      }
      const profile = await store.getRiderProfile()
      const patch: TrainingIntentPatch = {}
      if (goal !== undefined) patch.goal = goal
      if (horizon !== undefined) patch.horizon = horizon
      if (note !== undefined) patch.note = note
      if (maxHardDaysPerWeek !== undefined) {
        patch.maxHardDaysPerWeek = maxHardDaysPerWeek
      }
      if (preferredLongRideWeekday !== undefined) {
        patch.preferredLongRideWeekday = preferredLongRideWeekday
      }
      if (constraintsNote !== undefined) patch.constraintsNote = constraintsNote
      return jsonResult(
        await store.setTrainingIntent(mergeTrainingIntent(profile.intent, patch)),
      )
    },
  )

  server.registerTool(
    'list_workouts',
    {
      description: 'List saved Workout templates (interval plans).',
      inputSchema: {},
    },
    async () => {
      const workouts = await store.listWorkouts()
      return jsonResult({ count: workouts.length, workouts })
    },
  )

  server.registerTool(
    'create_workout',
    {
      description: createWorkoutToolDescription,
      inputSchema: {
        name: z
          .string()
          .min(1)
          .describe(
            'Workout name by content only (e.g. “VO2 5×3 min”); do not include weekday or date',
          ),
        steps: z
          .array(workoutItemSchema)
          .min(1)
          .describe(
            'Ordered steps. Quality intensity is percentFtp. zone only for 1-2. Use type "repeat" for repeated inner steps.',
          ),
      },
    },
    async ({ name, steps }) => {
      const workout = await store.createWorkout({
        name,
        steps: steps.map((step) => mcpWorkoutItem(step)),
      })
      return jsonResult(workout)
    },
  )

  server.registerTool(
    'get_training_summary',
    {
      description:
        'Planning read of recent Activities without 1 Hz Power Profiles. Each ride has kind (easy/moderate/hard from the planned Workout, or from Z4–Z7 time on a Free Ride), Session Load, adherence, and compact Workout steps. rollup has tssSum, easySec (zones 1+2), moderateSec (zone 3), thresholdSec (zone 4), aboveSec (zones 5–7), hardSessionCount, missedCount, and lastHard.work (plannedWatts and averageWatts of the main hard efforts). When averageWatts is at or above plannedWatts, add a repeat or minutes at the same percent. When it is lower, keep the percent and do not add a repeat. Do not lower the percent because targetAdherence is low. adherence.intensityPercent appears when the rider changed Ride Intensity mid-ride (80 = asked for 80% of the planned watts); targetAdherence is then scored against those lower targets, and lastHard.work still compares with the original plan. Use this instead of list_activities when planning or reviewing a week.',
      inputSchema: {
        pastDays: z.number().nonnegative().default(14),
        since: z.string().optional().describe('ISO lower bound'),
        until: z.string().optional().describe('ISO upper bound'),
      },
    },
    async ({ pastDays, since, until }) => {
      const bounds = summaryBounds(pastDays, since, until)
      const profile = await store.getRiderProfile()
      const activities = await store.listActivities({
        since: bounds.since,
        until: bounds.until,
      })
      const workouts = await store.listWorkouts()
      const scheduledRides = await store.listScheduledRides(bounds)
      const summary = buildTrainingSummary({
        ftpWatts: profile.ftpWatts,
        activities: activities.map((activity) => ({
          id: activity.id,
          startedAt: activity.startedAt,
          durationSec: activity.durationSec,
          purpose: activity.purpose,
          averagePowerWatts: activity.averagePowerWatts,
          workoutId: activity.workoutId,
          sessionLoad: activity.sessionLoad,
          sessionAdherence: activity.sessionAdherence,
          achievedPowerProfile: activity.achievedPowerProfile,
        })),
        workouts: workouts.map((workout) => ({
          id: workout.id,
          name: workout.name,
          steps: workout.steps,
        })),
        scheduledRides: scheduledRides.map((ride) => ({
          id: ride.id,
          startsAt: ride.startsAt,
          status: ride.status,
          missed: ride.missed,
          purpose: ride.purpose,
          workoutId: ride.workoutId,
        })),
      })
      return jsonResult({ ...bounds, ftpWatts: profile.ftpWatts, ...summary })
    },
  )

  server.registerTool(
    'list_activities',
    {
      description:
        'List Activity records including 1 Hz Power Profiles. Prefer get_training_summary for week planning. Includes Session Load (NP/IF/TSS + time-in-zone when FTP known), Session Adherence (with intensityPercent when the rider changed Ride Intensity), optional targetPowerProfile (targets the rider actually asked for), optional Session Purpose, and optional per-sample hrBpm / cadenceRpm / meterWatts.',
      inputSchema: {
        pastDays: z.number().nonnegative().default(14),
        since: z.string().optional(),
        until: z.string().optional(),
      },
    },
    async ({ pastDays, since, until }) => {
      const activities = await store.listActivities({ pastDays, since, until })
      return jsonResult({ count: activities.length, activities })
    },
  )

  server.registerTool(
    'list_scheduled_rides',
    {
      description:
        'List Scheduled Rides on the Training Calendar in a time range. Includes Session Purpose, status (planned/completed/skipped), activityId when completed, skipReason when skipped, and derived missed (planned + startsAt in the past).',
      inputSchema: {
        since: z.string().optional().describe('ISO lower bound'),
        until: z.string().optional().describe('ISO upper bound'),
      },
    },
    async ({ since, until }) => {
      const scheduledRides = await store.listScheduledRides({ since, until })
      return jsonResult({ count: scheduledRides.length, scheduledRides })
    },
  )

  server.registerTool(
    'create_scheduled_ride',
    {
      description:
        'Place an existing Workout on the Training Calendar at startsAt (ISO datetime). Include Session Purpose (purpose): short coaching rationale for what this session is for. Required to finish a week plan after create_workout.',
      inputSchema: {
        workoutId: z.string().min(1),
        startsAt: z.string().min(1).describe('ISO datetime'),
        purpose: z
          .string()
          .min(1)
          .max(500)
          .optional()
          .describe(
            'Session Purpose — what this ride is for (e.g. improve endurance). Not Training Intent.',
          ),
      },
    },
    async ({ workoutId, startsAt, purpose }) => {
      const scheduledRide = await store.createScheduledRide({
        workoutId,
        startsAt,
        purpose: purpose ?? null,
      })
      await calendarMirror.reconcile()
      return jsonResult(scheduledRide)
    },
  )

  server.registerTool(
    'delete_scheduled_ride',
    {
      description: 'Delete one Scheduled Ride by id.',
      inputSchema: { id: z.string().min(1) },
    },
    async ({ id }) => {
      const ok = await store.deleteScheduledRide(id)
      if (!ok) throw new Error(`Scheduled Ride not found: ${id}`)
      await calendarMirror.reconcile()
      return jsonResult({ ok: true, id })
    },
  )

  server.registerTool(
    'skip_scheduled_ride',
    {
      description:
        'Mark a Scheduled Ride as skipped (not ridden). Optional short reason. Cannot skip a completed ride. Use instead of deleting when the miss should stay visible for review.',
      inputSchema: {
        id: z.string().min(1),
        reason: z
          .string()
          .max(500)
          .optional()
          .describe('Optional skip reason, e.g. travel / illness'),
      },
    },
    async ({ id, reason }) => {
      const scheduledRide = await store.skipScheduledRide(id, reason ?? null)
      await calendarMirror.reconcile()
      return jsonResult(scheduledRide)
    },
  )

  server.registerTool(
    'reschedule_scheduled_ride',
    {
      description:
        'Move a Scheduled Ride to a new startsAt (ISO). Clears skipped status back to planned. Cannot reschedule a completed ride.',
      inputSchema: {
        id: z.string().min(1),
        startsAt: z.string().min(1).describe('New ISO datetime'),
      },
    },
    async ({ id, startsAt }) => {
      const scheduledRide = await store.rescheduleScheduledRide(id, startsAt)
      await calendarMirror.reconcile()
      return jsonResult(scheduledRide)
    },
  )

  server.registerTool(
    'clear_scheduled_rides',
    {
      description:
        'Delete all Scheduled Rides with startsAt in [since, until]. Does not delete Blockers. When replacing a date range, also call clear_blockers.',
      inputSchema: {
        since: z.string().describe('ISO lower bound inclusive'),
        until: z.string().describe('ISO upper bound inclusive'),
      },
    },
    async ({ since, until }) => {
      const deleted = await store.clearScheduledRides({ since, until })
      await calendarMirror.reconcile()
      return jsonResult({ deleted, since, until })
    },
  )

  const blockerKindSchema = z.enum(['social', 'run', 'gym', 'swim'])

  server.registerTool(
    'list_blockers',
    {
      description:
        'List Blockers on the Training Calendar in a time range. A Blocker is social, or another sport (run, gym, swim). Sport Blockers have status planned/completed/skipped, derived missed when past planned, and trainingStressScore when completed (External Load). Social Blockers stay occupancy-only.',
      inputSchema: {
        since: z.string().optional().describe('ISO lower bound'),
        until: z.string().optional().describe('ISO upper bound'),
      },
    },
    async ({ since, until }) => {
      const blockers = await store.listBlockers({ since, until })
      return jsonResult({ count: blockers.length, blockers })
    },
  )

  server.registerTool(
    'create_blocker',
    {
      description:
        'Put a Blocker on the Training Calendar. kind is social, run, gym, or swim. A planned run, gym session, or swim is a Blocker, not a Workout and not a Scheduled Ride. Pass durationMin for a clock window, or allDay:true for a whole local day. label is an optional short name such as "dinner" or "easy 50 min". For spontaneous off-bike work already done, pass status "completed" with averagePaceSecPerKm and/or averageHrBpm (OpenTrainer computes External Load from Profile Threshold Pace / LTHR). trainingStressScore is a rare manual override only.',
      inputSchema: {
        kind: blockerKindSchema,
        startsAt: z.string().describe('ISO datetime'),
        allDay: z
          .boolean()
          .optional()
          .describe('True when the Blocker takes the whole local day'),
        durationMin: z
          .number()
          .int()
          .positive()
          .nullable()
          .optional()
          .describe('Minutes. Required unless allDay is true'),
        label: z.string().nullable().optional(),
        status: z
          .enum(['planned', 'completed', 'skipped'])
          .optional()
          .describe('Sport only; default planned'),
        trainingStressScore: z
          .number()
          .positive()
          .nullable()
          .optional()
          .describe('Manual External Load override only'),
        averagePaceSecPerKm: z
          .number()
          .positive()
          .nullable()
          .optional()
          .describe('Garmin avg pace as seconds per km'),
        averageHrBpm: z
          .number()
          .positive()
          .nullable()
          .optional()
          .describe('Garmin average heart rate'),
        effort: z.enum(['easy', 'steady', 'hard']).nullable().optional(),
      },
    },
    async ({
      kind,
      startsAt,
      allDay,
      durationMin,
      label,
      status,
      trainingStressScore,
      averagePaceSecPerKm,
      averageHrBpm,
      effort,
    }) => {
      const blocker = await store.createBlocker({
        kind,
        startsAt,
        allDay,
        durationMin,
        label,
        status,
        trainingStressScore,
        averagePaceSecPerKm,
        averageHrBpm,
        effort,
      })
      await calendarMirror.reconcile()
      return jsonResult({ blocker })
    },
  )

  server.registerTool(
    'complete_blocker',
    {
      description:
        'Mark a sport Blocker completed. Pass Garmin raw metrics: durationMin, averagePaceSecPerKm and/or averageHrBpm. OpenTrainer computes External Load (rTSS if pace+Threshold Pace, else hrTSS if HR+LTHR, else duration×effort). trainingStressScore is a rare manual override. May also update startsAt/label. Works retrospectively on missed Blockers. Recomputes Form.',
      inputSchema: {
        id: z.string(),
        trainingStressScore: z
          .number()
          .positive()
          .optional()
          .describe('Manual External Load override only'),
        startsAt: z.string().optional().describe('ISO datetime fact alignment'),
        allDay: z.boolean().optional(),
        durationMin: z.number().int().positive().nullable().optional(),
        label: z.string().nullable().optional(),
        averagePaceSecPerKm: z.number().positive().nullable().optional(),
        averageHrBpm: z.number().positive().nullable().optional(),
        effort: z.enum(['easy', 'steady', 'hard']).nullable().optional(),
      },
    },
    async ({
      id,
      trainingStressScore,
      startsAt,
      allDay,
      durationMin,
      label,
      averagePaceSecPerKm,
      averageHrBpm,
      effort,
    }) => {
      const blocker = await store.completeBlocker(id, {
        trainingStressScore,
        startsAt,
        allDay,
        durationMin,
        label,
        averagePaceSecPerKm,
        averageHrBpm,
        effort,
      })
      await calendarMirror.reconcile()
      return jsonResult({ blocker })
    },
  )

  server.registerTool(
    'skip_blocker',
    {
      description:
        'Skip a sport Blocker (did not happen). Clears External Load. Social Blockers cannot be skipped. Recomputes Form.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const blocker = await store.skipBlocker(id)
      await calendarMirror.reconcile()
      return jsonResult({ blocker })
    },
  )

  server.registerTool(
    'update_blocker',
    {
      description:
        'Change a Blocker. Omitted fields keep their current values. allDay:true clears durationMin. A durationMin sets a clock window.',
      inputSchema: {
        id: z.string(),
        kind: blockerKindSchema.optional(),
        startsAt: z.string().optional().describe('ISO datetime'),
        allDay: z.boolean().optional(),
        durationMin: z.number().int().positive().nullable().optional(),
        label: z.string().nullable().optional(),
      },
    },
    async ({ id, kind, startsAt, allDay, durationMin, label }) => {
      const blocker = await store.updateBlocker(id, {
        kind,
        startsAt,
        allDay,
        durationMin,
        label,
      })
      await calendarMirror.reconcile()
      return jsonResult({ blocker })
    },
  )

  server.registerTool(
    'delete_blocker',
    {
      description: 'Remove one Blocker from the Training Calendar.',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const deleted = await store.deleteBlocker(id)
      if (!deleted) throw new Error(`Blocker not found: ${id}`)
      await calendarMirror.reconcile()
      return jsonResult({ deleted: true, id })
    },
  )

  server.registerTool(
    'clear_blockers',
    {
      description:
        'Delete all Blockers with startsAt in [since, until]. Use together with clear_scheduled_rides when replacing a date range. Do not call this for a one-ride edit.',
      inputSchema: {
        since: z.string().describe('ISO lower bound inclusive'),
        until: z.string().describe('ISO upper bound inclusive'),
      },
    },
    async ({ since, until }) => {
      const deleted = await store.clearBlockers({ since, until })
      await calendarMirror.reconcile()
      return jsonResult({ deleted, since, until })
    },
  )

  server.registerTool(
    'check_training_week',
    {
      description:
        'Check Scheduled Rides in [since, until] against the planning rules. Returns violations: hard sessions over the cap (maxHardDaysPerWeek, else 2), hard sessions with no easy day between them, more than two sessions with steady work at 76-94% FTP, zone 3–7 steps, sprints ERG cannot hold, a Scheduled Ride that overlaps a Blocker, two Blockers that overlap, and a hard or moderate Scheduled Ride on a day with a run, gym, or swim Blocker. An easy ride may share that day when the windows do not overlap. Skipped rides are ignored. Call after writing a week and fix violations before summarizing.',
      inputSchema: {
        since: z.string().describe('ISO lower bound inclusive'),
        until: z.string().describe('ISO upper bound inclusive'),
      },
    },
    async ({ since, until }) => {
      const profile = await store.getRiderProfile()
      const rides = await store.listScheduledRides({ since, until })
      const blockers = await store.listBlockers({ since, until })
      const workouts = await store.listWorkouts()
      const byId = new Map(workouts.map((workout) => [workout.id, workout]))
      return jsonResult(
        checkTrainingWeek({
          ftpWatts: profile.ftpWatts,
          maxHardDaysPerWeek: profile.intent?.maxHardDaysPerWeek ?? null,
          blockers,
          rides: rides.map((ride) => {
            const workout = byId.get(ride.workoutId) ?? null
            return {
              id: ride.id,
              startsAt: ride.startsAt,
              status: ride.status,
              workout: workout
                ? { id: workout.id, name: workout.name, steps: workout.steps }
                : null,
            }
          }),
        }),
      )
    },
  )

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`OpenTrainer MCP ready (Local Store: ${dataDir})`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
