(() => {
  const content = document.querySelector("#content");
  const params = new URLSearchParams(window.location.search);
  const values = {
    month: params.get("month-name"),
    target: params.get("target-points"),
    points: params.get("points"),
  };

  const errors = [];
  if (!values.month || !values.month.trim())
    errors.push("Add a month using the month-name parameter.");
  const target = parsePoints(values.target, "target-points", errors);
  const points = parsePoints(values.points, "points", errors);

  if (errors.length > 0) {
    renderError(errors);
    return;
  }

  renderProgress(values.month.trim(), target, points);

  function parsePoints(value, name, errorList) {
    if (value === null || value.trim() === "") {
      errorList.push(`Add a value using the ${name} parameter.`);
      return null;
    }
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
      errorList.push(`${name} must be a non-negative whole number.`);
      return null;
    }
    const number = Number(value);
    if (number > 1000000) {
      errorList.push(`${name} must be no greater than 1,000,000.`);
      return null;
    }
    return number;
  }

  function renderError(errorList) {
    content.innerHTML = "";
    const panel = document.createElement("section");
    panel.className = "error-panel";
    panel.setAttribute("role", "alert");
    panel.innerHTML =
      "<h2>Progress is incomplete</h2><p>We need three valid URL values before we can show this month.</p>";
    const list = document.createElement("ul");
    list.className = "error-list";
    errorList.forEach((message) => {
      const item = document.createElement("li");
      item.textContent = message;
      list.appendChild(item);
    });
    panel.appendChild(list);
    content.appendChild(panel);
  }

  function renderProgress(month, target, points) {
    const isOver = points > target;
    const percentage =
      target === 0
        ? points === 0
          ? 100
          : 100
        : Math.min((points / target) * 100, 100);
    const remaining = Math.max(target - points, 0);
    const percentageLabel = Math.round((points / Math.max(target, 1)) * 100);
    const status = isOver
      ? `${format(points - target)} points above target`
      : points === target
        ? "Target reached"
        : `${format(remaining)} points to target`;
    const message = isOver
      ? "In the team incentive zone - keep soaring!"
      : points === target
        ? "Monthly target reached - ring the gong!"
        : points / Math.max(target, 1) >= 0.75
          ? "So close - the gong is in sight!"
          : points / Math.max(target, 1) >= 0.5
            ? "Halfway there - keep the momentum going."
            : "Let's get flying.";
    const displayRatio =
      points <= target
        ? (points / Math.max(target, 1)) * 0.75
        : Math.min(0.75 + ((points - target) / 15) * 0.25, 1);
    content.innerHTML = `
      <section class="progress-card" aria-labelledby="month-value">
        <div class="progress-heading">
          <h2 id="month-value" class="month-label"></h2>
          <p class="progress-copy">${format(remaining)} placement points to strike the gong at ${format(target)}</p>
        </div>
        <div class="score-block" aria-label="Points achieved" style="display: none">
          <p class="score">${format(points)}</p>
          <p class="score-unit">of ${format(target)} placement points</p>
          <p class="progress-badge">${percentageLabel}% of target</p>
        </div>
        <div class="track-scroll">
          <div class="track-wrap">
            <div class="target-route-label">0-<span>${format(target)}</span> placement points</div>
            <div class="zone-label">Team incentive<span>anything beyond ${format(target)}</span></div>
            <div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${Math.min(points, target)}" aria-label="${format(points)} of ${format(target)} points"></div>
            <div class="centre-copy"><strong>${format(points)}</strong><span>of <span>${format(target)}</span> placement points</span><em>${percentageLabel}% of target</em></div>
            <img class="bird${points === 0 ? " bird-still" : ""}" src="assets/th-swallow.png" alt="" aria-hidden="true" style="--bird-target: ${displayRatio * 100}%">
            <span class="gong" aria-label="Monthly target gong" role="img"></span>
            <span class="gong-caption"><span>${format(target)}</span> placement points<br>Monthly target</span>
          </div>
        </div>
        <p class="celebrate${isOver ? " incentive" : points === target ? " goal" : ""}" role="status" aria-label="${status}">${message}</p>
      </section>`;
    document.querySelector("#month-value").textContent = month;
    document.querySelector("#month-chip").textContent = month;
    document.querySelector("#target-title").textContent = format(target);
    if (points > 0)
      animateBird(displayRatio, Math.max(1, Math.floor(points / 20)));
  }

  function animateBird(displayRatio, loopCount) {
    const bird = content.querySelector(".bird");
    const track = content.querySelector(".track-wrap");
    bird.style.animationDuration = `${Math.min(12, 3.8 + (loopCount - 1) * 0.75)}s`;
    const updatePath = () => {
      const destination = track.clientWidth * displayRatio;
      const entries =
        loopCount === 1
          ? [destination * 0.45]
          : loopCount === 2
            ? [destination * 0.3, destination * 0.7]
            : Array.from(
                { length: loopCount },
                (_, index) => destination * ((index + 1) / (loopCount + 1)),
              );
      const radius = Math.min(
        24,
        destination * (loopCount === 1 ? 0.2 : 0.24 / loopCount),
      );
      const handle = radius * 0.55228475;
      const baseline =
        track.querySelector(".track").offsetTop - bird.clientHeight / 2 + 8;
      const bottom = baseline - 10;
      const centre = bottom - radius;
      const top = centre - radius;
      const approach = Math.min(12, destination * 0.1);
      const loopPath = (entry) =>
        `C ${entry + handle} ${bottom} ${entry + radius} ${centre + handle} ${entry + radius} ${centre} C ${entry + radius} ${centre - handle} ${entry + handle} ${top} ${entry} ${top} C ${entry - handle} ${top} ${entry - radius} ${centre - handle} ${entry - radius} ${centre} C ${entry - radius} ${centre + handle} ${entry - handle} ${bottom} ${entry} ${bottom}`;
      let path = `M 0 ${baseline} C ${approach} ${baseline - approach} ${entries[0] - handle} ${bottom} ${entries[0]} ${bottom} ${loopPath(entries[0])}`;
      for (let index = 1; index < entries.length; index += 1) {
        const previous = entries[index - 1];
        const entry = entries[index];
        path += ` C ${previous + handle} ${bottom} ${entry - handle} ${bottom} ${entry} ${bottom} ${loopPath(entry)}`;
      }
      path += ` C ${entries[entries.length - 1] + handle} ${bottom} ${destination - approach} ${baseline + approach} ${destination} ${baseline}`;
      bird.style.offsetPath = `path("${path}")`;
      bird.classList.add("bird-flying");
    };
    bird.addEventListener("load", updatePath);
    updatePath();
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(updatePath).observe(track);
    }
  }

  function format(value) {
    return new Intl.NumberFormat("en-GB").format(value);
  }
})();
