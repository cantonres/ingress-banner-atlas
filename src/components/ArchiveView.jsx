import { useLanguage } from "../i18n.jsx";
import { EventDetail } from "./EventDetail";
import { EventTable } from "./EventTable";

export function ArchiveView({
  events,
  selectedEvent,
  selectedEventDetail,
  onSelect,
  detailOpen,
  onCloseDetail,
  detailLoadState,
  onRetryDetail,
  visibleCount,
  onLoadMore,
  isPending,
  onResetFilters,
  sort,
  sortDir,
  onSortChange,
  filters,
  facets,
  onDrillDown,
}) {
  const { formatNumber, t } = useLanguage();

  return (
    <section className="archive-screen">
      <header className="intel-surface-heading">
        <div>
          <span>{t("archiveDatabase")}</span>
          <h1>{t("archiveIndex")}</h1>
        </div>
        <div className="archive-tools">
          <strong>{formatNumber(events.length)} {t("banners")}</strong>
        </div>
      </header>
      <div className={`archive-layout ${detailOpen ? "" : "detail-closed"}`}>
        <div className={`primary-surface ${isPending ? "is-pending" : ""}`}>
          <EventTable
            events={events}
            selectedId={selectedEvent?.id}
            onSelect={onSelect}
            visibleCount={visibleCount}
            onLoadMore={onLoadMore}
            onResetFilters={onResetFilters}
            sort={sort}
            sortDir={sortDir}
            onSortChange={onSortChange}
          />
        </div>
        <EventDetail
          event={selectedEventDetail}
          open={detailOpen}
          loading={detailLoadState === "loading"}
          loadError={detailLoadState === "error"}
          onRetryDetail={onRetryDetail}
          onClose={onCloseDetail}
          filters={filters}
          facets={facets}
          onDrillDown={onDrillDown}
        />
      </div>
    </section>
  );
}
