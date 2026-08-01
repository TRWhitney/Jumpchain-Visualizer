import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { defaultSettings } from "../settings/model";
import { EventPipeline } from "../settings/logging";
import {
  createDefaultTagProfile,
  projectTagDefinitions,
} from "../settings/tagProfile";
import { MemoryChainRepository } from "../tracker/repository";
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
