import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export const TAURI_CSP_STYLE_NONCE_ID = "tauri-csp-style-nonce";

type NonceDocument = Pick<Document, "getElementById">;

export function readTauriStyleNonce(
  source: NonceDocument = document,
): string | undefined {
  const nonce = source.getElementById(TAURI_CSP_STYLE_NONCE_ID)?.nonce.trim();
  return nonce || undefined;
}

export function codeMirrorCspNonceExtension(source?: NonceDocument): Extension {
  const nonce = readTauriStyleNonce(source);
  return nonce ? EditorView.cspNonce.of(nonce) : [];
}
