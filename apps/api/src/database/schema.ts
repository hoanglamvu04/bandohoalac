import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';

// PostGIS geometry columns will use custom SQL types through migrations.
// This file defines relational ownership and is extended during implementation.

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const profiles = pgTable('profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  username: text('username').notNull().unique(),
  displayName: text('display_name'),
});

export const places = pgTable('places', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  slugIndex: index('places_slug_idx').on(table.slug),
}));
