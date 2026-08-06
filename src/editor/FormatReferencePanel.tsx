import { useEffect, useRef, useState } from "react";
import { translate } from "../localization";
import { Modal } from "../ui/SupplementWidgets";

const formatReferenceBasePath =
  "/documentation/guides/format-1-reference.html?embedded=1";

function formatReferencePath(entryId: string | null) {
  return entryId
    ? `${formatReferenceBasePath}&entry=${encodeURIComponent(entryId)}`
    : formatReferenceBasePath;
}

export function FormatReferenceHelpIcon() {
  return (
    <svg
      aria-hidden="true"
      className="editor-format-reference-icon"
      viewBox="0 0 20 20"
    >
      <circle cx="10" cy="10" r="8" />
      <path d="M7.8 7.2a2.35 2.35 0 0 1 4.5.95c0 1.75-2.3 1.9-2.3 3.45" />
      <path d="M10 14.4h.01" />
    </svg>
  );
}

export function FormatReferencePanel({
  entryId,
  onClose,
  onEntryChange,
}: {
  entryId: string | null;
  onClose: () => void;
  onEntryChange: (entryId: string) => void;
}) {
  const title = translate("ui.editorWorkspace.text.format1AuthorReference");
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [initialPath] = useState(() => formatReferencePath(entryId));

  useEffect(() => {
    const receiveLocation = (event: MessageEvent) => {
      if (
        event.source !== frameRef.current?.contentWindow ||
        !event.data ||
        typeof event.data !== "object" ||
        event.data.type !== "jumpchain:format-reference-location" ||
        typeof event.data.entryId !== "string" ||
        !/^[a-z0-9][a-z0-9-]{0,127}$/.test(event.data.entryId)
      )
        return;
      onEntryChange(event.data.entryId);
    };
    window.addEventListener("message", receiveLocation);
    return () => window.removeEventListener("message", receiveLocation);
  }, [onEntryChange]);

  return (
    <Modal
      title={title}
      kicker={translate("ui.editorWorkspace.text.authoringHelp")}
      className="editor-format-reference-dialog"
      onClose={onClose}
    >
      <iframe ref={frameRef} src={initialPath} title={title} tabIndex={0} />
    </Modal>
  );
}
