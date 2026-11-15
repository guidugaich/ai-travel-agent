import {
  computeLeaveBy,
  EVENT_KINDS,
  eventsOnDay,
  getNextEvent,
  setLocation,
  timeInZone,
  type Deps,
  type Result,
  type TimeError,
  type UserId,
} from "@ai-travel-agent/core";
import { z } from "zod";
import type { Tool } from "./loop.ts";

const zone = z.string().describe("An IANA timezone name, such as Asia/Kathmandu");

/** The tools the model can call for one user. Each is a thin wrapper over one core service. */
export function createTools(userId: UserId, deps: Deps): readonly Tool[] {
  return [
    defineTool({
      name: "time_in_zone",
      description:
        'The current local time and date in a timezone, for questions like "what time is it in Kathmandu?".',
      input: z.strictObject({ zone }),
      run: ({ zone }) => refuseTimeError(timeInZone(zone, deps)),
    }),
    defineTool({
      name: "set_my_location",
      description:
        "Records where the user says they are. A location they shared from their phone in the last 3 days takes priority, so check `inEffect` in the result before confirming.",
      input: z.strictObject({
        zone,
        place_name: z.string().min(1).describe("The place as the user named it, such as Kathmandu"),
      }),
      run: async ({ zone, place_name }) =>
        refuseTimeError(
          await setLocation(userId, { zone, placeName: place_name, source: "user_said" }, deps),
        ),
    }),
    defineTool({
      name: "get_next_event",
      description:
        'The user\'s next upcoming event, or the next of one kind ("my flight" is kind flight). Gives its id, and its times ready to repeat.',
      input: z.strictObject({
        kind: z.enum(EVENT_KINDS).exactOptional().describe("Only events of this kind"),
      }),
      run: async ({ kind }) => ({ ok: true, value: await getNextEvent(userId, kind, deps) }),
    }),
    defineTool({
      name: "events_on_day",
      description:
        "The user's events starting on a day. Pass the user's own word for the day; never work out a date yourself. If the result is ambiguous, ask which day they mean.",
      input: z.strictObject({
        day: z.string().describe("today, tomorrow, a weekday name such as friday, or YYYY-MM-DD"),
      }),
      run: async ({ day }) => ({ ok: true, value: await eventsOnDay(userId, day, deps) }),
    }),
    defineTool({
      name: "compute_leave_by",
      description:
        "When the user should leave for an event. Get event_id from get_next_event or events_on_day. If the result is need_transit_time, ask how long it takes them to get there.",
      input: z.strictObject({
        event_id: z.string(),
        transit_minutes: z
          .int()
          .nonnegative()
          .exactOptional()
          .describe("Only if the user just said how long it takes them to get there"),
      }),
      run: async ({ event_id, transit_minutes }) => ({
        ok: true,
        value: await computeLeaveBy(userId, event_id, transit_minutes, deps),
      }),
    }),
  ];
}

/** One zod schema both describes the arguments to the model and checks what it sends. */
function defineTool<Input extends z.ZodType>(spec: {
  readonly name: string;
  readonly description: string;
  readonly input: Input;
  readonly run: (
    input: z.output<Input>,
  ) => Result<unknown, string> | Promise<Result<unknown, string>>;
}): Tool {
  return {
    definition: {
      name: spec.name,
      description: spec.description,
      parameters: z.toJSONSchema(spec.input),
    },
    async run(args) {
      const parsed = spec.input.safeParse(args);
      if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error) };
      return spec.run(parsed.data);
    },
  };
}

function refuseTimeError<T>(result: Result<T, TimeError>): Result<T, string> {
  if (result.ok) return result;
  const { error } = result;
  return {
    ok: false,
    error:
      error.kind === "invalid_zone"
        ? `"${error.zone}" isn't an IANA timezone. Use a name such as Asia/Kathmandu.`
        : `Unexpected time error: ${error.kind}`,
  };
}
