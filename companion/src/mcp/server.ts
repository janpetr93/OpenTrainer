#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import * as z from 'zod/v4'
import { loadMmpView } from '../domain/mmpView.js'
import { LocalStore } from '../store/localStore.js'
import { resolveDataDir } from '../paths.js'

const stepSchema = z.object({
  type: z.enum(['warmup', 'steady', 'recovery', 'cooldown']),
  durationSec: z.number().positive(),
  targetWatts: z.number().nonnegative().nullable().optional(),
  percentFtp: z.number().min(0).max(300).nullable().optional(),
  zone: z.number().int().min(1).max(7).nullable().optional(),
})

function jsonResult(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  }
}

async function main(): Promise<void> {
  const dataDir = resolveDataDir()
  const store = new LocalStore(dataDir)
  await store.ensureReady()
  await store.backfillActivityMetrics()

  const server = new McpServer({
    name: 'open-trainer',
    version: '0.4.0',
  })

  server.registerPrompt(
    'plan_training_week',
    {
      title: 'Plan training week',
      description:
        'Workflow for planning a week: profile/FTP, activities, clear calendar range, create %FTP/zone workouts, schedule them.',
    },
    async () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              'Plan my next training week using OpenTrainer MCP tools.',
              '1) Call get_rider_profile. If FTP is null, ask me for FTP watts and call set_ftp.',
              '2) If Training Intent (intent) is null, ask once for goal (optional horizon/note and optional constraints: maxHardDaysPerWeek, preferredLongRideWeekday 0=Sun–6=Sat, constraintsNote) and call set_training_intent — or continue without Intent if I decline. Never invent a goal.',
              '3) Optionally call get_mmp for lifetime Mean Maximal Power / Estimated FTP context (cache refreshes when Activities are saved; empty until first Activity or manual Profile recompute).',
              '4) Ask what days/time I have available this week (do not assume; availability is not stored). Honor Intent constraints when set (max hard days, preferred long-ride weekday, constraintsNote).',
              '5) Call list_activities (pastDays 14) and list_scheduled_rides for the week window. Use Session Load / Session Adherence and ride outcomes (missed/skipped/completed) when present. Infer recent training emphasis from Activities (do not invent a stored phase).',
              '6) Call clear_scheduled_rides for that week’s since/until before replacing the plan.',
              '7) create_workout with Target Prescription: prefer percentFtp or zone (1–7 Coggan). Do not leave all targets null; absolute targetWatts only when I ask.',
              '8) create_scheduled_ride for each day (workoutId + startsAt ISO + purpose). Session Purpose is required in week planning: one short sentence on what the session is for (e.g. improve endurance, raise lactate threshold) — not Training Intent.',
              '9) Summarize the week with dates, workout names, Session Purpose, and resolved intensity (%FTP/zone), tied to Intent constraints + recent emphasis.',
            ].join('\n'),
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
        'Workflow for reviewing recent rides: profile/MMP, Session Load/Adherence, calendar outcomes → summarize compliance and propose Intent note or next-week adjustments.',
    },
    async () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              'Review my recent training using OpenTrainer MCP tools. Do not invent Activities.',
              '1) Call get_rider_profile (FTP, zones, Training Intent).',
              '2) Call get_mmp for Mean Maximal Power / Estimated FTP vs set FTP.',
              '3) Call list_activities (pastDays 14). For each ride note Session Purpose, Session Load (NP/IF/TSS, time-in-zone), and Session Adherence when present (completion + on-target %). Flag Free Rides vs planned rides.',
              '4) Call list_scheduled_rides for the same window (and a few days ahead). Note planned vs completed vs skipped; treat past planned-without-Activity as missed.',
              '5) Summarize: total TSS (when available), hard/easy balance, adherence trends, missed/skipped sessions, and fitness signal from MMP/Estimated FTP.',
              '6) Propose concrete next steps: optional set_training_intent note update, and/or what to change when planning the next week. Ask before writing Intent. Do not create Workouts or Scheduled Rides unless I ask.',
            ].join('\n'),
          },
        },
      ],
    }),
  )

  server.registerTool(
    'get_rider_profile',
    {
      description:
        'Get Rider Profile: FTP (watts), derived Coggan Power Zones (Z1–Z7), and Training Intent (goal/horizon/note + optional maxHardDaysPerWeek / preferredLongRideWeekday / constraintsNote, or null). Call before prescribing zone/%FTP workouts and when planning a week.',
      inputSchema: {},
    },
    async () => jsonResult(await store.getRiderProfile()),
  )

  server.registerTool(
    'get_mmp',
    {
      description:
        'Get cached Mean Maximal Power (lifetime best averages for fixed durations), Estimated FTP (20min MMP × 0.95) vs set FTP, and stale flag. Cache refreshes automatically when an Activity is saved; Profile UI Recompute remains as a manual override. Empty when never computed.',
      inputSchema: {},
    },
    async () => jsonResult(await loadMmpView(store)),
  )

  server.registerTool(
    'set_ftp',
    {
      description:
        'Set rider FTP in watts and recompute Coggan Power Zones. Use when profile FTP is null or the rider updates FTP. Required before zone/%FTP workouts resolve to watts.',
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
        'Set or clear durable Training Intent on the Rider Profile (goal + optional horizon/note + optional planning constraints: maxHardDaysPerWeek, preferredLongRideWeekday 0=Sun–6=Sat, constraintsNote). Use when intent is null during week planning or the rider updates direction. Pass clear:true to remove Intent. Does not store weekly availability or training phase.',
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
      if (!goal || !goal.trim()) {
        throw new Error('goal is required unless clear is true')
      }
      return jsonResult(
        await store.setTrainingIntent({
          goal,
          horizon: horizon ?? null,
          note: note ?? null,
          maxHardDaysPerWeek: maxHardDaysPerWeek ?? null,
          preferredLongRideWeekday: preferredLongRideWeekday ?? null,
          constraintsNote: constraintsNote ?? null,
        }),
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
      description:
        'Create a reusable Workout template. Prefer percentFtp or zone (1–7 Coggan) for intensity; absolute targetWatts optional. Do not omit all targets. After create, call create_scheduled_ride to place it on the Training Calendar.',
      inputSchema: {
        name: z.string().min(1).describe('Workout name'),
        steps: z
          .array(stepSchema)
          .min(1)
          .describe(
            'Ordered steps with durationSec; prescribe targetWatts, percentFtp, and/or zone',
          ),
      },
    },
    async ({ name, steps }) => {
      const workout = await store.createWorkout({
        name,
        steps: steps.map((s) => ({
          type: s.type,
          durationSec: s.durationSec,
          targetWatts: s.targetWatts ?? null,
          percentFtp: s.percentFtp ?? null,
          zone: (s.zone ?? null) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | null,
        })),
      })
      return jsonResult(workout)
    },
  )

  server.registerTool(
    'list_activities',
    {
      description:
        'List Activity records (completed rides) including specs, Power Profiles, Session Load (NP/IF/TSS + time-in-zone when FTP known), Session Adherence (completion + target band when a plan was followed), optional Session Purpose, and optional per-sample hrBpm / cadenceRpm / meterWatts when sensors were connected.',
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
    async ({ workoutId, startsAt, purpose }) =>
      jsonResult(
        await store.createScheduledRide({
          workoutId,
          startsAt,
          purpose: purpose ?? null,
        }),
      ),
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
    async ({ id, reason }) =>
      jsonResult(await store.skipScheduledRide(id, reason ?? null)),
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
    async ({ id, startsAt }) =>
      jsonResult(await store.rescheduleScheduledRide(id, startsAt)),
  )

  server.registerTool(
    'clear_scheduled_rides',
    {
      description:
        'Delete all Scheduled Rides with startsAt in [since, until]. Use before writing a new week plan.',
      inputSchema: {
        since: z.string().describe('ISO lower bound inclusive'),
        until: z.string().describe('ISO upper bound inclusive'),
      },
    },
    async ({ since, until }) => {
      const deleted = await store.clearScheduledRides({ since, until })
      return jsonResult({ deleted, since, until })
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
