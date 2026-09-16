/**
 * ============================================================
 * GUEST CATEGORIES, TABLES AND SEAT RANGES
 * ============================================================
 * The hall holds 200 seats. Each category owns its own table, and the High
 * Table is shared by the two family categories: seats 1 to 5 belong to the
 * groom's family, seats 6 to 10 belong to the bride's family.
 *
 * Those seat ranges are why one physical chair can never be booked twice. The
 * database enforces the same rule with UNIQUE (table_name, seat).
 *
 * Edit the numbers here and the dropdowns, the seat grid, the totals and the
 * server-side validation all follow.
 */

/** Seats in the hall. The plan below must add up to this number. */
export const HALL_CAPACITY = 200;

/** Inclusive seat numbers available to one category on one table. */
export type SeatRange = {
  from: number;
  to: number;
};

export type SeatingPlan = Record<string, { quota: number; tables: Record<string, SeatRange> }>;

export const SEATING_PLAN: SeatingPlan = {
  "Grooms Men": {
    quota: 10,
    tables: {
      "Grooms Men Table": { from: 1, to: 10 },
    },
  },
  Bridesmaid: {
    quota: 10,
    tables: {
      "Brides Maid Table": { from: 1, to: 10 },
    },
  },
  "Friends of the bride": {
    quota: 20,
    tables: {
      "Brides Friends Table": { from: 1, to: 20 },
    },
  },
  "Friends of the Groom": {
    quota: 20,
    tables: {
      "Grooms Friends Table": { from: 1, to: 20 },
    },
  },
  "Grooms Family and Friends": {
    quota: 40,
    tables: {
      "Groom Family Table": { from: 1, to: 35 },
      "High Table": { from: 1, to: 5 },
    },
  },
  "Brides Family and Friends": {
    quota: 100,
    tables: {
      "Brides Family Table": { from: 1, to: 95 },
      "High Table": { from: 6, to: 10 },
    },
  },
};

export type TableOption = {
  name: string;
  from: number;
  to: number;
  seatCount: number;
};

/** All invite categories, in the order they appear in the dropdown. */
export function getCategories(): string[] {
  return Object.keys(SEATING_PLAN);
}

/** Does this invite category exist? */
export function isKnownCategory(category: string): boolean {
  return Object.prototype.hasOwnProperty.call(SEATING_PLAN, category);
}

/** Seats this category is allowed to fill in the hall. */
export function getCategoryQuota(category: string): number {
  if (!isKnownCategory(category)) return 0;
  return SEATING_PLAN[category].quota;
}

/** The seat range for one category on one table, or null. */
export function getSeatRange(category: string, table: string): SeatRange | null {
  if (!isKnownCategory(category)) return null;
  return SEATING_PLAN[category].tables[table] ?? null;
}

/** Tables allocated to a category (empty array for an unknown category). */
export function getTablesForCategory(category: string): TableOption[] {
  if (!isKnownCategory(category)) return [];

  return Object.entries(SEATING_PLAN[category].tables).map(([name, range]) => ({
    name,
    from: range.from,
    to: range.to,
    seatCount: range.to - range.from + 1,
  }));
}

/** Does this table belong to this category? */
export function isKnownTable(category: string, table: string): boolean {
  return getSeatRange(category, table) !== null;
}

/** Number of seats this category may use on this table (0 when unknown). */
export function getSeatCount(category: string, table: string): number {
  const range = getSeatRange(category, table);
  return range ? range.to - range.from + 1 : 0;
}

/** The seat numbers this category may use on this table. */
export function getSeatNumbers(category: string, table: string): number[] {
  const range = getSeatRange(category, table);
  if (!range) return [];

  return Array.from({ length: range.to - range.from + 1 }, (_, index) => range.from + index);
}

/** Is this seat number inside what this category may book on this table? */
export function isValidSeat(category: string, table: string, seat: number): boolean {
  const range = getSeatRange(category, table);
  if (!range) return false;
  return Number.isInteger(seat) && seat >= range.from && seat <= range.to;
}

/** Seats this category can fill across all of its tables. */
export function getCategorySeatTotal(category: string): number {
  return getTablesForCategory(category).reduce((total, table) => total + table.seatCount, 0);
}

/** Every chair in the hall. */
export function getTotalSeats(): number {
  return getCategories().reduce((total, category) => total + getCategorySeatTotal(category), 0);
}

export type TableSummary = {
  /** Table name as printed on the seating chart. */
  name: string;
  /** Total chairs on this physical table. */
  seatCount: number;
  /** Categories that may book seats here. */
  categories: string[];
};

/** The physical tables in the hall, in the order they first appear. */
export function getTableSummaries(): TableSummary[] {
  const summaries = new Map<string, TableSummary>();

  for (const category of getCategories()) {
    for (const table of getTablesForCategory(category)) {
      const existing = summaries.get(table.name);

      if (existing) {
        existing.seatCount += table.seatCount;
        existing.categories.push(category);
        continue;
      }

      summaries.set(table.name, {
        name: table.name,
        seatCount: table.seatCount,
        categories: [category],
      });
    }
  }

  return Array.from(summaries.values());
}

/** Table + seat counts, handy for the couple's seating chart. */
export function getPlanSummary(): {
  category: string;
  table: string;
  seats: number;
  from: number;
  to: number;
}[] {
  return getCategories().flatMap((category) =>
    getTablesForCategory(category).map((table) => ({
      category,
      table: table.name,
      seats: table.seatCount,
      from: table.from,
      to: table.to,
    })),
  );
}

/**
 * Static checks for the seating plan. Returns a list of problems (empty when
 * everything adds up). Run at boot in development and covered by tests.
 */
export function validateSeatingPlan(): string[] {
  const issues: string[] = [];

  for (const category of getCategories()) {
    const plan = SEATING_PLAN[category];
    const seatTotal = getCategorySeatTotal(category);

    if (seatTotal !== plan.quota) {
      issues.push(
        `${category}: tables hold ${seatTotal} seats but the category quota is ${plan.quota}.`,
      );
    }

    for (const table of getTablesForCategory(category)) {
      if (table.from < 1 || table.to < table.from) {
        issues.push(`${category} on ${table.name}: seat range ${table.from} to ${table.to} is invalid.`);
      }
    }
  }

  const total = getTotalSeats();
  if (total !== HALL_CAPACITY) {
    issues.push(`The plan holds ${total} seats but the hall capacity is ${HALL_CAPACITY}.`);
  }

  // A physical chair is defined by its table and seat number, so the same
  // seat number must never be handed to two different categories.
  const claimedSeats = new Map<string, string>();

  for (const entry of getPlanSummary()) {
    for (let seat = entry.from; seat <= entry.to; seat += 1) {
      const key = `${entry.table}|${seat}`;
      const owner = claimedSeats.get(key);

      if (owner) {
        issues.push(
          `${entry.table} seat ${seat} is claimed by both ${owner} and ${entry.category}.`,
        );
        continue;
      }

      claimedSeats.set(key, entry.category);
    }
  }

  return issues;
}
