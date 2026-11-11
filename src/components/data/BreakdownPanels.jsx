import { Globe2 } from "lucide-react";
import { formatLocalizedNumber } from "../../i18n/formatters.js";
import { BreakdownDonut } from "./BreakdownDonut";
import { compactNumber } from "./statistics";
import { displayCountryName } from "../../utils/locations";

const categoryLabels = {
  player: "categoryPlayer",
  "mission-day": "categoryMissionDay",
};

function buildBreakdownItems(stats, t, language) {
  const leadingCountries = stats.allCountries.slice(0, 10).map((country) => ({
    id: country.code || country.country,
    label: displayCountryName(country.code, country.country, language),
    missions: country.missions,
    events: country.events,
    completions: country.completions,
  }));
  const remainingCountries = stats.allCountries.slice(10);
  const countries = remainingCountries.length
    ? [
        ...leadingCountries,
        {
          id: "other-countries",
          label: t("otherCountries"),
          missions: remainingCountries.reduce(
            (total, country) => total + country.missions,
            0,
          ),
          events: remainingCountries.reduce(
            (total, country) => total + country.events,
            0,
          ),
          completions: remainingCountries.reduce(
            (total, country) => total + country.completions,
            0,
          ),
          color: "#687a83",
        },
      ]
    : leadingCountries;
  const regions = stats.regions.map((region, index) => ({
    id: region.region,
    label: region.region,
    missions: region.missions,
    events: region.events,
    completions: region.completions,
    color: ["#42d6df", "#72a9df", "#f2c14e"][index],
  }));
  return { countries, regions };
}

export function BreakdownPanels({ stats, language, t }) {
  const items = buildBreakdownItems(stats, t, language);
  const maxTierCount = Math.max(1, ...stats.sizeTiers.map((tier) => tier.events));
  const maxCategoryCount = Math.max(1, ...stats.categories.map((row) => row.events));
  const maxCountryMissions = Math.max(
    1,
    ...stats.countries.map((country) => country.missions),
  );

  return (
    <>
      <div className="data-grid data-grid--primary">
        <section className="data-panel data-trend">
          <header>
            <div>
              <span>{t("bySize")}</span>
              <h2>{t("sizeDistribution")}</h2>
            </div>
            <small>{t("sizeDistributionHint")}</small>
          </header>
          <div className="data-tier-chart">
            {stats.sizeTiers.map((tier) => (
              <div className="data-tier-row" key={tier.tier}>
                <b>{tier.tier}</b>
                <div className="data-track">
                  <i style={{ width: `${(tier.events / maxTierCount) * 100}%` }} />
                </div>
                <strong>{formatLocalizedNumber(tier.events, language)}</strong>
                <span>
                  {formatLocalizedNumber(tier.missions, language)} {t("missions")}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="data-panel data-countries">
          <header>
            <div>
              <span>{t("byCountry")}</span>
              <h2>{t("topCountries")}</h2>
            </div>
            <Globe2 size={18} strokeWidth={1.2} />
          </header>
          <div className="data-country-list">
            {stats.countries.map((country, index) => (
              <div className="data-country-row" key={country.country}>
                <b>{String(index + 1).padStart(2, "0")}</b>
                <span>
                  <strong>{displayCountryName(country.code, country.country, language)}</strong>
                  <small>{formatLocalizedNumber(country.events, language)} {t("banners")}</small>
                </span>
                <div className="data-track">
                  <i
                    style={{
                      width: `${(country.missions / maxCountryMissions) * 100}%`,
                    }}
                  />
                </div>
                <em>{formatLocalizedNumber(country.missions, language)}</em>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="data-grid data-grid--secondary">
        <section className="data-panel data-region-panel">
          <header>
            <div>
              <span>{t("byRegion")}</span>
              <h2>{t("regionalCoverage")}</h2>
            </div>
            <small>{t("currentFilterScope")}</small>
          </header>
          <BreakdownDonut
            items={items.regions}
            total={stats.missionCount}
            label={t("regionMissionDistribution")}
            language={language}
            t={t}
          />
          <div className="data-region-table">
            <div className="data-region-head">
              <span>{t("region")}</span>
              <span>{t("banners")}</span>
              <span>{t("missions")}</span>
              <span>{t("rating")}</span>
              <span>{t("totalMissionCompletions")}</span>
            </div>
            {stats.regions.map((region) => (
              <div className="data-region-row" key={region.region}>
                <strong>{region.region}</strong>
                <span>{formatLocalizedNumber(region.events, language)}</span>
                <span>{formatLocalizedNumber(region.missions, language)}</span>
                <span>
                  {region.rated
                    ? `${(region.ratings / region.rated).toFixed(1)}%`
                    : t("noRating")}
                </span>
                <span>{compactNumber(region.completions, language)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="data-panel data-set-panel">
          <header>
            <div>
              <span>{t("byCategory")}</span>
              <h2>{t("categoryDistribution")}</h2>
            </div>
            <small>{t("currentFilterScope")}</small>
          </header>
          <div className="data-category-list">
            {stats.categories.map((row) => (
              <div
                className={`data-category-row data-category-row--${row.category}`}
                key={row.category}
              >
                <strong>{t(categoryLabels[row.category] ?? "category")}</strong>
                <div className="data-track">
                  <i style={{ width: `${(row.events / maxCategoryCount) * 100}%` }} />
                </div>
                <em>{formatLocalizedNumber(row.events, language)} {t("banners")}</em>
                <em>{formatLocalizedNumber(row.missions, language)} {t("missions")}</em>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
