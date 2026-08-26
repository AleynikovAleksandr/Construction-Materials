class AppConfig {
  static COMPANY_NAME = "ООО «СтройМатериалы»";

  static pageTitle(section) {
    return section ? `${section} — ${AppConfig.COMPANY_NAME}` : AppConfig.COMPANY_NAME;
  }

  static applyTitle(section) {
    document.title = AppConfig.pageTitle(section);
  }
}

window.AppConfig = AppConfig;
