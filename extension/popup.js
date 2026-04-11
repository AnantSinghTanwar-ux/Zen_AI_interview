const LOG_PREFIX = "[ZenAI:popup]";

const CONFIG = Object.freeze({
  APP_BASE_URL: "https://myapp.com",
  DASHBOARD_PATH: "/",
  STORAGE_TOKEN_KEY: "zenaiAuthToken",
});

function log(...args) {
  // eslint-disable-next-line no-console
  console.log(LOG_PREFIX, ...args);
}

function $(id) {
  return document.getElementById(id);
}

function setStatus({ loggedIn }) {
  const el = $("status");
  if (!el) return;

  if (loggedIn) {
    el.textContent = "Logged in";
    el.className = "zenai-pill zenai-pill--ok";
  } else {
    el.textContent = "Logged out";
    el.className = "zenai-pill zenai-pill--warn";
  }
}

async function getToken() {
  const result = await chrome.storage.local.get([CONFIG.STORAGE_TOKEN_KEY]);
  const token = typeof result?.[CONFIG.STORAGE_TOKEN_KEY] === "string" ? result[CONFIG.STORAGE_TOKEN_KEY].trim() : "";
  return token || "";
}

async function setToken(token) {
  await chrome.storage.local.set({ [CONFIG.STORAGE_TOKEN_KEY]: token });
}

async function clearToken() {
  await chrome.storage.local.remove([CONFIG.STORAGE_TOKEN_KEY]);
}

async function refresh() {
  const token = await getToken();
  setStatus({ loggedIn: Boolean(token) });
}

document.addEventListener("DOMContentLoaded", async () => {
  const tokenInput = $("token");
  const saveBtn = $("save");
  const clearBtn = $("clear");
  const dashboardBtn = $("dashboard");

  await refresh();

  saveBtn?.addEventListener("click", async () => {
    const token = (tokenInput?.value || "").trim();
    if (!token) return;

    await setToken(token);
    tokenInput.value = "";
    log("Token saved");
    await refresh();
  });

  clearBtn?.addEventListener("click", async () => {
    await clearToken();
    log("Token cleared");
    await refresh();
  });

  dashboardBtn?.addEventListener("click", async () => {
    const url = CONFIG.APP_BASE_URL + CONFIG.DASHBOARD_PATH;
    await chrome.tabs.create({ url });
  });
});
