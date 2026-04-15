const APP_BASE_URL = "https://zen-ai-zeta.vercel.app";
const DASHBOARD_URL = `${APP_BASE_URL}/`;
const STORAGE_KEY = "authToken";
const EXTENSION_ENABLED_KEY = "extensionEnabled";

const els = {
  statusBadge: document.getElementById("statusBadge"),
  authTokenInput: document.getElementById("authTokenInput"),
  extensionEnabledToggle: document.getElementById("extensionEnabledToggle"),
  extensionEnabledText: document.getElementById("extensionEnabledText"),
  saveTokenBtn: document.getElementById("saveTokenBtn"),
  clearTokenBtn: document.getElementById("clearTokenBtn"),
  dashboardBtn: document.getElementById("dashboardBtn"),
  messageText: document.getElementById("messageText")
};

const sanitizeToken = (token) => {
  if (typeof token !== "string") {
    return "";
  }
  return token.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 4000);
};

const getStorage = (key) =>
  new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => resolve(result[key] || ""));
  });

const setStorage = (key, value) =>
  new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => resolve());
  });

const setMessage = (text, type = "") => {
  els.messageText.textContent = text;
  els.messageText.className = `zenai-message ${type}`.trim();
};

const setStatus = (isLoggedIn) => {
  els.statusBadge.textContent = isLoggedIn ? "Logged In" : "Not Logged In";
  els.statusBadge.classList.toggle("is-online", isLoggedIn);
  els.statusBadge.classList.toggle("is-offline", !isLoggedIn);
};

const setExtensionEnabledUI = (enabled) => {
  els.extensionEnabledToggle.checked = enabled;
  els.extensionEnabledText.textContent = enabled ? "On" : "Off";
};

const refreshUI = async () => {
  const token = sanitizeToken(await getStorage(STORAGE_KEY));
  const extensionEnabledRaw = await getStorage(EXTENSION_ENABLED_KEY);
  const extensionEnabled = extensionEnabledRaw === "" ? true : Boolean(extensionEnabledRaw);
  const loggedIn = Boolean(token);

  setStatus(loggedIn);
  setExtensionEnabledUI(extensionEnabled);
  els.authTokenInput.value = token;
  setMessage("");
};

const notifyExtensionEnabled = (enabled) => {
  chrome.runtime.sendMessage({
    type: "SET_EXTENSION_ENABLED",
    payload: { enabled }
  });
};

els.saveTokenBtn.addEventListener("click", async () => {
  const token = sanitizeToken(els.authTokenInput.value);
  await setStorage(STORAGE_KEY, token);
  setStatus(Boolean(token));
  setMessage(token ? "Token saved." : "Token is empty.", token ? "ok" : "warn");

  chrome.runtime.sendMessage({
    type: "SET_AUTH_TOKEN",
    payload: { token }
  });
});

els.clearTokenBtn.addEventListener("click", async () => {
  await setStorage(STORAGE_KEY, "");
  els.authTokenInput.value = "";
  setStatus(false);
  setMessage("Token cleared.", "warn");

  chrome.runtime.sendMessage({
    type: "SET_AUTH_TOKEN",
    payload: { token: "" }
  });
});

els.extensionEnabledToggle.addEventListener("change", async () => {
  const enabled = Boolean(els.extensionEnabledToggle.checked);
  await setStorage(EXTENSION_ENABLED_KEY, enabled);
  setExtensionEnabledUI(enabled);
  setMessage(enabled ? "Extension enabled." : "Extension disabled.", "ok");
  notifyExtensionEnabled(enabled);
});

els.dashboardBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: DASHBOARD_URL });
});

refreshUI();
