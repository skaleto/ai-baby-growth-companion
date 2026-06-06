import type { CareLog } from "../types";
import { dedupeCareEventsForMerge } from "./careLogHelpers";

const positiveNumber = (value: number | undefined) =>
  value !== undefined && Number.isFinite(value) && value > 0 ? value : undefined;

const sumValues = (values: number[]) => values.reduce((total, value) => total + value, 0);

export const careLogWithEventStats = (log: CareLog): CareLog => {
  const events = dedupeCareEventsForMerge(log.events ?? [], log.date);
  const allMilkEvents = events.filter((event) => event.type === "milk");
  const milkEvents = allMilkEvents.filter((event) => positiveNumber(event.amountMl) !== undefined);
  const allSleepEvents = events.filter((event) => event.type === "sleep");
  const sleepEvents = allSleepEvents.filter((event) => positiveNumber(event.durationHours) !== undefined);
  const wakeEvents = events.filter((event) => event.type === "wake");
  const solidEvents = events.filter((event) => event.type === "solid" && event.note);
  const poopEvent = [...events].reverse().find((event) => event.type === "poop" && event.note);
  const temperatureEvent = [...events].reverse().find((event) => event.type === "temperature" && positiveNumber(event.temperature) !== undefined);
  const soothingEvent = [...events].reverse().find((event) => event.type === "soothing");

  return {
    ...log,
    events,
    milkMl: allMilkEvents.length ? (milkEvents.length ? Math.round(sumValues(milkEvents.map((event) => event.amountMl ?? 0))) : undefined) : log.milkMl,
    milkTimes: allMilkEvents.length ? (milkEvents.length || undefined) : log.milkTimes,
    sleepHours: allSleepEvents.length ? (sleepEvents.length ? Number(sumValues(sleepEvents.map((event) => event.durationHours ?? 0)).toFixed(1)) : undefined) : log.sleepHours,
    wakes: wakeEvents.length ? wakeEvents.length : log.wakes,
    soothing: soothingEvent ? "normal" : log.soothing,
    solids: solidEvents.length ? Array.from(new Set([...log.solids, ...solidEvents.map((event) => event.note!).filter(Boolean)])) : log.solids,
    poop: poopEvent?.note ?? log.poop,
    temperature: temperatureEvent?.temperature ?? log.temperature,
  };
};

export const careLogsWithEventStats = (logs: CareLog[]) => logs.map(careLogWithEventStats);
