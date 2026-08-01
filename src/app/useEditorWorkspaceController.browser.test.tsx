import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import {
  createStarterWorkspace,
  type EditorWorkspaceRepository,
  type EditorWorkspaceSnapshot,
} from "../editor";
import { useEditorWorkspaceController } from "./useEditorWorkspaceController";

class RecordingWorkspaceRepository implements EditorWorkspaceRepository {
  readonly saves: EditorWorkspaceSnapshot[] = [];

  constructor(private readonly workspace: EditorWorkspaceSnapshot) {}

  async list() {
    return [this.workspace];
  }

  async load(id: string) {
    return id === this.workspace.id ? this.workspace : null;
  }

  async save(workspace: EditorWorkspaceSnapshot) {
    this.saves.push(workspace);
  }

  async remove() {}
}

function SaveQueueHarness({
  mode,
  repository,
}: {
  mode: "autosave" | "explicit";
  repository: RecordingWorkspaceRepository;
}) {
  const editor = useEditorWorkspaceController(mode, () => repository);
  const workspace = Object.values(editor.workspaces)[0];
  if (!workspace) return <span>Loading</span>;
  return (
    <div>
      <output aria-label="save state">{editor.saveState}</output>
      <output aria-label="revision">{workspace.revision}</output>
      <button
        type="button"
        onClick={() =>
          editor.commands.change({
            ...workspace,
            revision: workspace.revision + 1,
          })
        }
      >
        Change
      </button>
      <button
        type="button"
        onClick={() => void editor.commands.save(workspace.id)}
      >
        Save
      </button>
    </div>
  );
}

test("the Editor controller coalesces autosave changes into the latest queued snapshot", async () => {
  const repository = new RecordingWorkspaceRepository(createStarterWorkspace());
  render(<SaveQueueHarness mode="autosave" repository={repository} />);
  await expect
    .element(page.getByRole("button", { name: "Change" }))
    .toBeVisible();

  await page.getByRole("button", { name: "Change" }).click();
  await page.getByRole("button", { name: "Change" }).click();
  await expect
    .element(page.getByLabelText("save state"))
    .toHaveTextContent("unsaved");
  expect(repository.saves).toHaveLength(0);

  await expect.poll(() => repository.saves.length).toBe(1);
  expect(repository.saves[0].revision).toBe(2);
  await expect
    .element(page.getByLabelText("save state"))
    .toHaveTextContent("saved");
});

test("the Editor controller keeps explicit changes in memory until its save command", async () => {
  const repository = new RecordingWorkspaceRepository(createStarterWorkspace());
  render(<SaveQueueHarness mode="explicit" repository={repository} />);
  await expect
    .element(page.getByRole("button", { name: "Change" }))
    .toBeVisible();

  await page.getByRole("button", { name: "Change" }).click();
  await new Promise((resolve) => window.setTimeout(resolve, 600));
  expect(repository.saves).toHaveLength(0);
  await page.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => repository.saves.length).toBe(1);
  expect(repository.saves[0].revision).toBe(1);
});
