const ZENAI = {
  buttonId: "zenai-check-fit-button",
  mountedAttr: "data-zenai-mounted",
  logPrefix: "[ZenAI Content]",
  storageKeys: {
    extensionEnabled: "extensionEnabled"
  }
};

let extensionEnabled = true;

const JOBYT_JOB_URL_REGEX = /^\/jobs\/([a-z0-9-]{8,})$/i;

const TRUSTED_AUTH_SYNC_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "zen-ai-zeta.vercel.app"
]);

const SKIP_JOB_INJECTION_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "zen-ai-zeta.vercel.app"
]);

const SELECTORS = {
  title: [
    "h1[class*='job']",
    "h1[class*='title']",
    "h1[data-test*='job']",
    "h1",
    "[data-testid*='job-title']",
    ".top-card-layout__title",
    ".job-details-jobs-unified-top-card__job-title"
  ],
  company: [
    "[data-testid*='company']",
    "a[class*='company']",
    "span[class*='company']",
    ".topcard__org-name-link",
    ".job-details-jobs-unified-top-card__company-name",
    "[class*='employer']"
  ],
  description: [
    "[data-testid*='job-description']",
    "[class*='job-description']",
    "[class*='description']",
    "article",
    "main article",
    "section[aria-label*='Description']"
  ],
  requirements: [
    "[class*='requirement'] li",
    "[data-testid*='requirement'] li",
    "section[class*='requirement'] li",
    "ul[class*='requirement'] li"
  ],
  skills: [
    "[class*='skill']",
    "[data-testid*='skill']",
    "li[class*='skill']",
    "span[class*='skill']",
    "a[href*='skill']"
  ]
};

const log = (...args) => {
  console.log(ZENAI.logPrefix, ...args);
};

const isTrustedAuthSyncHost = () => {
  const host = window.location.hostname.toLowerCase();
  return TRUSTED_AUTH_SYNC_HOSTS.has(host);
};

const shouldSkipJobInjection = () => {
  const host = window.location.hostname.toLowerCase();
  return SKIP_JOB_INJECTION_HOSTS.has(host);
};

const getStorageValue = (key) =>
  new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => resolve(result[key]));
  });

const loadExtensionEnabled = async () => {
  const stored = await getStorageValue(ZENAI.storageKeys.extensionEnabled);
  extensionEnabled = stored === undefined ? true : Boolean(stored);
  return extensionEnabled;
};

const sanitizeText = (value, maxLen = 12000) => {
  if (!value || typeof value !== "string") {
    return "";
  }
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
};

const extractFromSelectors = (selectors, { minLength = 2, maxLen = 5000 } = {}) => {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (!el) {
      continue;
    }
    const value = sanitizeText(el.textContent || "", maxLen);
    if (value.length >= minLength) {
      return value;
    }
  }
  return "";
};

const extractJsonLdJobPosting = () => {
  const scripts = [...document.querySelectorAll("script[type='application/ld+json']")];
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script.textContent || "{}");
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of entries) {
        if (!item || typeof item !== "object") {
          continue;
        }
        const type = Array.isArray(item["@type"]) ? item["@type"].join(" ") : item["@type"];
        if (String(type || "").toLowerCase().includes("jobposting")) {
          const company =
            typeof item.hiringOrganization === "object"
              ? item.hiringOrganization?.name || ""
              : "";
          return {
            title: sanitizeText(item.title || "", 400),
            company: sanitizeText(company, 300),
            description: sanitizeText(item.description || "", 16000),
            skills: []
          };
        }
      }
    } catch (_error) {
      // Intentionally swallow malformed JSON-LD blocks from host pages.
    }
  }
  return null;
};

const extractSkills = (descriptionText) => {
  const collected = new Set();

  for (const selector of SELECTORS.skills) {
    document.querySelectorAll(selector).forEach((el) => {
      const skill = sanitizeText(el.textContent || "", 120);
      if (skill && skill.length >= 2 && skill.length <= 60) {
        collected.add(skill);
      }
    });
  }

  const knownSkillRegex = /\b(JavaScript|TypeScript|Node\.js|React|Next\.js|Python|Java|C\+\+|C#|SQL|NoSQL|AWS|Azure|GCP|Docker|Kubernetes|REST|GraphQL|CI\/CD|Git|Machine Learning|Data Analysis)\b/gi;
  const matches = descriptionText.match(knownSkillRegex) || [];
  matches.forEach((s) => collected.add(sanitizeText(s, 60)));

  return [...collected].slice(0, 80);
};

const cleanJobDescription = (text) => {
  if (!text) {
    return "";
  }

  const normalized = sanitizeText(text, 24000);

  const startMarkers = ["job description", "about the role", "role overview"];
  const endMarkers = [
    "eligibility",
    "other requirements",
    "perks",
    "number of openings",
    "apply now",
    "additional questions",
    "cover letter",
    "skill matching",
    "missing skills",
    "generate roadmap",
  ];

  const lower = normalized.toLowerCase();
  let startIdx = 0;
  for (const marker of startMarkers) {
    const idx = lower.indexOf(marker);
    if (idx >= 0) {
      startIdx = idx + marker.length;
      break;
    }
  }

  let endIdx = normalized.length;
  const slicedLower = lower.slice(startIdx);
  for (const marker of endMarkers) {
    const idx = slicedLower.indexOf(marker);
    if (idx >= 0) {
      endIdx = Math.min(endIdx, startIdx + idx);
    }
  }

  const section = normalized.slice(startIdx, endIdx).trim();
  return section || normalized;
};

const parseCompanyFromText = (text) => {
  if (!text) {
    return "";
  }

  const fromAbout = text.match(/about\s+([a-z0-9&.,\-\s]{2,80})/i);
  if (fromAbout?.[1]) {
    return sanitizeText(fromAbout[1], 120);
  }

  const fromAt = text.match(/(?:at|for)\s+([A-Z][A-Za-z0-9&.,\-\s]{2,80})/);
  if (fromAt?.[1]) {
    return sanitizeText(fromAt[1], 120);
  }

  return "";
};

const normalizeRequirementLine = (line) =>
  sanitizeText(line, 260)
    .replace(/^[-•\d.)\s]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

const extractJobDetails = () => {
  const fromJsonLd = extractJsonLdJobPosting();

  const title =
    fromJsonLd?.title ||
    extractFromSelectors(SELECTORS.title, { minLength: 2, maxLen: 400 }) ||
    sanitizeText(document.title.replace(/\s*\|.*$/, ""), 300);

  const extractedCompany =
    fromJsonLd?.company ||
    extractFromSelectors(SELECTORS.company, { minLength: 2, maxLen: 300 }) ||
    "";

  const rawDescription =
    fromJsonLd?.description ||
    extractFromSelectors(SELECTORS.description, { minLength: 80, maxLen: 20000 }) ||
    sanitizeText(document.body?.innerText || "", 20000);

  const description = cleanJobDescription(rawDescription);
  const company = extractedCompany || parseCompanyFromText(rawDescription);

  const skills = extractSkills(description);
  const requirements = extractRequirements(description);
  const jobId = extractJobIdFromUrl();

  return {
    jobId,
    title,
    company,
    description,
    requirements,
    skills
  };
};

const extractRequirements = (descriptionText) => {
  const items = new Set();

  for (const selector of SELECTORS.requirements) {
    document.querySelectorAll(selector).forEach((el) => {
      const line = sanitizeText(el.textContent || "", 240);
      if (line.length >= 4) {
        items.add(normalizeRequirementLine(line));
      }
    });
  }

  const blockedPhrases = [
    "apply now",
    "resume",
    "additional questions",
    "cover letter",
    "skill matching",
    "missing skills",
    "generate roadmap",
    "number of openings",
    "login",
    "sign in",
  ];

  if (descriptionText) {
    descriptionText
      .split(/\.|\n|•/)
      .map((line) => normalizeRequirementLine(line))
      .filter((line) => line.length >= 20)
      .filter((line) => {
        const low = line.toLowerCase();
        if (blockedPhrases.some((p) => low.includes(p))) {
          return false;
        }

        const requirementSignals = [
          "experience",
          "must",
          "should",
          "required",
          "proficient",
          "knowledge",
          "familiar",
          "ability",
          "develop",
          "design",
          "build",
        ];

        return requirementSignals.some((sig) => low.includes(sig));
      })
      .slice(0, 20)
      .forEach((line) => items.add(line));
  }

  return [...items].filter(Boolean).slice(0, 25);
};

const extractJobIdFromUrl = () => {
  const match = window.location.pathname.match(JOBYT_JOB_URL_REGEX);
  return match?.[1] || "";
};

const isJobytJobPage = () => {
  const host = window.location.hostname.toLowerCase();
  if (host !== "www.jobyt.in" && host !== "jobyt.in") {
    return false;
  }
  return JOBYT_JOB_URL_REGEX.test(window.location.pathname);
};

const isLikelyJobPage = () => {
  if (isJobytJobPage()) {
    return true;
  }

  const url = window.location.href.toLowerCase();
  const urlSignal = /(\/jobs?\/|jobid|job-description|careers?|position|vacancy|opening|myworkdayjobs|greenhouse|lever\.co)/i.test(url);

  const jsonLdSignal = Boolean(extractJsonLdJobPosting());
  const titleSignal = Boolean(extractFromSelectors(SELECTORS.title, { minLength: 2, maxLen: 250 }));
  const descSignal = Boolean(extractFromSelectors(SELECTORS.description, { minLength: 120, maxLen: 2000 }));

  const score = [urlSignal, jsonLdSignal, titleSignal, descSignal].filter(Boolean).length;
  return score >= 2;
};

const sendJobForAnalysis = () => {
  if (!extensionEnabled) {
    log("Extension disabled, skipping analysis message");
    return;
  }

  const job = extractJobDetails();
  const payload = {
    sourceUrl: window.location.href,
    extractedAt: new Date().toISOString(),
    job
  };

  log("Sending job payload", payload);

  const actionType = isJobytJobPage() ? "START_ZSCORE_INTERVIEW" : "CHECK_MY_FIT";

  chrome.runtime.sendMessage(
    {
      type: actionType,
      payload
    },
    (response) => {
      if (chrome.runtime.lastError) {
        log("Message failed", chrome.runtime.lastError.message);
        return;
      }
      log("Background response", response);
    }
  );
};

const syncAuthTokenToExtension = (token) => {
  chrome.runtime.sendMessage(
    {
      type: "SET_AUTH_TOKEN",
      payload: { token }
    },
    (response) => {
      if (chrome.runtime.lastError) {
        log("Auth token sync failed", chrome.runtime.lastError.message);
        return;
      }
      log("Auth token synced", response);
    }
  );
};

const setupWebAppAuthBridge = () => {
  if (!isTrustedAuthSyncHost()) {
    return;
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || typeof event.data !== "object") {
      return;
    }

    if (event.data.type === "ZENAI_EXTENSION_SYNC_TOKEN") {
      const token = sanitizeText(String(event.data.token || ""), 4000);
      if (!token) {
        return;
      }
      log("Received token sync event from web app");
      syncAuthTokenToExtension(token);
    }

    if (event.data.type === "ZENAI_EXTENSION_CLEAR_TOKEN") {
      log("Received token clear event from web app");
      syncAuthTokenToExtension("");
    }
  });
};

const createButton = () => {
  const button = document.createElement("button");
  button.id = ZENAI.buttonId;
  button.className = "zenai-fit-btn";
  button.type = "button";
  const label = isJobytJobPage() ? "Z-Score" : "Check My Fit";
  button.setAttribute("aria-label", label);
  button.textContent = label;

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    sendJobForAnalysis();
  });

  return button;
};

const mountButton = () => {
  if (document.documentElement.getAttribute(ZENAI.mountedAttr) === "true") {
    return;
  }

  if (!isLikelyJobPage()) {
    log("Not a job page, skipping button injection");
    return;
  }

  const existing = document.getElementById(ZENAI.buttonId);
  if (existing) {
    document.documentElement.setAttribute(ZENAI.mountedAttr, "true");
    return;
  }

  const button = createButton();
  document.body.appendChild(button);
  document.documentElement.setAttribute(ZENAI.mountedAttr, "true");
  log("Button injected");
};

const unmountButton = () => {
  const existing = document.getElementById(ZENAI.buttonId);
  if (existing) {
    existing.remove();
    log("Button removed");
  }
  document.documentElement.removeAttribute(ZENAI.mountedAttr);
};

const checkAndRender = () => {
  if (!extensionEnabled) {
    unmountButton();
    return;
  }

  if (isLikelyJobPage()) {
    mountButton();
  } else {
    unmountButton();
  }
};

const observePageChanges = () => {
  const observer = new MutationObserver(() => {
    checkAndRender();
  });

  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true
  });

  const originalPushState = history.pushState;
  history.pushState = function pushStatePatched(...args) {
    originalPushState.apply(this, args);
    setTimeout(checkAndRender, 150);
  };

  window.addEventListener("popstate", () => {
    setTimeout(checkAndRender, 150);
  });
};

const observeExtensionEnabledSetting = () => {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    const changed = changes[ZENAI.storageKeys.extensionEnabled];
    if (!changed) {
      return;
    }

    extensionEnabled = changed.newValue === undefined ? true : Boolean(changed.newValue);
    log("Extension enabled changed:", extensionEnabled);
    checkAndRender();
  });
};

const init = async () => {
  log("Content script booted", window.location.href);
  setupWebAppAuthBridge();

  if (shouldSkipJobInjection()) {
    log("Skipping job page observer/injection on app host");
    return;
  }

  await loadExtensionEnabled();
  observeExtensionEnabledSetting();
  observePageChanges();

  if (!extensionEnabled) {
    log("Extension disabled, skipping injection");
    return;
  }

  checkAndRender();
};

init();
