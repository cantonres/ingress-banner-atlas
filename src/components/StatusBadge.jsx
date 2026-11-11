import { useLanguage } from "../i18n.jsx";

const statusKeys = {
  online: "online",
  offline: "offline",
  partially_offline: "partiallyOffline",
  // 待补齐：有槽位但任务尚未过审，拼图本身是活的。
  pending_slots: "pendingSlots",
};

export function StatusBadge({ status }) {
  const { t } = useLanguage();

  return (
    <span className={`status status--${status ?? "unknown"}`}>
      <span className="status__dot" />
      {t(statusKeys[status] ?? "unknown")}
    </span>
  );
}
