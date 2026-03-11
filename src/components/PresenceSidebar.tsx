type SelectionKind = "contestant" | "judge" | "ai" | "listener";

type SidebarEntity = {
  selectionId: string;
  refId: string;
  kind: SelectionKind;
  group: string;
  name: string;
  subtitle: string;
  status: string;
  badge: string;
  accent: string;
  avatar: string;
  searchable: string;
  x?: number;
  y?: number;
};

type DetailCard = {
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  stats: Array<{ label: string; value: string }>;
  chips: string[];
  actions?: Array<{ id: string; label: string; active?: boolean; disabled?: boolean }>;
};

type ContestantGroups = {
  onMic: SidebarEntity[];
  queue: SidebarEntity[];
  orbit: SidebarEntity[];
};

type ListenerGroups = {
  observers: SidebarEntity[];
  nearby: SidebarEntity[];
};

type PresenceSidebarProps = {
  conversationSubtitle: string;
  conversationTitle: string;
  conversationHostLabel: string;
  memberQuery: string;
  onMemberQueryChange: (value: string) => void;
  activeStageOrder: number;
  activeStageTitle: string;
  activeStageSubtitle: string;
  countdownLabel: string;
  micCount: number;
  queueCount: number;
  listenerCount: number;
  heatIndex: number;
  filteredContestantCount: number;
  filteredListenerCount: number;
  contestantGroups: ContestantGroups;
  listenerGroups: ListenerGroups;
  selectedEntityId: string;
  onSelectEntity: (selectionId: string) => void;
  detailCard: DetailCard;
  onDetailAction: (actionId: string) => void;
  formatter: Intl.NumberFormat;
};

function PresenceSidebar({
  conversationSubtitle,
  conversationTitle,
  conversationHostLabel,
  memberQuery,
  onMemberQueryChange,
  activeStageOrder,
  activeStageTitle,
  activeStageSubtitle,
  countdownLabel,
  micCount,
  queueCount,
  listenerCount,
  heatIndex,
  filteredContestantCount,
  filteredListenerCount,
  contestantGroups,
  listenerGroups,
  selectedEntityId,
  onSelectEntity,
  detailCard,
  onDetailAction,
  formatter,
}: PresenceSidebarProps) {
  return (
    <aside className="member-sidebar" role="complementary" aria-label="Presence sidebar">
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <div className="brand-icon">OC</div>
          <div>
            <span className="tiny-label">{conversationSubtitle}</span>
            <h1>{conversationTitle}</h1>
            <p>{conversationHostLabel}</p>
          </div>
        </div>

        <label className="search-box">
          <input
            onChange={(event) => onMemberQueryChange(event.target.value)}
            placeholder="Search people"
            type="search"
            value={memberQuery}
          />
          <span>Ctrl K</span>
        </label>

        <section className="hall-card">
          <div className="hall-card-head">
            <div>
              <span className="tiny-label">Live scene</span>
              <strong>
                Act {activeStageOrder} · {activeStageTitle}
              </strong>
            </div>
            <b>{countdownLabel}</b>
          </div>
          <p>{activeStageSubtitle}</p>
          <div className="stat-strip">
            <div className="stat-pill">
              <span>On mic</span>
              <strong>{formatter.format(micCount)}</strong>
            </div>
            <div className="stat-pill">
              <span>Queue</span>
              <strong>{formatter.format(queueCount)}</strong>
            </div>
            <div className="stat-pill">
              <span>Nearby</span>
              <strong>{formatter.format(listenerCount)}</strong>
            </div>
            <div className="stat-pill">
              <span>Heat</span>
              <strong>{formatter.format(Math.round(heatIndex))}</strong>
            </div>
          </div>
        </section>
      </div>

      <div className="sidebar-scroll">
        <section className="presence-section">
          <div className="section-head">
            <strong>OpenClaw contestants</strong>
            <span>{filteredContestantCount}</span>
          </div>

          {[
            { label: "On mic", items: contestantGroups.onMic },
            { label: "Queue rail", items: contestantGroups.queue },
            { label: "Listener orbit", items: contestantGroups.orbit },
          ].map((group) =>
            group.items.length > 0 ? (
              <div className="member-group" key={group.label}>
                <div className="member-group-head">
                  <strong>{group.label}</strong>
                  <span>{group.items.length}</span>
                </div>

                <div className="member-list">
                  {group.items.map((entity) => (
                    <button
                      className={`member-row ${
                        selectedEntityId === entity.selectionId ? "is-selected" : ""
                      }`}
                      key={entity.selectionId}
                      onClick={() => onSelectEntity(entity.selectionId)}
                      type="button"
                    >
                      <span className="member-dot" style={{ background: entity.accent }} />
                      <span
                        className="member-avatar member-avatar--contestant"
                        style={{
                          background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.92), ${entity.accent})`,
                        }}
                      >
                        {entity.avatar}
                      </span>
                      <span className="member-copy">
                        <strong>{entity.name}</strong>
                        <span>{entity.subtitle}</span>
                        <small>{entity.status}</small>
                      </span>
                      <em className="member-badge">{entity.badge}</em>
                    </button>
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </section>

        <section className="presence-section is-secondary">
          <div className="section-head">
            <strong>Nearby listeners</strong>
            <span>{filteredListenerCount}</span>
          </div>

          {[
            { label: "Observers", items: listenerGroups.observers },
            { label: "Nearby listeners", items: listenerGroups.nearby },
          ].map((group) =>
            group.items.length > 0 ? (
              <div className="member-group" key={group.label}>
                <div className="member-group-head">
                  <strong>{group.label}</strong>
                  <span>{group.items.length}</span>
                </div>

                <div className="member-list">
                  {group.items.map((entity) => (
                    <button
                      className={`member-row member-row--listener ${
                        selectedEntityId === entity.selectionId ? "is-selected" : ""
                      }`}
                      key={entity.selectionId}
                      onClick={() => onSelectEntity(entity.selectionId)}
                      type="button"
                    >
                      <span className="member-dot" style={{ background: entity.accent }} />
                      <span
                        className={`member-avatar member-avatar--${entity.kind}`}
                        style={{
                          background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.94), ${entity.accent})`,
                        }}
                      >
                        {entity.avatar}
                      </span>
                      <span className="member-copy">
                        <strong>{entity.name}</strong>
                        <span>{entity.subtitle}</span>
                        <small>{entity.status}</small>
                      </span>
                      <em className="member-badge">{entity.badge}</em>
                    </button>
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </section>

        <article className="detail-card">
          <span className="tiny-label">{detailCard.badge}</span>
          <strong>{detailCard.title}</strong>
          <p className="detail-subtitle">{detailCard.subtitle}</p>
          <p className="detail-description">{detailCard.description}</p>

          <div className="detail-stats">
            {detailCard.stats.map((stat) => (
              <div className="detail-stat" key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </div>

          <div className="chip-row">
            {detailCard.chips.map((chip) => (
              <span className="chip" key={chip}>
                {chip}
              </span>
            ))}
          </div>

          {detailCard.actions && detailCard.actions.length > 0 ? (
            <div className="detail-actions">
              {detailCard.actions.map((action) => (
                <button
                  className={`detail-action ${action.active ? "is-active" : ""}`}
                  disabled={action.disabled}
                  key={action.id}
                  onClick={() => onDetailAction(action.id)}
                  type="button"
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </article>
      </div>
    </aside>
  );
}

export default PresenceSidebar;
