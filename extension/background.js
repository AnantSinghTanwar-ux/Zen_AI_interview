const APP_BASE_URL = "https://zen-ai-zeta.vercel.app";
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

const buildAnalyzeUrlWithData = (dataObj) => {
  const encoded = encodeURIComponent(JSON.stringify(dataObj));
  return `${ANALYZE_URL}?data=${encoded}`;
};

const buildInterviewUrlWithData = (dataObj) => {
  const encoded = encodeURIComponent(JSON.stringify(dataObj));
  return `${INTERVIEW_URL}?job=${encoded}&source=extension`;
};

const buildLoginRedirectUrl = (currentPageUrl) => {
  const redirect = encodeURIComponent(`${ANALYZE_URL}?from=extension&source=${encodeURIComponent(currentPageUrl || "")}`);
  return `${LOGIN_URL}?redirect=${redirect}`;
};

const buildInterviewLoginRedirectUrl = (currentPageUrl) => {
  const redirect = encodeURIComponent(`${INTERVIEW_URL}?from=extension&source=${encodeURIComponent(currentPageUrl || "")}`);
  return `${LOGIN_URL}?redirect=${redirect}`;
};

const handleStartZScoreInterview = async (message) => {
  const { authToken, extensionEnabled } = await getFromStorage([
    STORAGE_KEYS.AUTH_TOKEN,
    STORAGE_KEYS.EXTENSION_ENABLED
  ]);

  if (extensionEnabled === false) {
    return { ok: false, disabled: true, action: "disabled" };
  }

  if (!authToken) {
    log("No auth token, redirecting to login for interview flow");
    openTab(buildInterviewLoginRedirectUrl(message?.payload?.sourceUrl));
    return { ok: true, action: "redirect_login" };
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

const analyzeWithBackend = async (token, payload, resumePayload) => {
  const response = await fetch(ANALYZE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      ...payload,
      resume: resumePayload
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Analyze API failed (${response.status}): ${errorText.slice(0, 300)}`);
  }

  return response.json();
};

const handleCheckMyFit = async (message) => {
  const { authToken, resumeText, resumeId, extensionEnabled } = await getFromStorage([
    STORAGE_KEYS.AUTH_TOKEN,
    STORAGE_KEYS.RESUME_TEXT,
    STORAGE_KEYS.RESUME_ID,
    STORAGE_KEYS.EXTENSION_ENABLED
  ]);

  if (extensionEnabled === false) {
    return { ok: false, disabled: true, action: "disabled" };
  }

  if (!authToken) {
    log("No auth token, redirecting to login");
    openTab(buildLoginRedirectUrl(message?.payload?.sourceUrl));
    return { ok: true, action: "redirect_login" };
  }

  const sanitizedPayload = sanitizeJobPayload(message.payload);
  const resumePayload = {
    text: sanitizeString(resumeText, 30000),
    resumeId: sanitizeString(resumeId, 200)
  };

  try {
    log("Sending payload to analyze API", {
      hasResumeText: Boolean(resumePayload.text),
      hasResumeId: Boolean(resumePayload.resumeId)
    });

    const apiResult = await analyzeWithBackend(authToken, sanitizedPayload, resumePayload);

    const analyzeTabUrl = buildAnalyzeUrlWithData({
      source: "extension",
      job: sanitizedPayload.job,
      sourceUrl: sanitizedPayload.sourceUrl,
      analysis: {
        matchPercentage: apiResult?.matchPercentage,
        missingSkills: apiResult?.missingSkills || [],
        suggestions: apiResult?.suggestions || [],
        interviewReadinessScore: apiResult?.interviewReadinessScore,
        analysisId: apiResult?.analysisId
      }
    });

    openTab(analyzeTabUrl);
    return { ok: true, action: "opened_analysis" };
  } catch (error) {
    log("API analyze failed, opening fallback analysis view", error.message);

    const fallbackAnalyzeUrl = buildAnalyzeUrlWithData({
      source: "extension-fallback",
      job: sanitizedPayload.job,
      sourceUrl: sanitizedPayload.sourceUrl
    });

    openTab(fallbackAnalyzeUrl);
    return {
      ok: false,
      action: "opened_fallback",
      error: "Failed to fetch analysis from API"
    };
  }
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

  if (message.type === "CHECK_MY_FIT") {
    handleCheckMyFit(message)
      .then((result) => sendResponse(result))
      .catch((err) => {
        log("Unexpected error", err);
        sendResponse({ ok: false, error: "Unexpected background error" });
      });
    return true;
  }

  if (message.type === "START_ZSCORE_INTERVIEW") {
    handleStartZScoreInterview(message)
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
