import { expect, test } from "vitest";
import { useState } from "react";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { defaultSettings } from "../settings/model";
import { EventPipeline } from "../settings/logging";
import {
  createDefaultTagProfile,
  projectTagDefinitions,
} from "../settings/tagProfile";
import { MemoryChainRepository } from "../tracker/repository";
import { MemoryChainPackageRepository } from "../tracker/packageRepository";
import { useChainController } from "./useChainController";

const settings = defaultSettings(createDefaultTagProfile());
const logger = new EventPipeline(
  () => settings,
  () => "chain",
);
const tags = projectTagDefinitions(
  settings.tags.profile,
  settings.language.tag,
);
const preferences = {
  warnUpstreamChanges: settings.chain.warnUpstreamChanges,
  allowMultiplePackageVersions: settings.chain.allowMultiplePackageVersions,
  allowDuplicateJumps: settings.chain.allowDuplicateJumps,
  allowNegativePointBalances: settings.chain.allowNegativePointBalances,
  allowRerolls: settings.chain.allowRerolls,
  includeItemTagsInRadar: settings.chain.includeItemTagsInRadar,
  aggregateSimilarInventory: settings.chain.aggregateSimilarInventory,
  showAdditionalJumpInformation: false,
  showMockData: true,
};

function ChainControllerHarness({
  repository,
}: {
  repository: MemoryChainRepository;
}) {
  const chain = useChainController({
    routeChainId: null,
    tags,
    preferences,
    showMockData: true,
    logger,
    repositoryFactory: () => repository,
  });
  return (
    <div>
      <output aria-label="active chain">
        {chain.effectiveState.chainName}
      </output>
      <output aria-label="saved chains">
        {chain.savedChains.map((item) => item.name).join("|")}
      </output>
      <button
        type="button"
        onClick={() => chain.commands.create(" Lantern Road ")}
      >
        Create
      </button>
    </div>
  );
}

class DeferredCreateRepository extends MemoryChainRepository {
  private releaseCreate: (() => void) | null = null;
  private readonly createGate = new Promise<void>((resolve) => {
    this.releaseCreate = resolve;
  });

  override async save(value: Parameters<MemoryChainRepository["save"]>[0]) {
    if (value.id === "ch-new-1" && value.order.length === 1)
      await this.createGate;
    await super.save(value);
  }

  release() {
    this.releaseCreate?.();
  }
}

function OrderedSaveHarness({
  repository,
}: {
  repository: DeferredCreateRepository;
}) {
  const [routeChainId, setRouteChainId] = useState<string | null>(null);
  const [packageRepository] = useState(
    () => new MemoryChainPackageRepository(),
  );
  const chain = useChainController({
    routeChainId,
    tags,
    preferences,
    showMockData: true,
    logger,
    repositoryFactory: () => repository,
    packageRepositoryFactory: () => packageRepository,
  });
  return (
    <div>
      <output aria-label="jump count">
        {chain.effectiveState.order.length}
      </output>
      <button
        type="button"
        onClick={() => {
          const id = chain.commands.create("Ordered Chain");
          if (id) setRouteChainId(id);
        }}
      >
        Create ordered
      </button>
      <button
        type="button"
        onClick={() =>
          chain.dispatch({ type: "add-package", packageId: "threshold-roads" })
        }
      >
        Add Jump
      </button>
    </div>
  );
}

test("the Chain controller updates its view before its serialized create finishes", async () => {
  const repository = new MemoryChainRepository();
  render(<ChainControllerHarness repository={repository} />);
  await page.getByRole("button", { name: "Create" }).click();

  await expect
    .element(page.getByLabelText("active chain"))
    .toHaveTextContent("Lantern Road");
  await expect
    .element(page.getByLabelText("saved chains"))
    .toHaveTextContent("Lantern Road");
  await expect
    .poll(async () => (await repository.load("ch-new-1"))?.name)
    .toBe("Lantern Road");
});

test("a delayed create write cannot replace newer chain state", async () => {
  const repository = new DeferredCreateRepository();
  render(<OrderedSaveHarness repository={repository} />);
  await page.getByRole("button", { name: "Create ordered" }).click();
  await page.getByRole("button", { name: "Add Jump" }).click();
  await expect
    .element(page.getByLabelText("jump count"))
    .toHaveTextContent("2");

  repository.release();
  await expect
    .poll(async () => (await repository.load("ch-new-1"))?.order.length)
    .toBe(2);
});
