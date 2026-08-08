const accountLink = document.querySelector("#account-link");
const accountName = document.querySelector("#account-name");
const logoutButton = document.querySelector("#logout-button");
let csrfToken = "";

// Reflect the signed-in account in the public home navigation.
async function loadAccount() {
  const response = await fetch("/api/auth/me");
  const state = await response.json();
  csrfToken = state.csrfToken;
  if (!state.user) return;
  accountLink.hidden = true;
  accountName.hidden = false;
  logoutButton.hidden = false;
  accountName.textContent = state.user.displayName;
}

// End the current account session and restore public navigation.
async function logout() {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    headers: { "X-CSRF-Token": csrfToken },
  });
  if (response.ok) window.location.reload();
}

logoutButton.addEventListener("click", logout);
loadAccount();
