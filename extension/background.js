const APP_BASE_URL = "https://zen-ai-wvo2-git-main-anantsinghtanwar-uxs-projects.vercel.app";

const LOGIN_URL = `${APP_BASE_URL}/sign-in`;
const ANALYZE_URL = `${APP_BASE_URL}/analyze`;
const INTERVIEW_URL = `${APP_BASE_URL}/interview`;
const ANALYZE_API_URL = `${APP_BASE_URL}/api/extension/analyze`;
const STORAGE_KEYS = {
  AUTH_TOKEN: "authToken",
  RESUME_TEXT: "resumeText",
  RESUME_ID: "resumeId",
  EXTENSION_ENABLED: "extensionEnabled"
};

const log = (...args) => {
  console.log("[ZenAI Background]", ...args);
};

const getFromStorage = (keys) =>
  new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => resolve(result));
  });

const setToStorage = (data) =>
  new Promise((resolve) => {
    chrome.storage.local.set(data, () => resolve());
  });

const openTab = (url) => {
  chrome.tabs.create({ url });
};

const sanitizeString = (value, max = 8000) => {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
};

const sanitizeArray = (items, maxItems = 100) => {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map((item) => sanitizeString(item, 100))
    .filter(Boolean)
    .slice(0, maxItems);
};

const sanitizeJobPayload = (payload = {}) => {
  return {
    sourceUrl: sanitizeString(payload.sourceUrl, 1200),
    extractedAt: sanitizeString(payload.extractedAt, 100),
    job: {
      title: sanitizeString(payload?.job?.title, 300),
      company: sanitizeString(payload?.job?.company, 300),
      description: sanitizeString(payload?.job?.description, 16000),
      skills: sanitizeArray(payload?.job?.skills, 120)
    }
  };
};

const buildInterviewUrlWithData = (dataObj) => {
  const encoded = encodeURIComponent(JSON.stringify(dataObj));
  return `${INTERVIEW_URL}?job=${encoded}&source=extension`;
};

const handleInterviewRedirect = async (message) => {
  const { extensionEnabled } = await getFromStorage([ STORAGE_KEYS.EXTENSION_ENABLED ]);

  if (extensionEnabled === false) {
    return { ok: false, disabled: true, action: "disabled" };
  }

  const sanitizedPayload = sanitizeJobPayload(message.payload);
  const interviewPayload = {
    source: "zscore-extension",
    sourceUrl: sanitizedPayload.sourceUrl,
    extractedAt: sanitizedPayload.extractedAt,
    job: {
      jobId: sanitizeString(message?.payload?.job?.jobId || "", 120),
      title: sanitizedPayload.job.title,
      company: sanitizedPayload.job.company,
      description: sanitizedPayload.job.description,
      requirements: sanitizeArray(message?.payload?.job?.requirements || [], 120),
      skills: sanitizedPayload.job.skills,
    },
  };

  log("Opening interview page with job JSON context", {
    jobId: interviewPayload.job.jobId,
    title: interviewPayload.job.title,
  });

  openTab(buildInterviewUrlWithData(interviewPayload));
  return { ok: true, action: "opened_interview" };
};

chrome.runtime.onInstalled.addListener(async () => {
  log("Extension installed");
  await setToStorage({
    [STORAGE_KEYS.AUTH_TOKEN]: "",
    [STORAGE_KEYS.RESUME_TEXT]: "",
    [STORAGE_KEYS.RESUME_ID]: "",
    [STORAGE_KEYS.EXTENSION_ENABLED]: true
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return false;
  }

  if (message.type === "CHECK_MY_FIT" || message.type === "START_ZSCORE_INTERVIEW") {
    handleInterviewRedirect(message)
      .then((result) => sendResponse(result))
      .catch((err) => {
        log("Unexpected interview flow error", err);
        sendResponse({ ok: false, error: "Unexpected interview flow error" });
      });
    return true;
  }

  if (message.type === "SET_AUTH_TOKEN") {
    const token = sanitizeString(message?.payload?.token, 4000);
    setToStorage({ [STORAGE_KEYS.AUTH_TOKEN]: token })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === "SET_RESUME_TEXT") {
    const resumeText = sanitizeString(message?.payload?.resumeText, 30000);
    setToStorage({ [STORAGE_KEYS.RESUME_TEXT]: resumeText })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === "SET_EXTENSION_ENABLED") {
    const enabled = Boolean(message?.payload?.enabled);
    setToStorage({ [STORAGE_KEYS.EXTENSION_ENABLED]: enabled })
      .then(() => sendResponse({ ok: true, enabled }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  return false;
});
