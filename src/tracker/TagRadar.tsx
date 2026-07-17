import {
  useState,
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  radarCounts,
  resolveTagBreakdownStack,
  tagCategories,
  visibleTagBreakdownSlices,
  type TagBreakdownNode,
  type TagBreakdownSlice,
  type TagCategory,
  type TagDefinition,
  type TrackerAction,
  type TrackerState,
} from "./model";
import { CanonicalTrackerTagBadge } from "../settings/TagBadge";

export function TagBadge({ tag }: { tag: TagDefinition }) {
  return <CanonicalTrackerTagBadge tag={tag} />;
}

const pointAt = (index: number, distance: number) => {
  const angle = (Math.PI * 2 * index) / tagCategories.length - Math.PI / 2;
  return [260 + Math.cos(angle) * distance, 260 + Math.sin(angle) * distance];
};

export function StaticTagRadar({
  counts,
  tags,
  label,
  unitLabel = "perks",
}: {
  counts: Record<TagCategory, number>;
  tags: Record<string, TagDefinition>;
  label: string;
  unitLabel?: string;
}) {
  const maximum = Math.max(1, ...Object.values(counts));
  return (
    <svg
      className="static-tag-radar"
      viewBox="0 0 520 520"
      role="img"
      aria-label={label}
    >
      {[1, 2, 3, 4].map((ring) => (
        <polygon
          key={ring}
          className="radar-grid"
          points={tagCategories
            .map((_, index) => pointAt(index, 164 * (ring / 4)).join(","))
            .join(" ")}
        />
      ))}
      {tagCategories.map((category, index) => {
        const [axisX, axisY] = pointAt(index, 164);
        const [labelX, labelY] = pointAt(index, 203);
        return (
          <g key={category}>
            <line
              className="radar-axis"
              x1="260"
              y1="260"
              x2={axisX}
              y2={axisY}
            />
            <text
              className="radar-label"
              style={
                {
                  "--radar-label-color": tags[category].color,
                } as CSSProperties
              }
              x={labelX}
              y={labelY}
              textAnchor={
                Math.abs(labelX - 260) < 12
                  ? "middle"
                  : labelX < 260
                    ? "end"
                    : "start"
              }
              dominantBaseline="middle"
            >
              {tags[category].label}
            </text>
          </g>
        );
      })}
      <polygon
        className="radar-area"
        points={tagCategories
          .map((category, index) =>
            pointAt(index, 164 * (counts[category] / maximum)).join(","),
          )
          .join(" ")}
      />
      {tagCategories.map((category, index) => {
        const [cx, cy] = pointAt(index, 164 * (counts[category] / maximum));
        return (
          <circle
            key={category}
            className="radar-point"
            cx={cx}
            cy={cy}
            r="5"
            fill={tags[category].color}
          >
            <title>{`${tags[category].label}: ${counts[category]} ${unitLabel}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

const describePieArc = (
  center: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) => {
  const point = (angle: number) => [
    center + Math.cos(angle) * radius,
    center + Math.sin(angle) * radius,
  ];
  const [startX, startY] = point(startAngle);
  const [endX, endY] = point(endAngle);
  return `M ${center} ${center} L ${startX} ${startY} A ${radius} ${radius} 0 ${endAngle - startAngle > Math.PI ? 1 : 0} 1 ${endX} ${endY} Z`;
};

const compactAliases = (aliases: readonly string[]) => {
  if (!aliases.length) return "";
  return aliases.length === 1
    ? `aka ${aliases[0]}`
    : `aka ${aliases[0]} +${aliases.length - 1}`;
};

const hasTagChildren = (node: TagBreakdownNode) =>
  node.children.some((child) => !child.direct);

const readableTextColor = (color: string) => {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!match) return "#ffffff";
  const [red, green, blue] = match.slice(1).map((part) => parseInt(part, 16));
  return red * 0.299 + green * 0.587 + blue * 0.114 > 155
    ? "#171717"
    : "#ffffff";
};

function PieGraphic({
  state,
  current,
  slices,
  hovered,
  setHovered,
  toggle,
  drill,
}: {
  state: TrackerState;
  current: { node: TagBreakdownNode; isMore: boolean };
  slices: readonly TagBreakdownSlice[];
  hovered: string | null;
  setHovered: (value: string | null) => void;
  toggle: (slice: TagBreakdownSlice) => void;
  drill: (slice: TagBreakdownSlice) => void;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.node.count, 0);
  const arcs = slices.map((slice, index) => {
    const precedingCount = slices
      .slice(0, index)
      .reduce((sum, preceding) => sum + preceding.node.count, 0);
    const sliceAngle = (slice.node.count / total) * Math.PI * 2;
    const startAngle = -Math.PI / 2 + (precedingCount / total) * Math.PI * 2;
    const endAngle = startAngle + sliceAngle;
    const middle = startAngle + sliceAngle / 2;
    return {
      slice,
      path: describePieArc(260, 180, startAngle, endAngle),
      popX: Math.cos(middle) * 14,
      popY: Math.sin(middle) * 14,
    };
  });
  const captionSlice = slices.find((slice) => slice.key === hovered);
  const singleSlice = arcs.length === 1 ? arcs[0] : null;
  const centerTextColor = singleSlice
    ? readableTextColor(singleSlice.slice.color)
    : undefined;
  return (
    <>
      <svg
        id="category-radar-svg"
        viewBox="0 0 520 520"
        aria-label={`${current.node.label} tag breakdown`}
      >
        {arcs.map(({ slice, path, popX, popY }) => {
          const interaction = {
            fill: slice.color,
            className: `pie-slice${hovered === slice.key ? " is-hovered" : ""}${state.radarPoppedSlice === slice.key ? " is-popped" : ""}`,
            "data-pie-key": slice.key,
            style: {
              "--pop-x": `${popX}px`,
              "--pop-y": `${popY}px`,
            } as CSSProperties,
            tabIndex: 0,
            role: "button",
            "aria-pressed": state.radarPoppedSlice === slice.key,
            "aria-label": `${slice.isMore ? "More tags" : slice.node.label}: ${slice.node.count} records${!slice.isMore && slice.node.aliases.length ? `. Aliases: ${slice.node.aliases.join(", ")}` : ""}`,
            onClick: () => toggle(slice),
            onDoubleClick: () => drill(slice),
            onMouseEnter: () => setHovered(slice.key),
            onMouseLeave: () => setHovered(null),
            onFocus: () => setHovered(slice.key),
            onBlur: () => setHovered(null),
            onKeyDown: (event: ReactKeyboardEvent<SVGElement>) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (
                state.radarPoppedSlice === slice.key &&
                hasTagChildren(slice.node)
              )
                drill(slice);
              else toggle(slice);
            },
          };
          const title = `${slice.isMore ? "More tags" : slice.node.label}: ${slice.node.count} records${!slice.isMore && slice.node.aliases.length ? `. Aliases: ${slice.node.aliases.join(", ")}` : ""}`;
          return singleSlice ? (
            <circle key={slice.key} cx="260" cy="260" r="180" {...interaction}>
              <title>{title}</title>
            </circle>
          ) : (
            <path key={slice.key} d={path} {...interaction}>
              <title>{title}</title>
            </path>
          );
        })}
        {!singleSlice && (
          <circle cx="260" cy="260" r="56" className="pie-center-backplate" />
        )}
        <text
          x="260"
          y="255"
          className="pie-center-label"
          textAnchor="middle"
          style={centerTextColor ? { fill: centerTextColor } : undefined}
        >
          {current.isMore ? "More" : current.node.label}
        </text>
        <text
          x="260"
          y="278"
          className="pie-center-count"
          textAnchor="middle"
          style={centerTextColor ? { fill: centerTextColor } : undefined}
        >
          {current.node.count} records
        </text>
      </svg>
      <figcaption id="category-radar-caption">
        {captionSlice
          ? `${captionSlice.isMore ? "More tags" : captionSlice.node.label}: ${captionSlice.node.count} records${!captionSlice.isMore && captionSlice.node.aliases.length ? ` · ${compactAliases(captionSlice.node.aliases)}` : ""}.`
          : "Click a slice to pull it out. Double-click a category slice to open its children."}
      </figcaption>
    </>
  );
}

function PieSidebar({
  state,
  current,
  slices,
  hovered,
  setHovered,
  toggle,
  drill,
  dispatch,
}: {
  state: TrackerState;
  current: { label: string; count: number };
  slices: readonly TagBreakdownSlice[];
  hovered: string | null;
  setHovered: (value: string | null) => void;
  toggle: (slice: TagBreakdownSlice) => void;
  drill: (slice: TagBreakdownSlice) => void;
  dispatch: Dispatch<TrackerAction>;
}) {
  return (
    <section
      className="category-radar-data tracker-pie-sidebar"
      aria-labelledby="tracker-category-counts"
    >
      <header>
        <div>
          <p>Current breakdown</p>
          <h4 id="tracker-category-counts">{current.count} records</h4>
        </div>
        <RadarSort state={state} dispatch={dispatch} />
      </header>
      <table id="category-chart-table">
        <caption className="sr-only">Tag breakdown for {current.label}</caption>
        <thead>
          <tr>
            <th>Tag</th>
            <th>Records</th>
          </tr>
        </thead>
        <tbody>
          {slices.map((slice) => (
            <tr
              key={slice.key}
              data-pie-row={slice.key}
              className={`${hovered === slice.key ? "is-hovered" : ""}${state.radarPoppedSlice === slice.key ? " is-popped" : ""}`}
            >
              <th scope="row">
                <button
                  type="button"
                  className="pie-breakdown-button"
                  aria-pressed={state.radarPoppedSlice === slice.key}
                  aria-label={`${slice.isMore ? `${slice.node.children.length} more tags` : slice.node.label}, ${slice.node.count} records.${!slice.isMore && slice.node.aliases.length ? ` Aliases: ${slice.node.aliases.join(", ")}.` : ""}`}
                  title={
                    !slice.isMore && slice.node.aliases.length
                      ? `Aliases: ${slice.node.aliases.join(", ")}.`
                      : undefined
                  }
                  onClick={() => toggle(slice)}
                  onDoubleClick={() => drill(slice)}
                  onMouseEnter={() => setHovered(slice.key)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(slice.key)}
                  onBlur={() => setHovered(null)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    if (
                      state.radarPoppedSlice === slice.key &&
                      hasTagChildren(slice.node)
                    )
                      drill(slice);
                    else toggle(slice);
                  }}
                >
                  <span
                    className="pie-breakdown-swatch"
                    style={{ "--slice-color": slice.color } as CSSProperties}
                  />
                  <span>
                    <strong>{slice.isMore ? "…" : slice.node.label}</strong>
                    {(slice.isMore || slice.node.aliases.length > 0) && (
                      <small>
                        {slice.isMore
                          ? `${slice.node.children.length} more tags`
                          : compactAliases(slice.node.aliases)}
                      </small>
                    )}
                  </span>
                  {hasTagChildren(slice.node) && (
                    <span className="pie-drill-marker" aria-hidden="true">
                      ›
                    </span>
                  )}
                </button>
              </th>
              <td>{slice.node.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function RadarSort({
  state,
  dispatch,
}: {
  state: TrackerState;
  dispatch: Dispatch<TrackerAction>;
}) {
  return (
    <label className="category-chart-sort">
      <span>Sort</span>
      <select
        id="category-chart-sort"
        aria-label="Sort radar categories"
        value={state.radarSort}
        onChange={(event) =>
          dispatch({
            type: "set-radar-sort",
            value: event.target.value as TrackerState["radarSort"],
          })
        }
      >
        <option value="count">Occurrences</option>
        <option value="tag">Tag A–Z</option>
      </select>
    </label>
  );
}

export function TagRadar({
  state,
  dispatch,
}: {
  state: TrackerState;
  dispatch: Dispatch<TrackerAction>;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const counts = radarCounts(state);
  const includesItems = state.preferences.includeItemTagsInRadar;
  const countLabel = includesItems ? "records" : "perks";
  const maximum = Math.max(
    5,
    Math.ceil(Math.max(...Object.values(counts)) / 5) * 5,
  );
  const selected = state.radarCategory;
  const isPie = selected !== null && state.radarPath.length > 0;
  const stack = selected ? resolveTagBreakdownStack(state, selected) : [];
  const current = stack.at(-1);
  const pieSlices =
    selected && current
      ? visibleTagBreakdownSlices(current.node, state.tags[selected].color)
      : [];
  const sidebarSlices = [...pieSlices].sort((first, second) => {
    if (state.radarSort === "tag") {
      if (first.isMore) return 1;
      if (second.isMore) return -1;
      return first.node.label.localeCompare(second.node.label);
    }
    return (
      second.node.count - first.node.count ||
      first.node.label.localeCompare(second.node.label)
    );
  });
  const togglePie = (slice: TagBreakdownSlice) =>
    dispatch({ type: "toggle-radar-slice", value: slice.key });
  const drillPie = (slice: TagBreakdownSlice) => {
    if (!hasTagChildren(slice.node)) return;
    dispatch({ type: "open-radar-node", value: slice.node.id });
    setHovered(null);
  };
  const ordered = [...tagCategories].sort((first, second) =>
    state.radarSort === "tag"
      ? state.tags[first].label.localeCompare(state.tags[second].label)
      : counts[second] - counts[first] ||
        state.tags[first].label.localeCompare(state.tags[second].label),
  );
  const select = (category: TagCategory) => {
    if (selected === category)
      dispatch({ type: "open-radar-node", value: category });
    else dispatch({ type: "select-radar-category", value: category });
  };
  const chartColor = selected
    ? state.tags[selected].color
    : "var(--app-accent-raw, #d4af37)";
  return (
    <div
      className={`category-radar${selected ? " has-chart-selection" : ""}${isPie ? " is-pie-mode" : ""}`}
      style={{ "--chart-selection": chartColor } as CSSProperties}
    >
      <figure className="category-radar-figure">
        <header className="category-chart-header">
          <div>
            <p id="category-chart-eyebrow">
              {isPie && current
                ? current.isMore
                  ? "Additional tags"
                  : `${state.tags[selected].label} breakdown`
                : selected
                  ? `Selected · ${state.tags[selected].label}`
                  : "Dense chain profile"}
            </p>
            <h4 id="category-radar-title">
              {isPie && current
                ? current.node.label
                : includesItems
                  ? "Accrued perks and items by tag category"
                  : "Accrued perks by tag category"}
            </h4>
            {isPie && selected && (
              <nav
                id="category-chart-breadcrumbs"
                aria-label="Chart drilldown path"
              >
                <button
                  type="button"
                  onClick={() =>
                    dispatch({ type: "select-radar-category", value: null })
                  }
                >
                  All categories
                </button>
                {stack.map((entry, index) => (
                  <span key={`${entry.node.id}-${index}`}>
                    <span aria-hidden="true"> / </span>
                    {index === stack.length - 1 ? (
                      <span aria-current="page">
                        {entry.isMore ? "More" : entry.node.label}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({
                            type: "set-radar-path",
                            value: state.radarPath.slice(0, index + 1),
                          })
                        }
                      >
                        {entry.isMore ? "More" : entry.node.label}
                      </button>
                    )}
                  </span>
                ))}
              </nav>
            )}
          </div>
          <div className="category-chart-actions">
            {isPie && (
              <button
                type="button"
                onClick={() => dispatch({ type: "radar-back" })}
              >
                {stack.length <= 1
                  ? "← Radar"
                  : `← ${stack.at(-2)?.isMore ? "More" : stack.at(-2)?.node.label}`}
              </button>
            )}
            {!isPie && (
              <button
                type="button"
                disabled={!selected}
                onClick={() =>
                  selected &&
                  dispatch({ type: "open-radar-node", value: selected })
                }
              >
                Open breakdown
              </button>
            )}
          </div>
        </header>
        {isPie && selected ? (
          current && (
            <PieGraphic
              state={state}
              current={current}
              slices={pieSlices}
              hovered={hovered}
              setHovered={setHovered}
              toggle={togglePie}
              drill={drillPie}
            />
          )
        ) : (
          <RadarGraphic
            state={state}
            counts={counts}
            maximum={maximum}
            selected={selected}
            dispatch={dispatch}
          />
        )}
      </figure>
      {isPie && current ? (
        <PieSidebar
          state={state}
          current={current.node}
          slices={sidebarSlices}
          hovered={hovered}
          setHovered={setHovered}
          toggle={togglePie}
          drill={drillPie}
          dispatch={dispatch}
        />
      ) : (
        <section
          className="category-radar-data"
          aria-labelledby="tracker-category-counts"
        >
          <header className={selected ? "is-selected" : undefined}>
            <div>
              <p>
                {selected
                  ? `Selected · ${counts[selected]} ${countLabel}`
                  : "Exact values"}
              </p>
              <h4 id="tracker-category-counts">
                {selected ? state.tags[selected].label : "Category counts"}
              </h4>
            </div>
            <RadarSort state={state} dispatch={dispatch} />
          </header>
          <table>
            <caption className="sr-only">
              Accrued {includesItems ? "perk and item" : "perk"} count for each
              built-in tag category
            </caption>
            <thead>
              <tr>
                <th>Category</th>
                <th>{includesItems ? "Records" : "Perks"}</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((category) => (
                <tr
                  key={category}
                  className={selected === category ? "is-selected" : undefined}
                  style={
                    {
                      "--row-color": state.tags[category].color,
                    } as CSSProperties
                  }
                >
                  <th scope="row">
                    <button
                      type="button"
                      aria-label={state.tags[category].label}
                      aria-pressed={selected === category}
                      onClick={() => select(category)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        select(category);
                      }}
                    >
                      <TagBadge tag={state.tags[category]} />
                    </button>
                  </th>
                  <td>{counts[category]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function RadarGraphic({
  state,
  counts,
  maximum,
  selected,
  dispatch,
}: {
  state: TrackerState;
  counts: Record<TagCategory, number>;
  maximum: number;
  selected: TagCategory | null;
  dispatch: Dispatch<TrackerAction>;
}) {
  const includesItems = state.preferences.includeItemTagsInRadar;
  const countLabel = includesItems ? "records" : "perks";
  return (
    <>
      <svg
        id="category-radar-svg"
        viewBox="0 0 520 520"
        aria-label={`${includesItems ? "Perk and item" : "Perk"} tag category statistics chart`}
      >
        {[1, 2, 3, 4, 5].map((ring) => (
          <g key={ring}>
            <polygon
              className="radar-grid"
              points={tagCategories
                .map((_, index) => pointAt(index, 170 * (ring / 5)).join(","))
                .join(" ")}
            />
            <text
              x="265"
              y={260 - 170 * (ring / 5) + 12}
              className="radar-scale-label"
            >
              {Math.round(maximum * (ring / 5))}
            </text>
          </g>
        ))}
        {tagCategories.map((category, index) => {
          const [axisX, axisY] = pointAt(index, 170);
          const [labelX, labelY] = pointAt(index, 214);
          const active = selected === category;
          return (
            <g
              key={category}
              onDoubleClick={() => {
                if (active)
                  dispatch({ type: "open-radar-node", value: category });
                else
                  dispatch({ type: "select-radar-category", value: category });
              }}
              onClick={() =>
                dispatch({ type: "select-radar-category", value: category })
              }
            >
              <line
                className={`radar-axis${active ? " is-selected" : ""}`}
                x1="260"
                y1="260"
                x2={axisX}
                y2={axisY}
                style={
                  active ? { stroke: state.tags[category].color } : undefined
                }
              />
              <line
                className="radar-axis-hit"
                x1="260"
                y1="260"
                x2={axisX}
                y2={axisY}
              />
              <text
                className={`radar-label${active ? " is-selected" : ""}`}
                x={labelX}
                y={labelY}
                textAnchor={
                  Math.abs(labelX - 260) < 12
                    ? "middle"
                    : labelX < 260
                      ? "end"
                      : "start"
                }
                dominantBaseline="middle"
                style={
                  {
                    "--radar-label-color": state.tags[category].color,
                  } as CSSProperties
                }
              >
                {state.tags[category].label}
              </text>
            </g>
          );
        })}
        <polygon
          className="radar-area"
          points={tagCategories
            .map((category, index) =>
              pointAt(index, 170 * (counts[category] / maximum)).join(","),
            )
            .join(" ")}
        />
        {tagCategories.map((category, index) => {
          const [cx, cy] = pointAt(index, 170 * (counts[category] / maximum));
          return (
            <circle
              key={category}
              className={`radar-point${selected === category ? " is-selected" : ""}`}
              cx={cx}
              cy={cy}
              r={selected === category ? 7 : 5}
              fill={state.tags[category].color}
              onClick={() =>
                dispatch({ type: "select-radar-category", value: category })
              }
            >
              <title>{`${state.tags[category].label}: ${counts[category]} ${countLabel}`}</title>
            </circle>
          );
        })}
      </svg>
      <figcaption id="category-radar-caption">
        Select a category to emphasize its axis; select it again to open its
        breakdown.
      </figcaption>
    </>
  );
}
