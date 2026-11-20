// The global error page replaces the root layout, so it cannot use the
// translation provider. It carries only its own strings per language instead
// of importing every catalog, which would send all of them to the browser.
// tests/i18n.test.mjs checks they match the catalogs.
import type { Locale } from "./config";

export type GlobalErrorMessages = {
  title: string;
  description: string;
  tryAgain: string;
  returnHome: string;
};

export const globalErrorMessages: Record<Locale, GlobalErrorMessages> = {
  en: {
    title: "Page unavailable",
    description: "We could not load this page. Try again. If you were creating an invoice, check your invoice list before submitting again.",
    tryAgain: "Try again",
    returnHome: "Return home",
  },
  es: {
    title: "Página no disponible",
    description: "No pudimos cargar esta página. Inténtalo de nuevo. Si estabas creando una factura, revisa tu lista de facturas antes de volver a enviarla.",
    tryAgain: "Intentar de nuevo",
    returnHome: "Volver al inicio",
  },
  ru: {
    title: "Страница недоступна",
    description: "Не удалось загрузить эту страницу. Повторите попытку. Если вы создавали счёт, проверьте список счетов, прежде чем отправлять форму снова.",
    tryAgain: "Повторить попытку",
    returnHome: "На главную",
  },
  de: {
    title: "Seite nicht verfügbar",
    description: "Diese Seite konnte nicht geladen werden. Versuchen Sie es erneut. Falls Sie gerade eine Rechnung erstellt haben, prüfen Sie Ihre Rechnungsliste, bevor Sie erneut absenden.",
    tryAgain: "Erneut versuchen",
    returnHome: "Zur Startseite",
  },
  fr: {
    title: "Page indisponible",
    description: "Nous n’avons pas pu charger cette page. Réessayez. Si vous étiez en train de créer une facture, vérifiez votre liste de factures avant de renvoyer le formulaire.",
    tryAgain: "Réessayer",
    returnHome: "Retour à l’accueil",
  },
  pt: {
    title: "Página indisponível",
    description: "Não foi possível carregar esta página. Tente novamente. Se você estava criando uma fatura, confira a sua lista de faturas antes de enviar de novo.",
    tryAgain: "Tentar novamente",
    returnHome: "Voltar ao início",
  },
  it: {
    title: "Pagina non disponibile",
    description: "Non è stato possibile caricare questa pagina. Riprova. Se stavi creando una richiesta di pagamento, controlla l'elenco delle richieste di pagamento prima di inviare di nuovo.",
    tryAgain: "Riprova",
    returnHome: "Torna alla home",
  },
  pl: {
    title: "Strona niedostępna",
    description: "Nie udało się wczytać tej strony. Spróbuj ponownie. Jeśli była tworzona prośba o płatność, sprawdź listę próśb, zanim wyślesz ponownie.",
    tryAgain: "Spróbuj ponownie",
    returnHome: "Wróć na stronę główną",
  },
  zh: {
    title: "页面不可用",
    description: "无法加载此页面。请重试。如果你正在创建账单，请先查看你的账单列表，再重新提交。",
    tryAgain: "重试",
    returnHome: "返回首页",
  },
  uk: {
    title: "Сторінка недоступна",
    description: "Не вдалося завантажити цю сторінку. Спробуйте ще раз. Якщо ви створювали рахунок, перевірте список рахунків, перш ніж надсилати форму знову.",
    tryAgain: "Спробувати ще раз",
    returnHome: "На головну",
  },
  cs: {
    title: "Stránka není k dispozici",
    description: "Tuto stránku se nepodařilo načíst. Zkuste to znovu. Pokud se vytvářela platební výzva, zkontrolujte před dalším odesláním seznam platebních výzev.",
    tryAgain: "Zkusit znovu",
    returnHome: "Zpět na úvod",
  },
};
