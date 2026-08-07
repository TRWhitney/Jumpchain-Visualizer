import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import {
  codeMirrorCspNonceExtension,
  readTauriStyleNonce,
  TAURI_CSP_STYLE_NONCE_ID,
} from "./codeMirrorCsp";

function nonceDocument(nonce?: string) {
  return {
    getElementById(id: string) {
      expect(id).toBe(TAURI_CSP_STYLE_NONCE_ID);
      return nonce === undefined ? null : ({ nonce } as HTMLElement);
    },
  };
}

describe("CodeMirror Tauri CSP nonce", () => {
  it("reuses the nonce Tauri places on the inert style anchor", () => {
    const source = nonceDocument("tauri-runtime-nonce");
    const state = EditorState.create({
      extensions: [codeMirrorCspNonceExtension(source)],
    });

    expect(readTauriStyleNonce(source)).toBe("tauri-runtime-nonce");
    expect(state.facet(EditorView.cspNonce)).toBe("tauri-runtime-nonce");
  });

  it("leaves ordinary browser development unrestricted when no nonce exists", () => {
    const state = EditorState.create({
      extensions: [codeMirrorCspNonceExtension(nonceDocument())],
    });

    expect(state.facet(EditorView.cspNonce)).toBe("");
  });
});
