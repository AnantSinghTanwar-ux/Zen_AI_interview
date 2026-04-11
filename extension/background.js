const LOG_PREFIX = "[ZenAI:bg]";

const CONFIG = Object.freeze({
  APP_BASE_URL: "https://myapp.com",
  LOGIN_PATH: "/sign-in",
  DASHBOARD_PATH: "/",
  ANALYZE_PATH: "/analyze",
  ANALYZE_API_PATH: "/api/extension/analyze",
  STORAGE_TOKEN_KEY: "zenaiAuthToken",
});

function log(...args) {
  // eslint-disable-next-line no-console
  console.log(LOG_PREFIX, ...args);
}

function toBase64Url(utf8String) {
  const bytes = new TextEncoder().encode(utf8String);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function buildAnalyzeUrl(payload) {
  const json = JSON.stringify(payload);
  const encoded = encodeURIComponent(toBase64Url(json));
  const url = new URL(CONFIG.APP_BASE_URL + CONFIG.ANALYZE_PATH);
  url.searchParams.set("source", "extension");
  url.searchParams.set("data", encoded);
  return url.toString();
}

async function getToken() {
  const result = await chrome.storage.local.get([CONFIG.STORAGE_TOKEN_KEY]);
  const token = typeof result?.[CONFIG.STORAGE_TOKEN_KEY] === "string" ? result[CONFIG.STORAGE_TOKEN_KEY].trim() : "";
  return token || null;
}

async function openTab(url) {
  await chrome.tabs.create({ url });
}

async function postAnalyze({ token, job }) {
  const url = CONFIG.APP_BASE_URL + CONFIG.ANALYZE_API_PATH;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ job, source: "chrome-extension" }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Analyze API failed: ${resp.status} ${resp.statusText} ${text}`);
  }

  return resp.json().catch(() => ({}));
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (!message || typeof message !== "object") return;

      if (message.type === "ZENAI_PING") {
        sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
        return;
      }

      if (message.type !== "ZENAI_JOB_DATA") return;

      const job = message.payload?.job;
      if (!job || typeof job !== "object") {
        sendResponse({ ok: false, error: "Missing job payload" });
        return;
      }

      const token = await getToken();
      if (!token) {
        log("No token found; redirecting to login");
        const loginUrl = new URL(CONFIG.APP_BASE_URL + CONFIG.LOGIN_PATH);
        loginUrl.searchParams.set("source", "extension");
        loginUrl.searchParams.set("next", CONFIG.ANALYZE_PATH);
        await openTab(loginUrl.toString());
        sendResponse({ ok: true, action: "login" });
        return;
      }

      log("Token found; attempting analyze API");
      try {
        await postAnalyze({ token, job });
      } catch (err) {
        log("Analyze API failed; falling back to URL payload", err);
      }

      const analyzeUrl = buildAnalyzeUrl({ job });
      await openTab(analyzeUrl);
      sendResponse({ ok: true, action: "analyze" });
    } catch (err) {
      log("Unhandled error", err);
      sendResponse({ ok: false, error: String(err?.message || err) });
    }
  })();

  return true;
});
