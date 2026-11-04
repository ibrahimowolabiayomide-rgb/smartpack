import { timestamp } from 'drizzle-orm/pg-core';

/** All timestamps are timestamptz: stored as UTC instants, rendered in the viewer's zone. */
export const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const createdAt = () => timestamptz('created_at').notNull().defaultNow();
export const updatedAt = () => timestamptz('updated_at').notNull().defaultNow();
