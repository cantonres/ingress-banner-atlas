import { Github } from "lucide-react";
import { useLanguage } from "../i18n.jsx";

export function ArchiveStatusBar({ meta = null }) {
  const { formatNumber, t, locale } = useLanguage();
  const dayFormatter = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const formatDay = (isoDay) => {
    const date = new Date(`${isoDay}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? isoDay : dayFormatter.format(date);
  };
  // 跨日续跑时 meta.dataAsOfRange 是 [起始日, 完成日]，否则只有单一完成日
  const asOfDays = meta?.dataAsOfRange ?? (meta?.dataAsOf ? [meta.dataAsOf] : null);
  // 多城市档案按城市分别采集，逐日粒度对读者没有意义，只报「城市数 + 最近采集日」。
  const cityCount = meta?.cityCount ?? meta?.cities?.length ?? 0;

  const asOfText = (() => {
    if (!asOfDays?.length) return null;
    if (cityCount > 1) {
      return t("dataAsOfCities", {
        count: formatNumber(cityCount),
        date: formatDay(asOfDays[asOfDays.length - 1]),
      });
    }
    return asOfDays.length > 1
      ? t("dataAsOfRange", {
          from: formatDay(asOfDays[0]),
          to: formatDay(asOfDays[1]),
        })
      : t("dataAsOf", { date: formatDay(asOfDays[0]) });
  })();

  return (
    <footer className="intel-statusbar">
      <div className="intel-statusbar__legal">
        {asOfText ? <p className="intel-statusbar__asof">{asOfText}</p> : null}
        <p>{t("fanSiteDisclaimer")} {t("dataSourceNotice")} {t("upstreamCredit")}</p>
        <p>{t("ingressTrademarkNotice")}</p>
      </div>
      <nav className="intel-statusbar__links" aria-label={t("footerLinks")}>
        <a href="https://ingress.com/" target="_blank" rel="noreferrer" title={t("ingressOfficialSite")}>
          <img src={`${import.meta.env.BASE_URL}ingress-logo.svg`} alt="" aria-hidden="true" />
          <span className="sr-only">{t("ingressOfficialSite")}</span>
        </a>
        <a href="https://bannergress.com/" target="_blank" rel="noreferrer" title={t("bannergressSite")}>
          <img src={`${import.meta.env.BASE_URL}bannergress-logo.png`} alt="" aria-hidden="true" />
          <span className="sr-only">{t("bannergressSite")}</span>
        </a>
        <a href="https://github.com/Choujingress/ingress-banner-atlas" target="_blank" rel="noreferrer" title={t("githubRepository")}>
          <Github size={24} aria-hidden="true" />
          <span className="sr-only">{t("githubRepository")}</span>
        </a>
      </nav>
    </footer>
  );
}
