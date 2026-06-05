import type { Express } from "express";
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { storage } from "./storage";
import { insertMonthlyDataSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // GET all monthly data
  app.get("/api/monthly-data", async (_req, res) => {
    try {
      const data = await storage.getAllMonthlyData();
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch monthly data" });
    }
  });

  // GET monthly data for a specific rep
  app.get("/api/monthly-data/:repName", async (req, res) => {
    try {
      const data = await storage.getMonthlyDataForRep(req.params.repName);
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch rep data" });
    }
  });

  // POST upsert monthly data entry
  app.post("/api/monthly-data", async (req, res) => {
    try {
      const parsed = insertMonthlyDataSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      const result = await storage.upsertMonthlyData(parsed.data);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: "Failed to save monthly data" });
    }
  });

  // DELETE a monthly data entry
  app.delete("/api/monthly-data/:repName/:year/:month", async (req, res) => {
    try {
      const { repName, year, month } = req.params;
      await storage.deleteMonthlyData(repName, parseInt(year), parseInt(month));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete monthly data" });
    }
  });

  return httpServer;
}
