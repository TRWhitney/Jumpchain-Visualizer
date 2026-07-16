(() => {
  const rerolls = document.querySelector("#choice-demo-rerolls");
  if (!rerolls) return;

  document
    .querySelectorAll('.default-choice-actions input[type="number"]')
    .forEach((input) => {
      const label = input.closest("label");
      if (!label) return;
      const stepper = document.createElement("span");
      stepper.className = "number-stepper";
      label.before(stepper);
      stepper.append(label);
      stepper.insertAdjacentHTML(
        "beforeend",
        `<span class="number-stepper-buttons">
          <button type="button" aria-label="Increase"><svg aria-hidden="true" viewBox="0 0 12 8"><path d="M2 6 6 2l4 4"></path></svg></button>
          <button type="button" aria-label="Decrease"><svg aria-hidden="true" viewBox="0 0 12 8"><path d="m2 2 4 4 4-4"></path></svg></button>
        </span>`,
      );
      stepper
        .querySelector('[aria-label="Increase"]')
        .addEventListener("click", () => {
          input.stepUp();
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
      stepper
        .querySelector('[aria-label="Decrease"]')
        .addEventListener("click", () => {
          input.stepDown();
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
    });

  const rankLabel = (count) => `${count} ${count === 1 ? "rank" : "ranks"}`;
  const currentValue = (card) => {
    const control = card.querySelector("[data-current-value]");
    if (control) return control.value;
    const output = card.querySelector("[data-roll-output]");
    return ["Not rolled", "Not claimed"].includes(output?.textContent) ? "" : output?.textContent || "";
  };

  const updateClearControl = (card) => {
    const clear = card.querySelector("[data-clear-control]");
    if (!clear) return;
    const hasValue = card.hasAttribute("data-roll-only-integer")
      ? Boolean(currentValue(card))
      : [...card.querySelectorAll("[data-clear-value]")].some((control) => control.value !== "");
    clear.disabled = !hasValue;
  };

  const renderPrimaryCost = (card) => {
    const row = card.querySelector("[data-cost-row]");
    const value = currentValue(card);
    const rolled = card.dataset.rolledValue || "";
    const usingRoll = Boolean(rolled && value === rolled);
    const randomOnly = card.hasAttribute("data-random-only");

    if (card.matches("[data-rank-card]")) {
      const ranks = value === "" ? null : Math.max(0, Number(value));
      const each = Number(card.dataset.eachCost);
      const original = card.dataset.eachOriginal ? Number(card.dataset.eachOriginal) : null;
      const allowance = rolled === "" ? 0 : Math.max(0, Number(rolled));
      if (randomOnly && !rolled) {
        row.innerHTML = '<b class="cost-badge is-ranked is-roll-pending"><strong>Roll for Free</strong><span>Rank count pending</span></b>';
      } else if (allowance && ranks !== null && ranks <= allowance) {
        row.innerHTML = `<b class="cost-badge is-ranked is-benefit"><strong>Free</strong><span>${rankLabel(ranks)} selected · ${allowance} rolled</span></b>`;
      } else if (allowance && ranks !== null) {
        const paidRanks = ranks - allowance;
        const paidDetail = original ? `${paidRanks} paid × <del>${original} CP</del> ${each} CP` : `${paidRanks} paid × ${each} CP`;
        row.innerHTML = `<b class="cost-badge is-ranked is-mixed"><span>${allowance} ${allowance === 1 ? "rank" : "ranks"} Free · Rolled</span><strong>${paidDetail} · ${paidRanks * each} CP total</strong></b>`;
      } else if (allowance) {
        row.innerHTML = randomOnly
          ? `<b class="cost-badge is-ranked is-benefit"><strong>Up to ${rankLabel(allowance)} Free</strong><span>Rolled · Not claimed</span></b>`
          : `<b class="cost-badge is-ranked is-benefit"><strong>Up to ${rankLabel(allowance)} Free</strong><span>Rolled</span></b>`;
      } else if (original) {
        const total = ranks === null ? "Awaiting ranks" : `${rankLabel(ranks)} · ${ranks * each} CP total`;
        row.innerHTML = `<b class="cost-badge is-ranked is-benefit"><span><del>${original} CP each</del> ${each} CP each</span><strong>${total}</strong></b>`;
      } else {
        const total = ranks === null ? "Awaiting ranks" : `${rankLabel(ranks)} · ${ranks * each} CP total`;
        row.innerHTML = `<b class="cost-badge is-ranked"><span>${each} CP each</span><strong>${total}</strong></b>`;
      }
    } else {
      const flat = Number(card.dataset.flatCost);
      if (randomOnly && !rolled) row.innerHTML = '<b class="cost-badge is-roll-pending">Roll for Free</b>';
      else if (randomOnly && usingRoll) row.innerHTML = '<b class="cost-badge is-benefit is-stacked"><strong>Free</strong><span>Rolled</span></b>';
      else if (randomOnly && rolled) row.innerHTML = '<b class="cost-badge is-benefit is-stacked"><strong>Free</strong><span>Rolled · Not claimed</span></b>';
      else if (usingRoll) row.innerHTML = `<b class="cost-badge is-benefit is-stacked"><strong>Free</strong><span>Rolled · was ${flat} CP</span></b>`;
      else if (rolled) row.innerHTML = `<b class="cost-badge is-stacked"><strong>${flat} CP</strong><span>Rolled ${rolled} is Free</span></b>`;
      else row.innerHTML = `<b class="cost-badge">${flat} CP</b>`;
    }
    const roll = card.querySelector("[data-roll-control]");
    if (roll) {
      const canClaim = card.hasAttribute("data-roll-only-integer") && Boolean(rolled && !value && !rerolls.checked);
      roll.disabled = Boolean(rolled && !rerolls.checked && !canClaim);
      roll.textContent = canClaim ? "Claim" : "Roll";
    }
    updateClearControl(card);
  };

  const primaryCostCards = [...document.querySelectorAll("[data-rank-card], [data-roll-card]")];
  primaryCostCards.forEach((card) => {
    card.dataset.rolledValue = "";
    card.dataset.rollIndex = "0";
    card.querySelectorAll("[data-current-value]").forEach((control) => {
      control.addEventListener("input", () => renderPrimaryCost(card));
      control.addEventListener("change", () => renderPrimaryCost(card));
    });
    const roll = card.querySelector("[data-roll-control]");
    roll?.addEventListener("click", () => {
      if (card.hasAttribute("data-roll-only-integer") && card.dataset.rolledValue && !currentValue(card) && !rerolls.checked) {
        card.querySelector("[data-roll-output]").textContent = card.dataset.rolledValue;
        renderPrimaryCost(card);
        return;
      }
      if (card.dataset.rolledValue && !rerolls.checked) return;
      const values = roll.dataset.rollValues.split("|");
      let index = Number(card.dataset.rollIndex) % values.length;
      if (values[index] === card.dataset.rolledValue) index = (index + 1) % values.length;
      const value = values[index];
      card.dataset.rollIndex = String(index + 1);
      card.dataset.rolledValue = value;
      const control = card.querySelector("[data-current-value]");
      if (control) control.value = value;
      const output = card.querySelector("[data-roll-output]");
      if (output) output.textContent = value;
      renderPrimaryCost(card);
    });
    renderPrimaryCost(card);
  });

  document.querySelectorAll("[data-clear-control]").forEach((clear) => {
    const card = clear.closest(".control-specimen");
    card.querySelectorAll("[data-clear-value]").forEach((control) => {
      control.addEventListener("input", () => updateClearControl(card));
      control.addEventListener("change", () => updateClearControl(card));
    });
    clear.addEventListener("click", () => {
      card.querySelectorAll("[data-clear-value]").forEach((control) => { control.value = ""; });
      if (card.hasAttribute("data-roll-only-integer")) {
        card.querySelector("[data-roll-output]").textContent = card.dataset.rolledValue ? "" : "Not rolled";
      }
      if (card.matches("[data-rank-card], [data-roll-card]")) renderPrimaryCost(card);
      else updateClearControl(card);
    });
    updateClearControl(card);
  });

  const groups = [...document.querySelectorAll("[data-group-mode]")];
  groups.forEach((group) => {
    group._selected = new Set();
    group.dataset.rolledOption = "";
    group.dataset.rollIndex = "0";
  });

  const renderGroup = (group) => {
    const rolled = group.dataset.rolledOption;
    let spent = 0;
    group.querySelectorAll("[data-group-option]").forEach((option) => {
      const id = option.dataset.groupOption;
      const active = group._selected.has(id);
      const hasRoll = rolled === id;
      const cost = Number(option.dataset.cost);
      option.querySelector("[data-cost-row]").innerHTML = hasRoll
        ? group.hasAttribute("data-group-random-only")
          ? '<b class="cost-badge is-benefit is-stacked"><strong>Free</strong><span>Rolled</span></b>'
          : `<b class="cost-badge is-benefit is-stacked"><strong>Free</strong><span>Rolled · was ${cost} CP</span></b>`
        : group.hasAttribute("data-group-random-only")
          ? '<b class="cost-badge is-roll-pending">Roll for Free</b>'
          : `<b class="cost-badge">${cost} CP</b>`;
      const control = option.querySelector("[data-group-control]");
      control.checked = active;
      if (group.hasAttribute("data-group-random-only")) control.disabled = !hasRoll;
      if (active && !hasRoll) spent += cost;
    });
    const spentOutput = group.querySelector("[data-group-spent]");
    if (spentOutput) spentOutput.textContent = `${spent} CP`;
    const roll = group.querySelector("[data-group-roll]");
    if (roll) {
      roll.disabled = Boolean(rolled && !rerolls.checked);
      roll.textContent = "Roll";
    }
    const clear = group.querySelector("[data-group-clear]");
    if (clear) clear.disabled = group._selected.size === 0;
  };

  groups.forEach((group) => {
    group.querySelectorAll("[data-group-control]").forEach((control) => {
      control.addEventListener("change", () => {
        const option = control.closest("[data-group-option]");
        const id = option.dataset.groupOption;
        if (group.dataset.groupMode === "single") {
          group._selected.clear();
          if (control.checked) group._selected.add(id);
        } else if (control.checked) group._selected.add(id);
        else group._selected.delete(id);
        renderGroup(group);
      });
    });
    group.querySelector("[data-group-clear]")?.addEventListener("click", () => {
      group._selected.clear();
      renderGroup(group);
    });
    group.querySelector("[data-group-roll]")?.addEventListener("click", () => {
      if (group.dataset.rolledOption && !rerolls.checked) return;
      const options = [...group.querySelectorAll("[data-group-option]")];
      let index = Number(group.dataset.rollIndex) % options.length;
      if (options[index].dataset.groupOption === group.dataset.rolledOption) index = (index + 1) % options.length;
      const next = options[index];
      group.dataset.rollIndex = String(index + 1);
      if (group.dataset.rolledOption) group._selected.delete(group.dataset.rolledOption);
      group.dataset.rolledOption = next.dataset.groupOption;
      group._selected.add(next.dataset.groupOption);
      group.querySelector("[data-group-status]").textContent = `${next.querySelector("strong").textContent} · Rolled`;
      renderGroup(group);
    });
    renderGroup(group);
  });

  rerolls.addEventListener("change", () => {
    primaryCostCards.forEach(renderPrimaryCost);
    groups.forEach(renderGroup);
  });
})();
