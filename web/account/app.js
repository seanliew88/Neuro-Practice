const elements = {
  loginTab: document.querySelector("#login-tab"),
  registerTab: document.querySelector("#register-tab"),
  title: document.querySelector("#account-title"),
  copy: document.querySelector("#account-copy"),
  form: document.querySelector("#account-form"),
  nameField: document.querySelector("#name-field"),
  displayName: document.querySelector("#display-name"),
  email: document.querySelector("#email"),
  password: document.querySelector("#password"),
  passwordNote: document.querySelector("#password-note"),
  status: document.querySelector("#form-status"),
  submit: document.querySelector("#submit-button"),
};
let mode = "login";
let csrfToken = "";

// Accept only local destinations after successful authentication.
function destination() {
  const requested = new URLSearchParams(window.location.search).get("next") || "/";
  return requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
}

// Switch the shared form between sign-in and registration fields.
function setMode(nextMode) {
  mode = nextMode;
  const registering = mode === "register";
  elements.loginTab.classList.toggle("selected", !registering);
  elements.registerTab.classList.toggle("selected", registering);
  elements.loginTab.setAttribute("aria-selected", String(!registering));
  elements.registerTab.setAttribute("aria-selected", String(registering));
  elements.nameField.hidden = !registering;
  elements.displayName.required = registering;
  elements.password.autocomplete = registering ? "new-password" : "current-password";
  elements.passwordNote.hidden = !registering;
  elements.title.textContent = registering ? "Create your account" : "Welcome back";
  elements.copy.textContent = registering ? "Start a private practice history across every game." : "Continue your NeuroPractice history.";
  elements.submit.innerHTML = `${registering ? "Create account" : "Sign in"} <span>→</span>`;
  elements.status.textContent = "";
}

// Initialize the CSRF token and bypass this page for signed-in users.
async function initialize() {
  try {
    const response = await fetch("/api/auth/me");
    if (!response.ok) throw new Error("Account service is unavailable.");
    const state = await response.json();
    csrfToken = state.csrfToken;
    if (state.user) {
      window.location.replace(destination());
      return;
    }
    elements.submit.disabled = false;
  } catch (error) {
    elements.status.textContent = error.message;
  }
}

// Submit credentials and continue to the originally requested page.
async function submitAccount(event) {
  event.preventDefault();
  elements.submit.disabled = true;
  elements.status.textContent = "";
  const payload = { email: elements.email.value, password: elements.password.value };
  if (mode === "register") payload.displayName = elements.displayName.value;
  try {
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Account request failed.");
    window.location.assign(destination());
  } catch (error) {
    elements.status.textContent = error.message;
    elements.submit.disabled = false;
  }
}

elements.loginTab.addEventListener("click", () => setMode("login"));
elements.registerTab.addEventListener("click", () => setMode("register"));
elements.form.addEventListener("submit", submitAccount);
initialize();
