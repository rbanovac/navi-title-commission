import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Monthly commission data per rep
export const monthlyData = sqliteTable("monthly_data", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  repName: text("rep_name").notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1–12
  grossRevenue: real("gross_revenue").notNull().default(0),
  closedResale: integer("closed_resale").notNull().default(0),
  // Computed & stored for fast charting
  commission: real("commission").notNull().default(0),
  employmentMonth: integer("employment_month").notNull().default(1),
});

export const insertMonthlyDataSchema = createInsertSchema(monthlyData).omit({ id: true });
export type InsertMonthlyData = z.infer<typeof insertMonthlyDataSchema>;
export type MonthlyData = typeof monthlyData.$inferSelect;
