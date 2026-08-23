// Общие настройки интерфейса для обеих страниц (вход и дашборд).
// Название компании держим здесь, чтобы оно задавалось в одном месте:
// отсюда его берут и заголовок окна (document.title), и шапка дашборда.

class AppConfig {
  static COMPANY_NAME = "ООО «СтройМатериалы»";

  /** Заголовок вкладки/окна: "Вход — ООО «СтройМатериалы»" либо просто название. */
  static pageTitle(section) {
    return section ? `${section} — ${AppConfig.COMPANY_NAME}` : AppConfig.COMPANY_NAME;
  }

  /** Проставляет заголовок текущей страницы. */
  static applyTitle(section) {
    document.title = AppConfig.pageTitle(section);
  }
}

window.AppConfig = AppConfig;
