import { users, monthlyData } from '@shared/schema';
import type { User, InsertUser, MonthlyData, InsertMonthlyData } from '@shared/schema';
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// Ensure monthly_data table exists
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS monthly_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rep_name TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    gross_revenue REAL NOT NULL DEFAULT 0,
    closed_resale INTEGER NOT NULL DEFAULT 0,
    total_closed INTEGER NOT NULL DEFAULT 0,
    commission REAL NOT NULL DEFAULT 0,
    employment_month INTEGER NOT NULL DEFAULT 1,
    comm_base REAL NOT NULL DEFAULT 0,
    guarantee REAL NOT NULL DEFAULT 0,
    resale_deduction_amt REAL NOT NULL DEFAULT 250
  )
`);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Monthly data
  getAllMonthlyData(): Promise<MonthlyData[]>;
  getMonthlyDataForRep(repName: string): Promise<MonthlyData[]>;
  upsertMonthlyData(data: InsertMonthlyData): Promise<MonthlyData>;
  deleteMonthlyData(repName: string, year: number, month: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.id, id)).get();
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.username, username)).get();
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return db.insert(users).values(insertUser).returning().get();
  }

  async getAllMonthlyData(): Promise<MonthlyData[]> {
    return db.select().from(monthlyData).all();
  }

  async getMonthlyDataForRep(repName: string): Promise<MonthlyData[]> {
    return db.select().from(monthlyData).where(eq(monthlyData.repName, repName)).all();
  }

  async upsertMonthlyData(data: InsertMonthlyData): Promise<MonthlyData> {
    const existing = db.select().from(monthlyData)
      .where(and(
        eq(monthlyData.repName, data.repName),
        eq(monthlyData.year, data.year),
        eq(monthlyData.month, data.month),
      )).get();

    if (existing) {
      sqlite.prepare(`
        UPDATE monthly_data SET gross_revenue=?, closed_resale=?, total_closed=?, commission=?, employment_month=?, comm_base=?, guarantee=?, resale_deduction_amt=?
        WHERE rep_name=? AND year=? AND month=?
      `).run(
        data.grossRevenue, data.closedResale, (data as any).totalClosed ?? 0,
        data.commission, data.employmentMonth,
        (data as any).commBase ?? 0, (data as any).guarantee ?? 0, (data as any).resaleDeductionAmt ?? 250,
        data.repName, data.year, data.month
      );
      return db.select().from(monthlyData)
        .where(and(
          eq(monthlyData.repName, data.repName),
          eq(monthlyData.year, data.year),
          eq(monthlyData.month, data.month),
        )).get()!;
    } else {
      return db.insert(monthlyData).values(data).returning().get();
    }
  }

  async deleteMonthlyData(repName: string, year: number, month: number): Promise<void> {
    db.delete(monthlyData).where(
      and(
        eq(monthlyData.repName, repName),
        eq(monthlyData.year, year),
        eq(monthlyData.month, month),
      )
    ).run();
  }
}

export const storage = new DatabaseStorage();
