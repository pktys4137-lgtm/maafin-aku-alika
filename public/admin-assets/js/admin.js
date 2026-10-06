(() => {
  const loginForm = document.getElementById("login-form");
  const loginButton = document.getElementById("login-button");
  const loginStatus = document.getElementById("login-status");

  const refreshButton = document.getElementById("refresh-button");
  const logoutButton = document.getElementById("logout-button");
  const responsesBody = document.getElementById("responses-body");
  const dashboardStatus = document.getElementById("dashboard-status");
  const lastUpdated = document.getElementById("last-updated");
  const splitBar = document.getElementById("split-bar");

  const statTotal = document.getElementById("stat-total");
  const statForgiven = document.getElementById("stat-forgiven");
  const statNotForgiven = document.getElementById("stat-not-forgiven");

  function setButtonLoading(button, loading, loadingText, defaultText) {
    if (!button) return;
    button.disabled = loading;
    button.textContent = loading ? loadingText : defaultText;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Waktu tidak diketahui";
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  const parseJson = (response) => response.json().catch(() => ({}));

  function emptyRow(text) {
    return `<tr><td colspan="2" class="empty-state">${escapeHtml(text)}</td></tr>`;
  }

  /* ---------- Login ---------- */

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value;

      if (!username || !password) {
        loginStatus.textContent = "Isi username dan password dulu.";
        return;
      }

      setButtonLoading(loginButton, true, "Memeriksa...", "Masuk");
      loginStatus.textContent = "";

      try {
        const response = await fetch("/api?route=admin-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ username, password })
        });
        const data = await parseJson(response);

        if (!response.ok || !data.success) {
          loginStatus.textContent = data.message || "Gagal masuk. Coba lagi.";
          setButtonLoading(loginButton, false, "Memeriksa...", "Masuk");
          return;
        }

        window.location.href = "/admin";
      } catch (error) {
        loginStatus.textContent = "Server tidak bisa dihubungi. Coba lagi sebentar.";
        setButtonLoading(loginButton, false, "Memeriksa...", "Masuk");
      }
    });
  }

  /* ---------- Dashboard ---------- */

  function renderSplit(forgiven, notForgiven) {
    if (!splitBar) return;
    const total = forgiven + notForgiven;
    const [a, b] = splitBar.querySelectorAll("i");
    a.style.width = total ? `${(forgiven / total) * 100}%` : "0";
    b.style.width = total ? `${(notForgiven / total) * 100}%` : "0";
  }

  async function loadDashboard() {
    if (!responsesBody) return;

    dashboardStatus.textContent = "";
    responsesBody.innerHTML = emptyRow("Memuat jawaban...");

    try {
      const [statsResponse, responsesResponse] = await Promise.all([
        fetch("/api?route=admin-stats", { credentials: "same-origin" }),
        fetch("/api?route=admin-responses", { credentials: "same-origin" })
      ]);

      if (statsResponse.status === 401 || responsesResponse.status === 401) {
        window.location.href = "/admin";
        return;
      }

      const stats = await parseJson(statsResponse);
      const data = await parseJson(responsesResponse);

      if (!statsResponse.ok || !responsesResponse.ok || data.success !== true) {
        throw new Error("Dashboard data unavailable");
      }

      const forgiven = Number(stats.forgiven) || 0;
      const notForgiven = Number(stats.notForgiven) || 0;

      statTotal.textContent = Number(stats.total) || 0;
      statForgiven.textContent = forgiven;
      statNotForgiven.textContent = notForgiven;
      renderSplit(forgiven, notForgiven);

      const responses = Array.isArray(data.responses) ? data.responses : [];

      if (responses.length === 0) {
        responsesBody.innerHTML = emptyRow("Belum ada jawaban masuk.");
      } else {
        responsesBody.innerHTML = responses
          .map((item) => {
            const isForgiven = item.answer === "forgiven";
            return `
              <tr>
                <td>${escapeHtml(formatDate(item.createdAt))}</td>
                <td><span class="response-badge ${isForgiven ? "forgiven" : "not-forgiven"}">${isForgiven ? "Sudah maafin" : "Belum bisa maafin"}</span></td>
              </tr>`;
          })
          .join("");
      }

      lastUpdated.textContent = `Diperbarui ${new Intl.DateTimeFormat("id-ID", { timeStyle: "short" }).format(new Date())}`;
    } catch (error) {
      responsesBody.innerHTML = emptyRow("Data tidak bisa dimuat. Tekan Muat ulang.");
      dashboardStatus.textContent = "Ada gangguan saat mengambil data.";
    }
  }

  if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
      setButtonLoading(refreshButton, true, "Memuat...", "Muat ulang");
      await loadDashboard();
      setButtonLoading(refreshButton, false, "Memuat...", "Muat ulang");
    });
    loadDashboard();
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      setButtonLoading(logoutButton, true, "Keluar...", "Keluar");

      try {
        const response = await fetch("/api?route=admin-logout", {
          method: "POST",
          credentials: "same-origin"
        });
        if (response.ok) {
          window.location.href = "/admin";
          return;
        }
        dashboardStatus.textContent = "Gagal keluar. Coba lagi.";
      } catch (error) {
        dashboardStatus.textContent = "Server tidak bisa dihubungi. Coba lagi.";
      }

      setButtonLoading(logoutButton, false, "Keluar...", "Keluar");
    });
  }
})();
