class LoginScreen {
  static EYE_OPEN = `
    <path d="M2.5 12 C4.8 7.5 8.2 5.2 12 5.2 C15.8 5.2 19.2 7.5 21.5 12 C19.2 16.5 15.8 18.8 12 18.8 C8.2 18.8 4.8 16.5 2.5 12 Z"></path>
    <circle cx="12" cy="12" r="3.2"></circle>`;
  static EYE_SLASH = `<path d="M4 20 L20 4"></path>`;

  constructor(root) {
    this.root = root;
    this.submitted = false;
    this.showPassword = false;
    this.ready = window.PywebviewBridge.isReady();
  }

  /** Точка входа: строит разметку, вешает обработчики, ждёт готовности моста. */
  start() {
    this.render();
    this.cacheElements();
    this.bindEvents();
    this.syncSubmitState();

    if (!this.ready) {
      window.PywebviewBridge.onReady(() => {
        this.ready = true;
        this.syncSubmitState();
      });
    }
  }

  render() {
    this.root.innerHTML = `
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
                       stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${LoginScreen.EYE_OPEN}</svg>
                </button>
              </div>
            </div>
          </div>

          <div class="login-error"></div>

          <button class="submit-btn" disabled>Войти</button>

          <a class="guest-link" href="#">Просмотр товаров как гость</a>
        </div>
      </div>`;
  }

  cacheElements() {
    this.emailInput = this.root.querySelector("#email");
    this.passwordInput = this.root.querySelector("#password");
    this.eyeButton = this.root.querySelector(".eye-btn");
    this.eyeSvg = this.eyeButton.querySelector("svg");
    this.errorBox = this.root.querySelector(".login-error");
    this.submitButton = this.root.querySelector(".submit-btn");
    this.guestLink = this.root.querySelector(".guest-link");
  }

  bindEvents() {
    for (const input of [this.emailInput, this.passwordInput]) {
      input.addEventListener("input", () => this.setError(""));
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") this.submit(); });
    }

    this.eyeButton.addEventListener("click", () => this.togglePassword());
    this.submitButton.addEventListener("click", () => this.submit());
    this.guestLink.addEventListener("click", (e) => this.enterAsGuest(e));
  }

  setError(message) {
    this.errorBox.textContent = message || "";
    this.errorBox.classList.toggle("visible", Boolean(message));
  }

  syncSubmitState() {
    this.submitButton.disabled = this.submitted || !this.ready;
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
    this.passwordInput.type = this.showPassword ? "text" : "password";
    this.eyeSvg.innerHTML = this.showPassword
      ? LoginScreen.EYE_OPEN + LoginScreen.EYE_SLASH
      : LoginScreen.EYE_OPEN;
  }

  async submit() {
    if (this.submitted || !this.ready) return;
    this.setError("");

    if (!this.emailInput.value.trim() || !this.passwordInput.value) {
      this.setError("Введите почту и пароль");
      return;
    }

    this.submitted = true;
    this.syncSubmitState();
    try {
      const res = await window.PywebviewBridge.api.login(
        this.emailInput.value.trim(), this.passwordInput.value
      );
      if (!res || !res.ok) {
        this.setError((res && res.error) || "Не удалось войти");
        this.submitted = false;
        this.syncSubmitState();
      }
      // при успехе Python сам переключит окно на дашборд — здесь ничего делать не нужно
    } catch (e) {
      this.setError("Ошибка соединения с приложением");
      this.submitted = false;
      this.syncSubmitState();
    }
  }

  async enterAsGuest(event) {
    event.preventDefault();
    if (!this.ready) return;
    await window.PywebviewBridge.api.enter_guest();
  }
}

new LoginScreen(document.getElementById("root")).start();
