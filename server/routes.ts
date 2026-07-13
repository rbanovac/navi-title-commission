import type { Express } from "express";
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { storage } from "./storage";
import { insertMonthlyDataSchema } from "@shared/schema";
import { randomBytes } from 'node:crypto';

// In-memory report store (TTL: 10 minutes)
const reportStore = new Map<string, { html: string; expires: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [id, r] of reportStore) {
    if (r.expires < now) reportStore.delete(id);
  }
}, 60_000);

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

  // POST report HTML — returns a short-lived ID for a real HTTPS URL
  app.post("/api/report", (req, res) => {
    const { html } = req.body as { html?: string };
    if (!html || typeof html !== "string") {
      return res.status(400).json({ error: "Missing html" });
    }
    const id = randomBytes(8).toString("hex");
    reportStore.set(id, { html, expires: Date.now() + 10 * 60_000 });
    res.json({ id });
  });

  // GET report by ID — serves raw HTML, opens directly in browser
  app.get("/api/report/:id", (req, res) => {
    const r = reportStore.get(req.params.id);
    if (!r || r.expires < Date.now()) {
      return res.status(404).send("Report expired or not found.");
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(r.html);
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
