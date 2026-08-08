const authState = fetch("/api/auth/me", { headers: { Accept: "application/json" } })
  .then(async (response) => {
    if (!response.ok) throw new Error("Authentication is unavailable.");
    const state = await response.json();
    if (!state.user) {
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`/account/?next=${encodeURIComponent(next)}`);
      throw new Error("Authentication required.");
    }
    return state;
  });
window.neuroAuthState = authState;

// Send same-origin API requests with the current session's CSRF token.
window.neuroRequest = async function neuroRequest(url, options = {}) {
  const state = await authState;
  const headers = new Headers(options.headers || {});
  const method = (options.method || "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("X-CSRF-Token", state.csrfToken);
  }
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/account/?next=${encodeURIComponent(next)}`);
  }
  return response;
};
