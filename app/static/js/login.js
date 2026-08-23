(function () {
  const EYE_OPEN = `
    <path d="M2.5 12 C4.8 7.5 8.2 5.2 12 5.2 C15.8 5.2 19.2 7.5 21.5 12 C19.2 16.5 15.8 18.8 12 18.8 C8.2 18.8 4.8 16.5 2.5 12 Z"></path>
    <circle cx="12" cy="12" r="3.2"></circle>`;
  const EYE_SLASH = `<path d="M4 20 L20 4"></path>`;

  document.getElementById("root").innerHTML = `
    <div id="login-root">
      <div id="login-card">
        <div class="login-head">
          <div class="login-title">Вход</div>
          <div class="login-subtitle">Войдите в свой аккаунт, чтобы продолжить</div>
        </div>

        <div class="login-fields">
          <div class="field">
            <label class="field-label" for="email">Почта</label>
            <input class="glass-input" id="email" type="email" placeholder="name@example.com">
          </div>

          <div class="field">
            <label class="field-label" for="password">Пароль</label>
            <div class="password-wrap">
              <input class="glass-input with-eye" id="password" type="password" placeholder="••••••••">
              <button type="button" class="eye-btn" aria-label="Показать/скрыть пароль">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="rgba(60,60,80,0.55)"
                     stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${EYE_OPEN}</svg>
              </button>
            </div>
          </div>
        </div>

        <div class="login-error"></div>

        <button class="submit-btn" disabled>Войти</button>

        <a class="guest-link" href="#">Просмотр товаров как гость</a>
      </div>
    </div>`;

  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const eyeButton = document.querySelector(".eye-btn");
  const eyeSvg = eyeButton.querySelector("svg");
  const errorBox = document.querySelector(".login-error");
  const submitButton = document.querySelector(".submit-btn");
  const guestLink = document.querySelector(".guest-link");

  let submitted = false;
  let showPassword = false;
  let ready = window.PywebviewBridge.isPywebviewApiReady();

  function setError(message) {
    errorBox.textContent = message || "";
    errorBox.classList.toggle("visible", Boolean(message));
  }

  function syncSubmitState() {
    submitButton.disabled = submitted || !ready;
  }

  async function submit() {
    if (submitted || !ready) return;
    setError("");
    if (!emailInput.value.trim() || !passwordInput.value) {
      setError("Введите почту и пароль");
      return;
    }
    submitted = true;
    syncSubmitState();
    try {
      const res = await window.pywebview.api.login(emailInput.value.trim(), passwordInput.value);
      if (!res || !res.ok) {
        setError((res && res.error) || "Не удалось войти");
        submitted = false;
        syncSubmitState();
      }
      // при успехе Python сам переключит окно на дашборд — здесь ничего делать не нужно
    } catch (e) {
      setError("Ошибка соединения с приложением");
      submitted = false;
      syncSubmitState();
    }
  }

  for (const input of [emailInput, passwordInput]) {
    input.addEventListener("input", () => setError(""));
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  }

  eyeButton.addEventListener("click", () => {
    showPassword = !showPassword;
    passwordInput.type = showPassword ? "text" : "password";
    eyeSvg.innerHTML = showPassword ? EYE_OPEN + EYE_SLASH : EYE_OPEN;
  });

  submitButton.addEventListener("click", submit);

  guestLink.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!ready) return;
    await window.pywebview.api.enter_guest();
  });

  syncSubmitState();
  if (!ready) {
    window.PywebviewBridge.onPywebviewReady(() => {
      ready = true;
      syncSubmitState();
    });
  }
})();
