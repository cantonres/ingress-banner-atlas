import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Database, LoaderCircle, RotateCcw } from "lucide-react";
import { ArchiveStatusBar } from "./components/ArchiveStatusBar";
import { ArchiveView } from "./components/ArchiveView";
import { ActiveFilters } from "./components/ActiveFilters";
import { activeFilterEntries } from "./utils/filters";
import { FilterConsole } from "./components/FilterConsole";
import { ViewErrorBoundary, ViewCrashFallback } from "./components/ErrorBoundary";
import { RetryableLazyView } from "./components/RetryableLazyView";
import { MapWorkspace } from "./components/MapWorkspace";
import { TopBar } from "./components/TopBar";
import { ViewLoading } from "./components/ViewLoading";
import { useLanguage } from "./i18n.jsx";
import {
  buildDrilldownFacets,
  countEventsByAuthor,
  countEventsByCity,
  countEventsByCountry,
  expandAnalytics,
  filterEvents,
  INITIAL_FILTERS,
  sanitizeLocationFilters,
  scopeEventsByCountry,
  scopeEventsByRegion,
  sortEvents,
} from "./utils/archive";
import { parseUrlState, serializeUrlState } from "./utils/urlState";

// Chunk loaders stay resolvable outside render so a failed fetch can be
// retried with a fresh import() call.
const loadDataView = () =>
  import("./components/DataView").then((module) => ({ default: module.DataView }));

const assetUrl = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;

const EMPTY_META = {
  eventCount: 0,
  missionCount: 0,
  countryCount: 0,
  cityCount: 0,
  cities: [],
  categoryCounts: { player: 0, "mission-day": 0 },
  sizeTiers: [],
  dataAsOf: null,
  dataAsOfRange: null,
  dataQuality: {},
  source: "Niantic official missions via Bannergress",
};

export default function App() {
  const { t } = useLanguage();
  // Shareable state (view, filters, selected event) initializes from the URL so
  // deep links survive refreshes; UI-only state (drawer and feed) does not.
  const [initialUrlState] = useState(() => parseUrlState(window.location.search));
  const [archive, setArchive] = useState({ meta: EMPTY_META, events: [] });
  const [searchIndex, setSearchIndex] = useState(null);
  const [searchIndexState, setSearchIndexState] = useState("idle");
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [loadState, setLoadState] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [analyticsState, setAnalyticsState] = useState("idle");
  const [analyticsError, setAnalyticsError] = useState("");
  const [analyticsAttempt, setAnalyticsAttempt] = useState(0);
  const [eventDetails, setEventDetails] = useState({});
  const [detailLoadState, setDetailLoadState] = useState("idle");
  const [detailAttempt, setDetailAttempt] = useState(0);
  const [activeView, setActiveView] = useState(initialUrlState.view);
  const [filters, setFilters] = useState(initialUrlState.filters);
  const [feedRegion, setFeedRegion] = useState("all");
  const [selectedId, setSelectedId] = useState(initialUrlState.event);
  const [detailOpen, setDetailOpen] = useState(false);
  // Keep the map unobstructed on a phone while preserving the desktop activity
  // panel. The panel remains one tap away from the map toolbar.
  const [feedOpen, setFeedOpen] = useState(
    () => !window.matchMedia?.("(max-width: 760px)").matches,
  );
  const [filterConsoleOpen, setFilterConsoleOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(60);
  // Per-view retry epochs: bumping reruns the chunk import and remounts the
  // view's error boundary, giving a failed chunk a genuinely fresh fetch.
  const [viewEpochs, setViewEpochs] = useState(() => ({ map: 0, archive: 0, data: 0 }));
  const retryView = (view) =>
    setViewEpochs((current) => ({ ...current, [view]: current[view] + 1 }));
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(filters.query);
  const searchRequested = Boolean(filters.query.trim());
  // Mission titles live only in the separate index. Never present summary-only
  // matches as complete results while that index is missing.
  const searchBlocked = searchRequested && !searchIndex;
  const retrySearch = () => {
    setSearchIndexState("loading");
    setSearchAttempt((attempt) => attempt + 1);
  };
  const filterButtonRef = useRef(null);
  // URL bookkeeping: whether the current selection was user/url requested, and
  // how the next effect-driven write should land in history (typing replaces,
  // discrete actions push).
  const urlSelectionIsExplicitRef = useRef(Boolean(initialUrlState.event));
  const urlWriteModeRef = useRef("replace");

  useEffect(() => {
    const controller = new AbortController();

    async function loadArchive() {
      try {
        const response = await fetch(assetUrl("data/archive.json"), {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setArchive(data);
        // 深链接可能带着互相矛盾的大区/国家组合（例如 region=APAC&country=GB），
        // 档案到位后才能校验，这里做一次静默清理。
        setFilters((current) => sanitizeLocationFilters(data.events, current));
        // Honor a URL-selected event once the archive can validate it; never
        // let the default first item override a deep link.
        const requestedValid =
          initialUrlState.event &&
          data.events.some((event) => event.id === initialUrlState.event);
        urlWriteModeRef.current = "replace";
        urlSelectionIsExplicitRef.current = Boolean(requestedValid);
        setSelectedId(requestedValid ? initialUrlState.event : (data.events[0]?.id ?? null));
        setLoadState("ready");
      } catch (error) {
        if (error.name === "AbortError") return;
        setLoadError(error.message);
        setLoadState("error");
      }
    }

    loadArchive();
    return () => controller.abort();
    // initialUrlState.event is a stable boot-time constant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!searchRequested || searchIndex) return undefined;
    const controller = new AbortController();
    setSearchIndexState("loading");
    fetch(assetUrl("data/search-index.json"), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        setSearchIndex(data);
        setSearchIndexState("ready");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setSearchIndexState("error");
      });
    return () => controller.abort();
  }, [searchAttempt, searchIndex, searchRequested]);

  // 大区 → 国家 → 城市是三级从属：选定大区后，国家选项只列该大区下的国家；
  // 选定国家后，城市选项只列该国的城市。候选来源仍是整个档案，只是被上级收窄，
  // 所以随时能改回「全部」再换另一个大区/国家。
  const regionScopedEvents = useMemo(
    () => scopeEventsByRegion(archive.events, filters.region),
    [archive.events, filters.region],
  );
  const countries = useMemo(
    () => countEventsByCountry(regionScopedEvents),
    [regionScopedEvents],
  );
  // 拼图作者选项始终取自整个档案：作者是自由文本，随其它筛选变化会让人无从选择。
  const authors = useMemo(() => countEventsByAuthor(archive.events), [archive.events]);
  const cities = useMemo(
    () => countEventsByCity(scopeEventsByCountry(regionScopedEvents, filters.country)),
    [filters.country, regionScopedEvents],
  );
  // 拼图档案面板里的钻取链接要显示「点下去能筛出几条」。和作者下拉一样取整个档案：
  // 计数要稳定，不能随着用户在旁边调别的筛选器而跳变。
  const drilldownFacets = useMemo(
    () => buildDrilldownFacets(archive.events),
    [archive.events],
  );

  const filteredEvents = useMemo(
    () =>
      sortEvents(
        filterEvents(archive.events, filters, deferredQuery, searchIndex),
        filters.sort,
        filters.sortDir,
      ),
    [archive.events, deferredQuery, filters, searchIndex],
  );

  // A URL-selected event resolves against the full archive so a shared link
  // keeps showing its event even when the sharer's filters would hide it.
  // Filter changes clear selectedId, so normal browsing falls back to the
  // first event in the filtered result set.
  const selectedEvent = useMemo(
    () =>
      archive.events.find((event) => event.id === selectedId) ??
      filteredEvents[0],
    [archive.events, filteredEvents, selectedId],
  );
  const selectedEventDetail = selectedEvent
    ? (eventDetails[selectedEvent.id] ?? selectedEvent)
    : null;
  const feedEvents = useMemo(
    () =>
      filteredEvents.filter((event) => feedRegion === "all" || event.region === feedRegion),
    [feedRegion, filteredEvents],
  );

  useEffect(() => {
    if (activeView !== "archive" || !detailOpen || !selectedEvent?.detailPath) return;
    if (eventDetails[selectedEvent.id]) {
      setDetailLoadState("ready");
      return;
    }

    const controller = new AbortController();
    setDetailLoadState("loading");
    fetch(assetUrl(selectedEvent.detailPath), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Event detail request failed: ${response.status}`);
        return response.json();
      })
      .then((detail) => {
        setEventDetails((current) => ({ ...current, [selectedEvent.id]: detail }));
        setDetailLoadState("ready");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setDetailLoadState("error");
      });
    return () => controller.abort();
  }, [activeView, detailAttempt, detailOpen, eventDetails, selectedEvent]);

  useEffect(() => {
    if (activeView !== "data" || analytics) return;
    const controller = new AbortController();
    setAnalyticsState("loading");
    fetch(assetUrl("data/analytics.json"), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        setAnalytics(expandAnalytics(data));
        setAnalyticsState("ready");
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setAnalyticsError(error.message);
        setAnalyticsState("error");
      });
    return () => controller.abort();
  }, [activeView, analytics, analyticsAttempt]);

  useEffect(() => {
    if (!filterConsoleOpen) return undefined;
    const trigger = document.activeElement;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setFilterConsoleOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      trigger?.focus?.();
    };
  }, [filterConsoleOpen]);

  const archiveReady = loadState !== "loading";

  // Keep the query string in step with shareable state. Discrete actions push a
  // history entry; search typing and boot-time normalization replace in place.
  useEffect(() => {
    if (!archiveReady) return;
    const serialized = serializeUrlState({
      view: activeView,
      filters,
      event: urlSelectionIsExplicitRef.current ? selectedId : null,
    });
    if (serialized === window.location.search) return;
    const nextUrl = `${window.location.pathname}${serialized}${window.location.hash}`;
    if (urlWriteModeRef.current === "push") window.history.pushState(null, "", nextUrl);
    else window.history.replaceState(null, "", nextUrl);
  }, [activeView, archiveReady, filters, selectedId]);

  // Back/forward restores view, filters and selection; the detail drawer stays
  // as-is so returning through history never forces panels open.
  useEffect(() => {
    const onPopState = () => {
      const parsed = parseUrlState(window.location.search);
      urlWriteModeRef.current = "replace";
      urlSelectionIsExplicitRef.current = Boolean(parsed.event);
      startTransition(() => {
        setActiveView(parsed.view);
        setFilters(parsed.filters);
        setSelectedId(parsed.event);
        setVisibleCount(60);
        setDetailLoadState(parsed.event && eventDetails[parsed.event] ? "ready" : "idle");
      });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [eventDetails]);

  const updateFilter = (key, value) => {
    urlWriteModeRef.current = key === "query" ? "replace" : "push";
    urlSelectionIsExplicitRef.current = false;
    startTransition(() => {
      // 收窄候选列表后，原有的国家/城市选择可能不再成立，这里一并退回「全部」。
      setFilters((current) => {
        // value 可以是函数：多选类筛选器（portal 操作类型）需要拿到**最新**的当前值，
        // 否则同一帧内连点两个徽章时，两次 setState 被批到一起、闭包里的旧值会让后一次覆盖前一次。
        const next = { ...current, [key]: typeof value === "function" ? value(current[key]) : value };
        // 换排序维度时方向回到降序（高值在前）。同一维度内的升降切换走 changeSort，
        // 不经过这里，所以不会被这个重置吃掉。
        if (key === "sort") next.sortDir = INITIAL_FILTERS.sortDir;
        return sanitizeLocationFilters(archive.events, next);
      });
      setSelectedId(null);
      setVisibleCount(60);
    });
  };

  // 面板里的钻取：和 updateFilter 的唯一区别是**保留当前选中的拼图**。
  // 被钻取的要素必然属于当前拼图，所以它一定还在新结果集里 —— 面板不需要跳走，
  // 用户还能看到它在筛出来的列表里排第几。选中态也因此值得写进 URL。
  const drillDown = (key, value) => {
    urlWriteModeRef.current = "push";
    urlSelectionIsExplicitRef.current = true;
    startTransition(() => {
      setFilters((current) =>
        sanitizeLocationFilters(archive.events, { ...current, [key]: value }),
      );
      setVisibleCount(60);
    });
  };

  // 表头点击：同一列切换升降序，换列则先降序。sort + sortDir 必须一起改，
  // 分两次 updateFilter 会画出两条历史记录。
  const changeSort = (sort, sortDir) => {
    urlWriteModeRef.current = "push";
    urlSelectionIsExplicitRef.current = false;
    startTransition(() => {
      setFilters((current) => ({ ...current, sort, sortDir }));
      setSelectedId(null);
      setVisibleCount(60);
    });
  };

  const clearFilter = (key) => {
    updateFilter(key, INITIAL_FILTERS[key]);
    if (activeFilterEntries(filters).length === 1) filterButtonRef.current?.focus();
  };

  const changeView = (view) => {
    urlWriteModeRef.current = "push";
    setActiveView(view);
    setFilterConsoleOpen(false);
    if (view !== "map") setFeedOpen(false);
  };

  const resetFilters = () => {
    urlWriteModeRef.current = "push";
    urlSelectionIsExplicitRef.current = false;
    startTransition(() => {
      setFilters(INITIAL_FILTERS);
      setSelectedId(null);
      setVisibleCount(60);
    });
  };

  const resetFromFilterBar = () => {
    resetFilters();
    filterButtonRef.current?.focus();
  };

  const selectEvent = (id) => {
    urlWriteModeRef.current = "push";
    urlSelectionIsExplicitRef.current = true;
    setSelectedId(id);
    setDetailLoadState(eventDetails[id] ? "ready" : "idle");
    setDetailOpen(true);
  };

  const filteredAnalyticsEvents = useMemo(() => {
    if (!analytics?.events) return [];
    const visibleEvents = new Map(filteredEvents.map((event) => [event.id, event]));
    return analytics.events
      .filter((event) => visibleEvents.has(event.id))
      .map((event) => ({ ...visibleEvents.get(event.id), ...event }));
  }, [analytics, filteredEvents]);

  if (loadState === "loading") {
    return (
      <main className="boot-screen">
        <LoaderCircle size={34} strokeWidth={1.1} />
        <strong>{t("establishingLink")}</strong>
        <span>{t("indexingArchive")}</span>
      </main>
    );
  }

  if (loadState === "error") {
    return (
      <main className="boot-screen boot-screen--error">
        <Database size={34} strokeWidth={1.1} />
        <strong>{t("archiveLinkFailed")}</strong>
        <span>{t("requestErrorDetail", { detail: loadError })}</span>
        <button className="command-button" type="button" onClick={() => window.location.reload()}>
          {t("retryLink")} <RotateCcw size={16} />
        </button>
      </main>
    );
  }

  return (
    <div className={`intel-shell intel-shell--${activeView}`}>
      <TopBar
        activeView={activeView}
        onViewChange={changeView}
        filters={filters}
        onFilterChange={updateFilter}
        filtersOpen={filterConsoleOpen}
        onToggleFilters={() => setFilterConsoleOpen((open) => !open)}
        activeFilterCount={activeFilterEntries(filters).length}
        filterButtonRef={filterButtonRef}
      />
      <ActiveFilters
        filters={filters}
        cities={cities}
        resultCount={filteredEvents.length}
        searchState={searchBlocked ? (searchIndexState === "error" ? "error" : "loading") : "ready"}
        pending={isPending || deferredQuery !== filters.query}
        onClear={clearFilter}
        onReset={resetFromFilterBar}
      />

      <main className={`intel-workspace intel-workspace--${activeView}`}>
        {searchBlocked ? (
          <ViewLoading
            label={t(searchIndexState === "error" ? "searchIndexLoadFailed" : "loadingSearchIndex")}
            onRetry={searchIndexState === "error" ? retrySearch : undefined}
          />
        ) : null}
        {!searchBlocked && activeView === "map" ? (
          <ViewErrorBoundary key={`map-${viewEpochs.map}`} fallback={ViewCrashFallback}>
            <MapWorkspace
              events={filteredEvents}
              selectedEvent={selectedEvent}
              onSelect={selectEvent}
              feedEvents={feedEvents}
              feedRegion={feedRegion}
              onFeedRegionChange={setFeedRegion}
              onOpenArchive={() => changeView("archive")}
              feedOpen={feedOpen}
              onOpenFeed={() => setFeedOpen(true)}
              onCloseFeed={() => setFeedOpen(false)}
              detailOpen={detailOpen}
              onCloseDetail={() => setDetailOpen(false)}
              filters={filters}
              facets={drilldownFacets}
              onDrillDown={drillDown}
            />
          </ViewErrorBoundary>
        ) : null}

        {!searchBlocked && activeView === "archive" ? (
          <ViewErrorBoundary key={`archive-${viewEpochs.archive}`} fallback={ViewCrashFallback}>
            <ArchiveView
              events={filteredEvents}
              selectedEvent={selectedEvent}
              selectedEventDetail={selectedEventDetail}
              onSelect={selectEvent}
              detailOpen={detailOpen}
              onCloseDetail={() => setDetailOpen(false)}
              detailLoadState={detailLoadState}
              onRetryDetail={() => {
                setDetailLoadState("loading");
                setDetailAttempt((attempt) => attempt + 1);
              }}
              visibleCount={visibleCount}
              onLoadMore={() => setVisibleCount((count) => count + 60)}
              isPending={isPending}
              onResetFilters={resetFilters}
              sort={filters.sort}
              sortDir={filters.sortDir}
              onSortChange={changeSort}
              filters={filters}
              facets={drilldownFacets}
              onDrillDown={drillDown}
            />
          </ViewErrorBoundary>
        ) : null}

        {!searchBlocked && activeView === "data" ? (
          analyticsState === "ready" ? (
            <RetryableLazyView
              load={loadDataView}
              epoch={viewEpochs.data}
              onRetry={() => retryView("data")}
              render={(DataView) => (
                <DataView
                  events={filteredAnalyticsEvents}
                  onSelect={(id) => {
                    selectEvent(id);
                    setActiveView("archive");
                  }}
                />
              )}
            />
          ) : (
            <ViewLoading
              label={
                analyticsState === "error"
                  ? t("analyticsLoadFailed", { detail: analyticsError })
                  : t("loadingAnalytics")
              }
              onRetry={
                analyticsState === "error"
                  ? () => {
                      setAnalyticsError("");
                      setAnalyticsAttempt((attempt) => attempt + 1);
                    }
                  : undefined
              }
            />
          )
        ) : null}

        {filterConsoleOpen ? (
          <FilterConsole
            filters={filters}
            sizeTiers={archive.meta.sizeTiers}
            countries={countries}
            cities={cities}
            authors={authors}
            objectiveCounts={archive.meta.objectiveCounts}
            onFilterChange={updateFilter}
            onReset={resetFilters}
            onClose={() => setFilterConsoleOpen(false)}
          />
        ) : null}
      </main>

      <ArchiveStatusBar meta={archive.meta} />
    </div>
  );
}
