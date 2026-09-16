/** Shared shapes used by the seat reservation API, the pages and the components. */

/** A single chair on a table. */
export type SeatRef = {
  category: string;
  table: string;
  seat: number;
};

export type AvailabilityTable = {
  name: string;
  /** First seat number this category may book on this table. */
  from: number;
  /** Last seat number this category may book on this table. */
  to: number;
  seatCount: number;
  /** Seat numbers that are already taken. */
  occupied: number[];
  availableCount: number;
};

export type AvailabilityCategory = {
  name: string;
  tables: AvailabilityTable[];
  seatCount: number;
  occupiedCount: number;
  /** Seats this category is allowed to fill in the hall. */
  quota: number;
};

export type Availability = {
  categories: AvailabilityCategory[];
  totalSeats: number;
  occupiedSeats: number;
  updatedAt: string;
};

/** A stored reservation. `table` is the table name (mapped from `table_name` in SQLite). */
export type Reservation = {
  id: number;
  inviteCode: string;
  name: string;
  email: string;
  category: string;
  table: string;
  seat: number;
  createdAt: string;
};

export type ReserveSeatInput = {
  name: string;
  email: string;
  category: string;
  table: string;
  seat: number;
};

export type ReserveSeatSuccess = {
  ok: true;
  reservation: Reservation;
  /** `/invite/<code>` */
  invitePath: string;
};

export type ReserveSeatFailure = {
  ok: false;
  error: string;
  /** True when somebody else took the seat first. */
  conflict?: boolean;
  /** Fresh availability so the client can repaint the seat grid immediately. */
  availability?: Availability;
};

export type ReserveSeatResult = ReserveSeatSuccess | ReserveSeatFailure;

/** Venue-wide seat counts shown in the hero summary. */
export type SeatSummary = {
  totalSeats: number;
  occupiedSeats: number;
  availableSeats: number;
};