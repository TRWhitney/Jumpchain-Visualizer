import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { translate } from "../localization";
import { StaticTagRadar } from "../tracker/TagRadar";
import { tagCategories, type TagDefinition } from "../tracker/model";
import { useContextMenu } from "../ui";
import {
  filterSavedChains,
  normalizeChainName,
  primaryTagForChain,
  type SavedChain,
} from "./chainRegistry";

function ChainStarButton({
  chain,
  onToggle,
}: {
  chain: SavedChain;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="app-chain-star"
      aria-label={`${chain.starred ? "Unstar" : "Star"} ${chain.name}`}
      aria-pressed={chain.starred}
      title={`${chain.starred ? "Unstar" : "Star"} ${chain.name}`}
      onClick={onToggle}
    >
      <span aria-hidden="true">{chain.starred ? "★" : "☆"}</span>
    </button>
  );
}

export function RecentChain({
  chain,
  tags,
  colorNameByPrimaryTag,
  onOpen,
  onToggleStar,
  onDelete,
}: {
  chain: SavedChain;
  tags: Record<string, TagDefinition>;
  colorNameByPrimaryTag: boolean;
  onOpen: () => void;
  onToggleStar: () => void;
  onDelete: () => void;
}) {
  const { openContextMenu, openContextMenuFromKeyboard } = useContextMenu();
  const primaryTag = primaryTagForChain(chain);
  const primaryTagDefinition = primaryTag ? tags[primaryTag] : null;
  const menu = {
    label: translate("ui.appShell.ariaLabel.chainActions", {
      chain: chain.name,
    }),
    actions: [
      {
        id: "open",
        label: translate("common.open"),
        onAction: onOpen,
      },
      {
        id: "star",
        label: translate(chain.starred ? "common.unstar" : "common.star"),
        onAction: onToggleStar,
      },
      {
        id: "delete",
        label: translate("common.deleteChain"),
        danger: true,
        separatorBefore: true,
        onAction: onDelete,
      },
    ],
  };
  return (
    <div
      className="app-recent-work"
      onContextMenu={(event) => openContextMenu(event, menu)}
    >
      <span>
        <strong
          className={
            colorNameByPrimaryTag && primaryTagDefinition
              ? "is-primary-tag-colored"
              : undefined
          }
          style={
            colorNameByPrimaryTag && primaryTagDefinition
              ? ({
                  "--chain-name-color": primaryTagDefinition.color,
                } as CSSProperties)
              : undefined
          }
        >
          {chain.name}
        </strong>
        <small>
          {chain.jumpCount} {chain.jumpCount === 1 ? "jump" : "jumps"} ·{" "}
          {chain.lastOpenedLabel.toLocaleLowerCase()}
        </small>
      </span>
      <div className="app-recent-actions">
        {chain.starred && (
          <span
            className="app-chain-star-indicator"
            role="img"
            aria-label={`${chain.name} is starred`}
          >
            ★
          </span>
        )}
        <button
          type="button"
          aria-haspopup="menu"
          onKeyDown={(event) => openContextMenuFromKeyboard(event, menu)}
          onClick={onOpen}
        >
          {translate("ui.appShell.text.resume")}
        </button>
      </div>
    </div>
  );
}

export function ChainHub({
  active,
  chains,
  tags,
  colorNamesByPrimaryTag,
  includeItemTags,
  onCreate,
  onOpen,
  onToggleStar,
  onDelete,
  onUpdateDetails,
}: {
  active: boolean;
  chains: readonly SavedChain[];
  tags: Record<string, TagDefinition>;
  colorNamesByPrimaryTag: boolean;
  includeItemTags: boolean;
  onCreate: (name: string) => boolean;
  onOpen: (chain: SavedChain) => void;
  onToggleStar: (chain: SavedChain) => void;
  onDelete: (chain: SavedChain) => void;
  onUpdateDetails: (id: string, name: string, description: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const visibleChains = useMemo(
    () => filterSavedChains(chains, search),
    [chains, search],
  );
  return (
    <div className="app-chain-hub-content">
      <header className="app-chain-hub-heading">
        <div>
          <p className="app-mock-kicker">
            {translate("ui.appShell.text.chainTracker")}
          </p>
          <h1
            id="app-chain-heading"
            className="app-route-heading"
            data-route-heading
            tabIndex={-1}
          >
            {translate("ui.appShell.text.yourChains")}
          </h1>
          <p>
            {translate(
              "ui.appShell.text.resumeAJourneyUpdateItsDetailsOrSetOut",
            )}
          </p>
        </div>
        <span>
          <strong>{chains.length}</strong>
          <small>{translate("ui.appShell.text.savedChains")}</small>
        </span>
      </header>

      <form
        className="app-new-chain"
        onSubmit={(event) => {
          event.preventDefault();
          if (onCreate(newName)) setNewName("");
        }}
      >
        <span className="app-entry-icon" aria-hidden="true">
          +
        </span>
        <div>
          <label htmlFor="new-chain-name">
            {translate("ui.appShell.text.startANewChain")}
          </label>
          <p>
            {translate("ui.appShell.text.nameItNowYouCanEditItsDetailsFrom")}
          </p>
        </div>
        <input
          id="new-chain-name"
          spellCheck
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder={translate("ui.appShell.placeholder.chainName")}
          maxLength={80}
          required
        />
        <button type="submit">
          {translate("ui.appShell.text.startChain")}
        </button>
      </form>

      <section
        className="app-saved-chains"
        aria-labelledby="saved-chains-heading"
      >
        <div className="app-saved-chains-heading">
          <div>
            <h2 id="saved-chains-heading">
              {translate("ui.appShell.text.allSavedChains")}
            </h2>
            <p>
              {translate(
                "ui.appShell.text.starredChainsFirstThenByWhenYouLastOpened",
              )}
            </p>
          </div>
          <label className="app-chain-search">
            <span>{translate("ui.appShell.text.searchSavedChains")}</span>
            <input
              type="search"
              spellCheck={false}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={translate(
                "ui.appShell.placeholder.nameOrDescription",
              )}
            />
          </label>
          <span>
            {visibleChains.length === chains.length
              ? `${chains.length} total`
              : `${visibleChains.length} of ${chains.length}`}
          </span>
        </div>
        <div className="app-chain-card-list" tabIndex={0}>
          {visibleChains.map((chain) => (
            <ChainCard
              key={`${chain.id}:${active ? "active" : "inactive"}`}
              chain={chain}
              tags={tags}
              colorNameByPrimaryTag={colorNamesByPrimaryTag}
              includeItemTags={includeItemTags}
              onOpen={() => onOpen(chain)}
              onToggleStar={() => onToggleStar(chain)}
              onDelete={() => onDelete(chain)}
              onUpdateDetails={(name, description) =>
                onUpdateDetails(chain.id, name, description)
              }
            />
          ))}
          {!visibleChains.length && (
            <div className="app-chain-empty" role="status">
              <strong>
                {translate("ui.appShell.text.noSavedChainsMatch")}
                {search.trim()}”.
              </strong>
              <span>
                {translate(
                  "ui.appShell.text.tryAChainNameOrWordsFromItsDescription",
                )}
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ChainCard({
  chain,
  tags,
  colorNameByPrimaryTag,
  includeItemTags,
  onOpen,
  onToggleStar,
  onDelete,
  onUpdateDetails,
}: {
  chain: SavedChain;
  tags: Record<string, TagDefinition>;
  colorNameByPrimaryTag: boolean;
  includeItemTags: boolean;
  onOpen: () => void;
  onToggleStar: () => void;
  onDelete: () => void;
  onUpdateDetails: (name: string, description: string) => void;
}) {
  const { openContextMenu, openContextMenuFromKeyboard } = useContextMenu();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(chain.name);
  const [description, setDescription] = useState(chain.description);
  const inputRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);
  const [summaryPosition, setSummaryPosition] = useState<CSSProperties | null>(
    null,
  );
  const primaryTag = primaryTagForChain(chain);
  const primaryTagDefinition = primaryTag ? tags[primaryTag] : null;
  const totalTagged = tagCategories.reduce(
    (sum, category) => sum + chain.tagCounts[category],
    0,
  );
  const summaryId = `chain-summary-${chain.id}`;

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const menu = {
    label: translate("ui.appShell.ariaLabel.chainActions", {
      chain: chain.name,
    }),
    actions: [
      {
        id: "open",
        label: translate("common.open"),
        onAction: onOpen,
      },
      {
        id: "edit",
        label: translate("common.editDetails"),
        onAction: () => setEditing(true),
      },
      {
        id: "star",
        label: translate(chain.starred ? "common.unstar" : "common.star"),
        onAction: onToggleStar,
      },
      {
        id: "delete",
        label: translate("common.deleteChain"),
        danger: true,
        separatorBefore: true,
        onAction: onDelete,
      },
    ],
  };

  const positionSummary = () => {
    const trigger = avatarRef.current?.getBoundingClientRect();
    if (!trigger) return;
    const gutter = 12;
    const width = 18 * 16;
    const estimatedHeight = 17.5 * 16;
    const openLeft = trigger.left > window.innerWidth / 2;
    setSummaryPosition({
      position: "fixed",
      left: Math.max(
        gutter,
        Math.min(
          window.innerWidth - width - gutter,
          openLeft ? trigger.left - width - gutter : trigger.right + gutter,
        ),
      ),
      top: Math.max(
        gutter,
        Math.min(trigger.top, window.innerHeight - estimatedHeight - gutter),
      ),
    });
  };

  return (
    <article
      className={`app-chain-card${editing ? " is-editing" : ""}`}
      onContextMenu={(event) => openContextMenu(event, menu)}
    >
      <div
        ref={avatarRef}
        className="app-chain-card-avatar"
        onMouseEnter={positionSummary}
      >
        <button
          className="app-chain-card-mark"
          type="button"
          aria-describedby={summaryId}
          aria-label={`Show ${chain.name} tag summary`}
          onFocus={positionSummary}
        >
          {chain.name.slice(0, 1).toUpperCase()}
        </button>
        <div
          id={summaryId}
          className="app-chain-tag-summary"
          role="tooltip"
          style={summaryPosition ?? undefined}
        >
          <header>
            <div>
              <span>
                {includeItemTags ? "Perk and item profile" : "Perk profile"}
              </span>
              <strong>{chain.name}</strong>
            </div>
            <span>
              {totalTagged} {translate("ui.appShell.text.tagged")}
              {includeItemTags ? "records" : "perks"}
            </span>
          </header>
          <StaticTagRadar
            counts={chain.tagCounts}
            tags={tags}
            label={`${chain.name} ${includeItemTags ? "perk and item" : "perk"} category radar`}
            unitLabel={includeItemTags ? "records" : "perks"}
          />
          <p>
            {primaryTagDefinition
              ? `Strongest category: ${primaryTagDefinition.label} with ${chain.tagCounts[primaryTag!]} ${includeItemTags ? "records" : "perks"}.`
              : `No tagged ${includeItemTags ? "records" : "perks"} yet.`}
          </p>
        </div>
      </div>
      <div className="app-chain-card-copy">
        {editing ? (
          <form
            className="app-edit-chain"
            onSubmit={(event) => {
              event.preventDefault();
              const normalized = normalizeChainName(name);
              if (!normalized) return;
              onUpdateDetails(normalized, description);
              setName(normalized);
              setEditing(false);
            }}
          >
            <label htmlFor={`rename-${chain.id}`}>
              {translate("ui.appShell.text.chainName")}
            </label>
            <input
              ref={inputRef}
              id={`rename-${chain.id}`}
              value={name}
              spellCheck
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              required
            />
            <label htmlFor={`description-${chain.id}`}>
              {translate("ui.appShell.text.description")}
            </label>
            <textarea
              id={`description-${chain.id}`}
              value={description}
              spellCheck
              onChange={(event) => setDescription(event.target.value)}
              maxLength={240}
              rows={2}
              placeholder={translate(
                "ui.appShell.placeholder.describeThisChain",
              )}
            />
            <button type="submit">{translate("ui.appShell.text.save")}</button>
            <button
              type="button"
              onClick={() => {
                setName(chain.name);
                setDescription(chain.description);
                setEditing(false);
              }}
            >
              {translate("ui.appShell.text.cancel")}
            </button>
          </form>
        ) : (
          <>
            <h3
              data-primary-tag={primaryTag ?? undefined}
              style={
                colorNameByPrimaryTag && primaryTagDefinition
                  ? ({
                      "--chain-name-color": primaryTagDefinition.color,
                    } as CSSProperties)
                  : undefined
              }
              className={
                colorNameByPrimaryTag && primaryTagDefinition
                  ? "is-primary-tag-colored"
                  : undefined
              }
            >
              {chain.name}
            </h3>
            <p>{chain.description}</p>
          </>
        )}
        <small>{chain.lastOpenedLabel}</small>
      </div>
      <dl>
        <div>
          <dt>{translate("ui.appShell.text.jumps")}</dt>
          <dd>{chain.jumpCount}</dd>
        </div>
      </dl>
      <button
        type="button"
        className="app-card-delete"
        aria-label={`Delete ${chain.name}`}
        title={`Delete ${chain.name}`}
        onClick={onDelete}
      >
        {translate("ui.appShell.text.delete")}
      </button>
      {!editing && (
        <div className="app-chain-card-actions">
          <button
            type="button"
            aria-haspopup="menu"
            onKeyDown={(event) => openContextMenuFromKeyboard(event, menu)}
            onClick={onOpen}
          >
            {translate("ui.appShell.text.open")}
          </button>
          <button
            type="button"
            className="app-chain-secondary-action"
            aria-label={`Edit ${chain.name}`}
            onClick={() => setEditing(true)}
          >
            {translate("ui.appShell.text.editDetails")}
          </button>
          <ChainStarButton chain={chain} onToggle={onToggleStar} />
        </div>
      )}
    </article>
  );
}
