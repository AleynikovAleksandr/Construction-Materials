(function () {
  const { el } = window.Dom;

  // Светлая версия с заданными параметрами
  const glassOpacity = 0.72;
  const blur = 32;
  const darkMode = false;

  const dark = darkMode;
  const v = {
    cardBg: dark ? "rgba(30,30,42," + Math.min(glassOpacity + 0.06, 0.95) + ")" : "rgba(255,255,255," + glassOpacity + ")",
    blurPx: blur + "px",
    cardBorder: dark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.55)",
    textPrimary: dark ? "rgba(245,245,250,0.95)" : "rgba(20,20,35,0.92)",
    textSecondary: dark ? "rgba(220,220,235,0.55)" : "rgba(40,40,60,0.6)",
    labelColor: dark ? "rgba(230,230,245,0.75)" : "rgba(30,30,50,0.75)",
    inputBg: dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.55)",
    inputBorder: dark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.7)",
    inputColor: dark ? "rgba(245,245,250,0.92)" : "rgba(20,20,35,0.9)",
    eyeColor: dark ? "rgba(220,220,235,0.65)" : "rgba(60,60,80,0.55)",
  };

  const inputStyle = {
    width: "100%", height: 50, borderRadius: 16, border: "1px solid " + v.inputBorder, background: v.inputBg,
    fontSize: 16, color: v.inputColor,
    boxShadow: "inset 0 1px 3px rgba(30,20,60,0.06), inset 0 1px 0 rgba(255,255,255,0.6)",
    backdropFilter: "blur(8px)", fontFamily: "inherit",
  };

  const labelStyle = { fontSize: 13, fontWeight: 600, color: v.labelColor, letterSpacing: "-0.01em", paddingLeft: 4 };
  const fieldStyle = { display: "flex", flexDirection: "column", gap: 6 };

  let submitted = false;
  let showPassword = false;
  let ready = window.PywebviewBridge.isPywebviewApiReady();

  const setError = (message) => {
    errorBox.textContent = message || "";
    errorBox.style.display = message ? "block" : "none";
  };

  const onSubmit = async () => {
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
  };

  const onGuest = async (e) => {
    e.preventDefault();
    if (!ready) return;
    await window.pywebview.api.enter_guest();
  };

  const onFieldInput = () => setError("");
  const onFieldKeyDown = (e) => { if (e.key === "Enter") onSubmit(); };

  const emailInput = el("input", {
    class: "glass-input", id: "email", type: "email", placeholder: "name@example.com",
    onInput: onFieldInput, onKeyDown: onFieldKeyDown,
    style: Object.assign({}, inputStyle, { padding: "0 18px" }),
  });

  const passwordInput = el("input", {
    class: "glass-input", id: "password", type: "password", placeholder: "••••••••",
    onInput: onFieldInput, onKeyDown: onFieldKeyDown,
    style: Object.assign({}, inputStyle, { padding: "0 50px 0 18px" }),
  });

  const eyeIcon = () => el("svg", {
    width: 21, height: 21, viewBox: "0 0 24 24", fill: "none", stroke: v.eyeColor,
    "stroke-width": 1.7, "stroke-linecap": "round", "stroke-linejoin": "round",
  },
    el("path", { d: "M2.5 12 C4.8 7.5 8.2 5.2 12 5.2 C15.8 5.2 19.2 7.5 21.5 12 C19.2 16.5 15.8 18.8 12 18.8 C8.2 18.8 4.8 16.5 2.5 12 Z" }),
    el("circle", { cx: 12, cy: 12, r: 3.2 }),
    showPassword ? el("path", { d: "M4 20 L20 4" }) : null,
  );

  const eyeButton = el("button", {
    type: "button", class: "eye-btn", "aria-label": "Показать/скрыть пароль",
    onClick: () => {
      showPassword = !showPassword;
      passwordInput.type = showPassword ? "text" : "password";
      eyeButton.replaceChild(eyeIcon(), eyeButton.firstChild);
    },
    style: {
      position: "absolute", right: 8, width: 36, height: 36, border: "none", borderRadius: 12,
      background: "transparent", cursor: "pointer", display: "grid", placeItems: "center",
      padding: 0, transition: "background 0.15s ease",
    },
  }, eyeIcon());

  const errorBox = el("div", {
    style: { fontSize: 14, fontWeight: 500, color: "#c0392b", textAlign: "center", display: "none" },
  });

  const submitButton = el("button", {
    class: "submit-btn", onClick: onSubmit,
    style: {
      height: 42, borderRadius: 15, border: "1px solid rgba(255,255,255,0.35)",
      background: "linear-gradient(180deg, rgba(70,130,255,0.95), rgba(45,100,235,0.95))",
      color: "#fff", fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", cursor: "pointer",
      boxShadow: "0 10px 24px rgba(45,100,235,0.35), inset 0 1px 0 rgba(255,255,255,0.35)",
      fontFamily: "inherit", transition: "all 0.15s ease", width: 138, alignSelf: "center",
    },
    text: "Войти",
  });

  function syncSubmitState() {
    submitButton.disabled = submitted || !ready;
    submitButton.style.cursor = submitted ? "wait" : "pointer";
  }

  const card = el("div", {
    id: "login-card",
    style: {
      display: "flex", flexDirection: "column", gap: 22, width: 476, maxWidth: "100%",
      padding: "clamp(28px,4vw,44px) clamp(22px,3.5vw,40px) clamp(26px,3.5vw,40px)",
      borderRadius: 28, background: v.cardBg,
      backdropFilter: "blur(" + v.blurPx + ") saturate(160%)", WebkitBackdropFilter: "blur(" + v.blurPx + ") saturate(160%)",
      border: "1px solid " + v.cardBorder,
      boxShadow: "0 24px 60px rgba(30,20,60,0.18), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(255,255,255,0.4)",
      animation: "glassIn 0.7s cubic-bezier(0.22,1,0.36,1)",
    },
  },
    el("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
      el("div", { style: { fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", color: v.textPrimary }, text: "Вход" }),
      el("div", { style: { fontSize: 15, fontWeight: 400, color: v.textSecondary, letterSpacing: "-0.01em" }, text: "Войдите в свой аккаунт, чтобы продолжить" }),
    ),

    el("div", { style: { display: "flex", flexDirection: "column", gap: 14 } },
      el("div", { style: fieldStyle },
        el("label", { for: "email", style: labelStyle, text: "Почта" }),
        emailInput,
      ),
      el("div", { style: fieldStyle },
        el("label", { for: "password", style: labelStyle, text: "Пароль" }),
        el("div", { style: { position: "relative", display: "flex", alignItems: "center" } },
          passwordInput,
          eyeButton,
        ),
      ),
    ),

    errorBox,
    submitButton,

    el("a", {
      href: "#", onClick: onGuest,
      style: { textAlign: "center", fontSize: 14, fontWeight: 500, color: "rgba(50,100,240,0.9)", textDecoration: "none", alignSelf: "center" },
      text: "Просмотр товаров как гость",
    }),
  );

  document.getElementById("root").appendChild(el("div", { id: "login-root" }, card));

  syncSubmitState();
  if (!ready) {
    window.PywebviewBridge.onPywebviewReady(() => {
      ready = true;
      syncSubmitState();
    });
  }
})();
