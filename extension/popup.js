const APP_BASE_URL = "https://zen-ai-zeta.vercel.app";
const DASHBOARD_URL = `${APP_BASE_URL}/dashboard`;
const STORAGE_KEY = "authToken";

const els = {
  statusBadge: document.getElementById("statusBadge"),
  authTokenInput: document.getElementById("authTokenInput"),
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

const refreshUI = async () => {
  const token = sanitizeToken(await getStorage(STORAGE_KEY));
  const loggedIn = Boolean(token);

  setStatus(loggedIn);
  els.authTokenInput.value = token;
  setMessage("");
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

els.dashboardBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: DASHBOARD_URL });
});

refreshUI();
