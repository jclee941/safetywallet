import { mapToRealtimeCheckinEvent, mapToWorkerId } from "./attendance-mappers";
import type {
  FasAttendanceRealtimeStats,
  FasRawAttendanceSummary,
} from "./types";

type SourceAccumulator = {
  successfulSources: string[];
  totalRows: number;
};

function finalizeSourceName(successfulSources: string[]): string {
  return successfulSources.length > 0 ? successfulSources.join("+") : "none";
}

export type RawSummaryAccumulator = SourceAccumulator & {
  mergedWorkerIds: Set<string>;
};

export function createRawSummaryAccumulator(): RawSummaryAccumulator {
  return {
    successfulSources: [],
    totalRows: 0,
    mergedWorkerIds: new Set<string>(),
  };
}

export function mergeRawSummaryRows(
  accumulator: RawSummaryAccumulator,
  rows: Array<Record<string, unknown>>,
  source: string,
): void {
  accumulator.totalRows += rows.length;
  for (const row of rows) {
    const workerId = mapToWorkerId(row);
    if (workerId) {
      accumulator.mergedWorkerIds.add(workerId);
    }
  }
  accumulator.successfulSources.push(source);
}

export function finalizeRawSummary(
  accumulator: RawSummaryAccumulator,
): FasRawAttendanceSummary {
  return {
    source: finalizeSourceName(accumulator.successfulSources),
    totalRows: accumulator.totalRows,
    checkins: accumulator.totalRows,
    uniqueWorkers: accumulator.mergedWorkerIds.size,
    workerIds: [...accumulator.mergedWorkerIds],
  };
}

export type RealtimeStatsAccumulator = SourceAccumulator & {
  checkedInWorkers: Set<string>;
  dedupCheckinEvents: Set<string>;
};

export function createRealtimeStatsAccumulator(): RealtimeStatsAccumulator {
  return {
    successfulSources: [],
    totalRows: 0,
    checkedInWorkers: new Set<string>(),
    dedupCheckinEvents: new Set<string>(),
  };
}

export function mergeRealtimeStatsRows(
  accumulator: RealtimeStatsAccumulator,
  rows: Array<Record<string, unknown>>,
  source: string,
): void {
  accumulator.totalRows += rows.length;
  for (const row of rows) {
    const checkinEvent = mapToRealtimeCheckinEvent(row);
    if (!checkinEvent) {
      continue;
    }
    accumulator.checkedInWorkers.add(checkinEvent.workerId);
    accumulator.dedupCheckinEvents.add(
      `${checkinEvent.workerId}|${checkinEvent.checkinKey}`,
    );
  }
  accumulator.successfulSources.push(source);
}

export function finalizeRealtimeStats(
  accumulator: RealtimeStatsAccumulator,
): FasAttendanceRealtimeStats {
  return {
    source: finalizeSourceName(accumulator.successfulSources),
    totalRows: accumulator.totalRows,
    checkedInWorkers: accumulator.checkedInWorkers.size,
    dedupCheckinEvents: accumulator.dedupCheckinEvents.size,
  };
}

export function finalizeRawRowsSource(successfulSources: string[]): string {
  return finalizeSourceName(successfulSources);
}
