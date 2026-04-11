const LOG_PREFIX = "[ZenAI:cs]";
const ROOT_ID = "zenai-check-fit-root";
const BUTTON_ID = "zenai-check-fit-button";
const STYLE_LINK_ID = "zenai-check-fit-style";

function log(...args) {
  // eslint-disable-next-line no-console
  console.log(LOG_PREFIX, ...args);
}

function sanitizeText(input, { maxLen = 12000 } = {}) {
  if (typeof input !== "string") return "";
  const cleaned = input
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

function textFrom(el) {
  if (!el) return "";
  const raw = (el.innerText || el.textContent || "").toString();
  return sanitizeText(raw);
}

function queryFirst(selectors, root = document) {
  for (const sel of selectors) {
    const el = root.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function queryText(selectors, root = document) {
  const el = queryFirst(selectors, root);
  return textFrom(el);
}

function parseJsonLdJobPosting() {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  for (const s of scripts) {
    const raw = s.textContent?.trim();
    if (!raw) continue;

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }

    const candidates = Array.isArray(data) ? data : [data];
    for (const item of candidates) {
      const stack = [item];
      while (stack.length) {
        const cur = stack.pop();
        if (!cur || typeof cur !== "object") continue;

        const type = cur['@type'];
        const isJobPosting =
          type === "JobPosting" ||
          (Array.isArray(type) && type.includes("JobPosting"));

        if (isJobPosting) {
          const title = sanitizeText(cur.title || cur.name || "", { maxLen: 200 });
          const company = sanitizeText(
            cur.hiringOrganization?.name || cur.organization?.name || cur.employmentUnit?.name || "",
            { maxLen: 200 }
          );
          const description = sanitizeText(cur.description || "", { maxLen: 12000 });

          const skills = [];
          const rawSkills = cur.skills || cur.qualifications || cur.experienceRequirements;
          if (typeof rawSkills === "string") skills.push(...rawSkills.split(/,|\n|\u2022/));
          if (Array.isArray(rawSkills)) skills.push(...rawSkills);

          return {
            title,
            company,
            description,
            skills: skills
              .map((x) => sanitizeText(String(x), { maxLen: 80 }))
              .filter(Boolean)
              .slice(0, 50),
            source: "jsonld",
          };
        }

        for (const v of Object.values(cur)) {
          if (v && typeof v === "object") stack.push(v);
        }
      }
    }
  }
  return null;
}

function looksLikeJobPageHeuristic() {
  const url = location.href;
  const urlHints = [/\/jobs?\b/i, /\/job\b/i, /viewjob/i, /careers?/i, /positions?/i, /vacanc/i, /opportunit/i];
  const urlScore = urlHints.some((r) => r.test(url)) ? 1 : 0;

  const hasApplyButton = !!document.querySelector(
    'a[href*="apply" i], button[aria-label*="apply" i], button:has(span:matches-css(case-insensitive, apply)), button:has(span:matches-css(case-insensitive, easy apply))'
  );

  const main = document.querySelector("main") || document.body;
  const h1 = queryText(["h1"], main);
  const hasJobKeywords = /job description|responsibilities|requirements|qualifications|what you will do|what you\u2019ll do/i.test(
    main?.innerText || ""
  );

  let score = 0;
  if (urlScore) score += 2;
  if (hasApplyButton) score += 2;
  if (h1 && h1.length >= 6) score += 1;
  if (hasJobKeywords) score += 2;

  return score >= 3;
}

function detectJobPage() {
  const jsonLd = parseJsonLdJobPosting();
  if (jsonLd?.title || jsonLd?.description) return { isJob: true, jsonLd };

  const isJob = looksLikeJobPageHeuristic();
  return { isJob, jsonLd: null };
}

function extractSkillsFromText(text) {
  const t = sanitizeText(text, { maxLen: 20000 });
  if (!t) return [];

  const known = [
    "javascript",
    "typescript",
    "react",
    "next.js",
    "node.js",
    "express",
    "python",
    "java",
    "c#",
    "sql",
    "postgres",
    "mysql",
    "mongodb",
    "redis",
    "aws",
    "azure",
    "gcp",
    "docker",
    "kubernetes",
    "terraform",
    "git",
    "linux",
    "graphql",
    "rest",
  ];

  const lower = t.toLowerCase();
  const found = new Set();
  for (const k of known) {
    if (lower.includes(k)) found.add(k);
  }
  return Array.from(found).slice(0, 30);
}

function extractJobDetails({ jsonLd } = {}) {
  if (jsonLd) {
    return {
      title: jsonLd.title,
      company: jsonLd.company,
      description: jsonLd.description,
      skills: jsonLd.skills || extractSkillsFromText(jsonLd.description),
      source: jsonLd.source,
    };
  }

  const title = queryText(
    [
      // LinkedIn
      "h1.top-card-layout__title",
      "h1.t-24",
      // Indeed
      'h1[data-testid="jobsearch-JobInfoHeader-title"]',
      // Greenhouse
      "#header h1",
      // Generic
      "main h1",
      "article h1",
      "h1",
    ]
  );

  const company = queryText(
    [
      // LinkedIn
      "a.topcard__org-name-link",
      ".topcard__org-name-link",
      ".top-card-layout__card .topcard__flavor-row a",
      // Indeed
      'div[data-testid="inlineHeader-companyName"] a',
      'div[data-testid="inlineHeader-companyName"]',
      // Greenhouse
      "#header .company-name",
      // Generic
      "[data-company]",
      "[class*='company' i] a",
      "[class*='company' i]",
    ]
  );

  const descriptionEl = queryFirst(
    [
      // LinkedIn
      ".show-more-less-html__markup",
      ".jobs-description__content",
      // Indeed
      "#jobDescriptionText",
      'div[data-testid="jobsearch-JobComponent-description"]',
      // Greenhouse
      "#content",
      // Generic
      "article",
      "main",
    ]
  );

  const description = sanitizeText(textFrom(descriptionEl), { maxLen: 12000 });

  const skillsSection = queryFirst(
    [
      "section:has(h2)",
      "section:has(h3)",
      "aside",
      "main",
      "article",
    ]
  );

  const skillsText = skillsSection ? textFrom(skillsSection) : "";
  const skills = extractSkillsFromText(skillsText).slice(0, 30);

  return {
    title,
    company,
    description,
    skills,
    source: "dom",
  };
}

function ensureStyles() {
  if (document.getElementById(STYLE_LINK_ID)) return;

  const link = document.createElement("link");
  link.id = STYLE_LINK_ID;
  link.rel = "stylesheet";
  link.type = "text/css";
  link.href = chrome.runtime.getURL("styles.css");
  document.documentElement.appendChild(link);
}

function injectButton() {
  if (document.getElementById(ROOT_ID)) return;

  ensureStyles();

  const root = document.createElement("div");
  root.id = ROOT_ID;

  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  button.textContent = "Check My Fit";

  button.addEventListener("click", async () => {
    try {
      button.disabled = true;
      button.classList.add("zenai-loading");

      const { jsonLd } = detectJobPage();
      const job = extractJobDetails({ jsonLd });

      const payload = {
        job: {
          title: sanitizeText(job.title, { maxLen: 200 }),
          company: sanitizeText(job.company, { maxLen: 200 }),
          description: sanitizeText(job.description, { maxLen: 12000 }),
          skills: Array.isArray(job.skills) ? job.skills.map((s) => sanitizeText(String(s), { maxLen: 80 })).filter(Boolean) : [],
          pageUrl: location.href,
          extractedAt: new Date().toISOString(),
          source: job.source,
        },
      };

      log("Sending job payload", payload.job);

      const resp = await chrome.runtime.sendMessage({
        type: "ZENAI_JOB_DATA",
        payload,
      });

      log("Background response", resp);
    } catch (err) {
      log("Click handler failed", err);
    } finally {
      button.classList.remove("zenai-loading");
      button.disabled = false;
    }
  });

  root.appendChild(button);
  document.documentElement.appendChild(root);
}

function removeButton() {
  const el = document.getElementById(ROOT_ID);
  if (el) el.remove();
}

let lastDecision = null;
function tick() {
  const decision = detectJobPage();
  const isJob = !!decision.isJob;

  if (lastDecision !== isJob) {
    lastDecision = isJob;
    log("Job page detection:", isJob);
  }

  if (isJob) injectButton();
  else removeButton();
}

function start() {
  tick();

  const mo = new MutationObserver(() => {
    // Debounced-ish: let the DOM settle a bit via microtask
    queueMicrotask(tick);
  });

  mo.observe(document.documentElement, { childList: true, subtree: true });
}

start();
