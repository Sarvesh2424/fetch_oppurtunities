const express = require("express");
const axios = require("axios");
const Parser = require("rss-parser");
const cors = require("cors");
const xml2js = require("xml2js");
const puppeteer = require("puppeteer");

const app = express();
const PORT = 5000;
app.use(cors());

const parser = new Parser({
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    Accept: "application/rss+xml,application/xml",
  },
});

const axiosConfig = {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    Accept: "application/json",
  },
};

const fetchLatestOpportunities = async () => {
  const opportunities = [];

  // ✅ Internships from Remotive
  try {
    const res = await axios.get(
      "https://remotive.com/api/remote-jobs?category=software-dev",
      axiosConfig
    );
    const allJobs = res.data.jobs; // <- FIXED

    const internships = allJobs
      .filter((job) => /internship|intern|junior|fresher/i.test(job.title))
      .map((job) => ({
        title: job.title,
        company: job.company_name,
        url: job.url,
        location: job.candidate_required_location || "Remote",
        description:
          job.description?.replace(/<[^>]+>/g, "").slice(0, 200) || "", // strip HTML
        tags: job.tags || [],
        type: "internship",
      }));

    opportunities.push(...internships);
    console.log("✅ Remotive internships fetched successfully");
  } catch (err) {
    console.error("❌ Remote ok fetch failed:", err.message);
  }

  try {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.goto("https://devpost.com/hackathons", {
      waitUntil: "domcontentloaded",
    });

    const hackathons = await page.evaluate(() => {
      const cards = document.querySelectorAll(".hackathon-tile");
      const data = [];

      cards.forEach((card) => {
        const title = card.querySelector(".title")?.textContent?.trim();
        const url =
          "https://devpost.com" + card.querySelector("a")?.getAttribute("href");
        const description = card
          .querySelector(".challenge-description")
          ?.textContent?.trim();
        const location =
          card.querySelector(".location")?.textContent?.trim() || "Online";

        if (title && url) {
          data.push({
            title,
            company: "Devpost",
            url,
            location,
            description,
            tags: ["hackathon"],
            type: "hackathon",
          });
        }
      });

      return data;
    });

    await browser.close();
    opportunities.push(...hackathons);
    console.log("✅ Devpost hackathons fetched successfully");
  } catch (err) {
    console.error("❌ Devpost RSS fetch failed:", err.message);
  }

  return opportunities;
};

app.get("/api/opportunities", async (req, res) => {
  try {
    const latest = await fetchLatestOpportunities();
    console.log(`Fetched ${latest.length} opportunities`);
    res.json({ success: true, count: latest.length, data: latest });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch latest opportunities" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
