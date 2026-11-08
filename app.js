(() => {
  const searchForm = document.querySelector(".mockup-search");
  const searchInput = document.querySelector("#hub-search-input");
  if (searchForm && searchInput) {
    const conversationState = {
      conversationId: null,
      generation: null,
      ownerSubjectId: "hub-admin-prototype",
      accessScopeClaims: { role: "admin", source: "wiki" },
    };
    const status = document.createElement("p");
    status.className = "chat-api-status";
    status.setAttribute("role", "status");
    const conversation = document.createElement("section");
    conversation.className = "chat-api-conversation";
    conversation.setAttribute("aria-live", "polite");
    conversation.setAttribute("aria-label", "Hub chat conversation");
    const controls = document.createElement("div");
    controls.className = "chat-api-controls";
    const clearButton = document.createElement("button");
    clearButton.className = "chat-api-clear";
    clearButton.type = "button";
    clearButton.textContent = "Clear conversation";
    clearButton.hidden = true;
    controls.appendChild(clearButton);
    searchForm.insertAdjacentElement("afterend", status);
    status.insertAdjacentElement("afterend", controls);
    controls.insertAdjacentElement("afterend", conversation);

    function resetConversationState() {
      conversationState.conversationId = null;
      conversationState.generation = null;
      clearButton.hidden = true;
      conversation.replaceChildren();
    }

    function renderConversation(snapshot) {
      const turns = snapshot && Array.isArray(snapshot.turns) ? snapshot.turns : [];
      conversation.replaceChildren();
      turns.forEach((turn) => {
        const payload = turn && turn.payload ? turn.payload : {};
        const item = document.createElement("article");
        item.className = `chat-api-turn chat-api-turn-${turn.role || "system"}`;
        const heading = document.createElement("h2");
        heading.textContent = turn.role === "user" ? "You" : "Hub";
        const message = document.createElement("p");
        message.textContent =
          turn.role === "user"
            ? payload.question || ""
            : payload.answer || payload.reason || payload.outcome || "No answer was returned.";
        item.append(heading, message);
            if (turn.role === "assistant") {
              appendAnswerDetails(item, payload);
              appendReferences(item, payload);
              appendCommands(item, payload);
              appendEvaluator(item, payload);
              appendTelemetry(item, payload);
            }
        conversation.appendChild(item);
      });
      if (snapshot && snapshot.conversation_id) {
        conversationState.conversationId = snapshot.conversation_id;
        conversationState.generation = snapshot.generation;
        clearButton.hidden = false;
      }
    }

    function sourceFamilyLabel(citation) {
      const family = String(citation.sourceFamily || citation.source_family || "").toLowerCase();
      if (family === "faq") return "FAQ";
      if (family === "wiki") return "WIKI";
      if (family === "processes") return "PROCESSES";
      if (family === "redoc") return "ReDoc";
      return family ? family.toUpperCase() : "SOURCE";
    }

    function relativeReferenceUrl(citation) {
      const rawUrl = citation.canonicalUrl || citation.url || citation.sourceUrl || citation.sourcePath;
      if (!rawUrl || typeof rawUrl !== "string") return null;
      try {
        const parsed = new URL(rawUrl, window.location.origin);
        const path = parsed.pathname;
        if (path === "/wiki" || path === "/wiki/") {
          return parsed.hash || "/wiki/";
        }
        if (path.startsWith("/wiki/")) {
          const documentName = decodeURIComponent(path.slice("/wiki/".length)).replace(/\.md$/i, "");
          return `/wiki/#/${documentName}${parsed.hash && parsed.hash !== "#" ? parsed.hash : ""}`;
        }
        if (path.startsWith("/processes/") || path.startsWith("/redoc/")) {
          return `${path}${parsed.search}${parsed.hash}`;
        }
        if (rawUrl.startsWith("/")) return rawUrl;
      } catch (error) {
        return null;
      }
      return null;
    }

      function appendAnswerDetails(item, payload) {
        const values = [];
        if (payload.confidence !== null && payload.confidence !== undefined) {
          const confidence = Number(payload.confidence);
          if (Number.isFinite(confidence)) {
            const percentage = Math.round(confidence <= 1 ? confidence * 100 : confidence);
            values.push({ label: "Answer confidence", value: `${percentage}%`, tone: percentage >= 75 ? "good" : percentage >= 50 ? "caution" : "poor" });
          }
        }
        if (payload.confidenceBand) values.push({ label: "Confidence band", value: payload.confidenceBand });
        if (payload.confidenceBasis) values.push({ label: "Confidence basis", value: payload.confidenceBasis });
        if (payload.uncertainty) values.push({ label: "Uncertainty", value: payload.uncertainty });
        if (Array.isArray(payload.warnings)) payload.warnings.forEach((warning) => values.push({ label: "Warning", value: warning, tone: "caution" }));
        if (payload.insufficientEvidenceReason) values.push({ label: "Evidence status", value: payload.insufficientEvidenceReason, tone: "caution" });
        if (!values.length) return;

        const section = document.createElement("div");
        section.className = "chat-api-answer-details";
        const title = document.createElement("h3");
        title.textContent = "Answer signals";
        section.appendChild(title);
        values.forEach(({ label, value, tone }) => {
          const row = document.createElement("div");
          row.className = "chat-api-answer-detail";
          const name = document.createElement("span");
          name.textContent = label;
          const result = document.createElement("strong");
          if (tone) result.classList.add(`chat-api-score-${tone}`);
          result.textContent = String(value);
          row.append(name, result);
          section.appendChild(row);
        });
        item.appendChild(section);
      }

    function appendReferences(item, payload) {
      const references = [];
      const seen = new Set();
      const candidates = Array.isArray(payload.references)
        ? [...payload.references]
        : Array.isArray(payload.citations)
          ? [...payload.citations]
          : [];
      const evidence = Array.isArray(payload.evidence) ? payload.evidence : [];
      evidence.forEach((entry) => {
        if (!entry || typeof entry !== "object") return;
        candidates.push({ ...entry, ...(entry.citation || {}) });
      });
      candidates.forEach((citation) => {
        if (!citation || typeof citation !== "object") return;
        const url = relativeReferenceUrl(citation);
        const headingPath = Array.isArray(citation.headingPath) ? citation.headingPath : [];
        const label = citation.sourceTitle || citation.title || citation.sourcePath || citation.sourceId || headingPath.at(-1);
        const identity = `${url || label || ""}|${headingPath.join("/")}`;
        if ((!url && !label && !headingPath.length) || seen.has(identity) || references.length >= 8) return;
        seen.add(identity);
        references.push({ citation, url, headingPath });
      });
      if (!references.length) return;

      const section = document.createElement("div");
      section.className = "chat-api-references";
      const title = document.createElement("h3");
      title.textContent = "References";
      const list = document.createElement("ul");
      references.forEach(({ citation, url, headingPath }) => {
        const listItem = document.createElement("li");
        const source = document.createElement("span");
        source.className = "chat-api-reference-source";
        source.textContent = sourceFamilyLabel(citation);
        const link = document.createElement(url ? "a" : "span");
        if (url) {
          link.href = url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }
        link.textContent = citation.sourceTitle || citation.title || citation.sourcePath || citation.sourceId || url;
        listItem.append(source, link);
        const section = headingPath.at(-1);
        if (section && section !== link.textContent) {
          const detail = document.createElement("span");
          detail.className = "chat-api-reference-section";
          detail.textContent = ` - ${section}`;
          listItem.appendChild(detail);
        }
        list.appendChild(listItem);
      });
      section.append(title, list);
      item.appendChild(section);
    }

      function appendCommands(item, payload) {
        const commands = Array.isArray(payload.commands) ? payload.commands : [];
        if (!commands.length) return;

        const section = document.createElement("div");
        section.className = "chat-api-commands";
        const title = document.createElement("h3");
        title.textContent = "Commands";
        section.appendChild(title);

        commands.forEach((command) => {
          const commandValue = typeof command === "string"
            ? command
            : command && (command.command || command.text || command.value);
          if (!commandValue) return;

          const block = document.createElement("article");
          block.className = "chat-api-command";
          const code = document.createElement("code");
          code.textContent = commandValue;
          block.appendChild(code);

          if (command && typeof command === "object") {
            [
              ["Platform", command.platform],
              ["Purpose", command.purpose],
              ["Provenance", command.provenance],
            ].forEach(([label, value]) => {
              if (!value) return;
              const detail = document.createElement("span");
              detail.className = "chat-api-command-detail";
              detail.textContent = `${label}: ${value}`;
              block.appendChild(detail);
            });
          }

          const copy = document.createElement("button");
          copy.className = "chat-api-command-copy";
          copy.type = "button";
          copy.textContent = "Copy";
          copy.addEventListener("click", async () => {
            try {
              await navigator.clipboard.writeText(commandValue);
              copy.textContent = "Copied";
            } catch (error) {
              copy.textContent = "Copy failed";
            }
          });
          block.appendChild(copy);
          section.appendChild(block);
        });

        if (section.children.length > 1) item.appendChild(section);
      }

      function appendEvaluator(item, payload) {
        const evaluation = payload.jevEvaluation;
        if (!evaluation || evaluation.status === "not_run") return;
        const section = document.createElement("div");
        section.className = "chat-api-evaluator";
        const title = document.createElement("h3");
        title.textContent = "JEV evaluation signals";
        section.appendChild(title);

        const summary = document.createElement("div");
        summary.className = "chat-api-evaluator-summary";
        const status = document.createElement("strong");
        status.className = `chat-api-score chat-api-score-${evaluation.status === "selected" ? "good" : "caution"}`;
        status.textContent = evaluation.status === "selected" ? "Evidence selected" : evaluation.status;
        summary.appendChild(status);
        if (evaluation.reason) {
          const reason = document.createElement("span");
          reason.textContent = evaluation.reason;
          summary.appendChild(reason);
        }
        section.appendChild(summary);

        const confidenceSignals = [];
        (evaluation.evaluations || []).forEach((entry) => {
          Object.entries(entry && entry.metrics ? entry.metrics : {}).forEach(([name, value]) => {
            if (typeof value !== "number" || !/(confidence|scorepercent)/i.test(name)) return;
            const normalized = value > 1 ? value / 100 : value;
            if (Number.isFinite(normalized)) confidenceSignals.push(normalized);
          });
        });
        if (confidenceSignals.length) {
          const confidence = Math.max(...confidenceSignals);
          const percentage = Math.round(Math.max(0, Math.min(confidence, 1)) * 100);
          const signal = document.createElement("div");
          signal.className = "chat-api-jev-confidence";
          const label = document.createElement("span");
          label.textContent = "JEV confidence signal";
          const value = document.createElement("strong");
          value.className = `chat-api-score-${percentage >= 75 ? "good" : percentage >= 50 ? "caution" : "poor"}`;
          value.textContent = `${percentage}%`;
          const bar = document.createElement("span");
          bar.className = "chat-api-confidence-bar";
          const fill = document.createElement("span");
          fill.style.width = `${percentage}%`;
          fill.className = `chat-api-confidence-fill chat-api-score-${percentage >= 75 ? "good" : percentage >= 50 ? "caution" : "poor"}`;
          bar.appendChild(fill);
          signal.append(label, value, bar);
          section.appendChild(signal);
        }

        function scoreTone(name, value) {
          if (typeof value !== "number") return "";
          const normalized = name.toLowerCase().includes("confidence")
            ? (value <= 1 ? value : value / 100)
            : name.toLowerCase().includes("score") && value <= 2
              ? value / 2
              : null;
          if (normalized === null) return "";
          return normalized >= 0.75 ? "good" : normalized >= 0.5 ? "caution" : "poor";
        }

        function formatMetricValue(name, value) {
          if (typeof value !== "number") return String(value);
          if (name.toLowerCase().includes("confidence")) return `${Math.round(value * (value <= 1 ? 100 : 1))}%`;
          if (name.toLowerCase() === "score" && value <= 2) return `${value} / 2`;
          if (name.toLowerCase().includes("percent")) return `${Math.round(value * (value <= 1 ? 100 : 1))}%`;
          return String(value);
        }

        const seen = new Set();
        (evaluation.evaluations || []).forEach((entry) => {
          const metrics = entry && entry.metrics;
          if (!metrics || typeof metrics !== "object") return;
          Object.entries(metrics).forEach(([name, value]) => {
            if (value === null || typeof value === "object") return;
            const key = `${name}:${value}`;
            if (seen.has(key)) return;
            seen.add(key);
            const metric = document.createElement("div");
            metric.className = "chat-api-evaluator-metric";
            const label = document.createElement("span");
            label.textContent = name;
            const result = document.createElement("strong");
            const tone = scoreTone(name, value);
            if (tone) result.classList.add(`chat-api-score-${tone}`);
            result.textContent = formatMetricValue(name, value);
            metric.append(label, result);
            section.appendChild(metric);
          });
        });
        item.appendChild(section);
      }

      function appendTelemetry(item, payload) {
        const telemetry = payload.telemetry;
        if (!telemetry) return;
        const section = document.createElement("div");
        section.className = "chat-api-telemetry";
        const title = document.createElement("h3");
        title.textContent = "Response timing";
        section.appendChild(title);
        const labels = {
          planning: "Luna planning",
          sqlRetrieval: "SQL lookup",
          jev: "JEV selection",
          lunaInterpretation: "Luna interpretation",
        };
        Object.entries(telemetry.stages || {}).forEach(([name, stage]) => {
          const metric = document.createElement("div");
          metric.className = "chat-api-timing-row";
          const label = document.createElement("span");
          label.textContent = labels[name] || name;
          const value = document.createElement("strong");
          value.textContent = stage && stage.durationMs !== undefined
            ? `${stage.durationMs} ms (${stage.status || "unknown"})`
            : "Not run";
          metric.append(label, value);
          section.appendChild(metric);
        });
        const total = document.createElement("div");
        total.className = "chat-api-timing-total";
        total.textContent = `Total response: ${telemetry.totalMs ?? "unknown"} ms`;
        section.appendChild(total);
        item.appendChild(section);
      }

    searchForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const question = searchInput.value.trim();
      if (!question) {
        status.textContent = "Enter a question first.";
        return;
      }
      status.textContent = "Asking the Hub...";
      const loading = document.createElement("p");
      loading.className = "chat-api-loading";
      loading.setAttribute("role", "status");
      loading.textContent = "Working...";
      conversation.appendChild(loading);
      try {
        const response = await fetch("/chat-api/chat", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question,
            userRole: "admin",
            sourceScope: "SR-003",
            showEvidenceDetails: true,
            ...conversationState,
          }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        loading.remove();
        status.textContent = payload.outcome || "The Hub returned a response.";
        renderConversation(payload.conversation);
        searchInput.value = "";
      } catch (error) {
        loading.remove();
        status.textContent = "Chat service is unavailable.";
      }
    });

    clearButton.addEventListener("click", async () => {
      if (!conversationState.conversationId) {
        resetConversationState();
        status.textContent = "Conversation cleared.";
        return;
      }
      clearButton.disabled = true;
      status.textContent = "Clearing conversation...";
      try {
        const response = await fetch("/chat-api/chat", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            operation: "clear_conversation",
            requestId: `clear-${Date.now()}`,
            conversationId: conversationState.conversationId,
            ...conversationState,
          }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        resetConversationState();
        status.textContent = payload.outcome || "Conversation cleared.";
      } catch (error) {
        status.textContent = "The conversation could not be cleared.";
      } finally {
        clearButton.disabled = false;
      }
    });
  }

  const content = document.querySelector("#content");
  if (!content) return;
  const assetRoot =
    typeof window.location.pathname === "string" &&
    window.location.pathname.startsWith("/advisers/")
      ? "../../assets/"
      : "assets/";
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
    const loopCount = points > 0 ? Math.max(1, Math.floor(points / 20)) : 0;
    const flightDuration = loopCount
      ? Math.min(12, 3.8 + (loopCount - 1) * 0.75)
      : 0;
    const celebrationMarkup =
      points >= target ? createCelebrationMarkup(flightDuration) : "";
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
            <img class="bird${points === 0 ? " bird-still" : ""}" src="${assetRoot}th-swallow.png" alt="" aria-hidden="true" style="--bird-target: ${displayRatio * 100}%">
            <span class="gong" aria-label="Monthly target gong" role="img"></span>
            <span class="gong-caption"><span>${format(target)}</span> placement points<br>Monthly target</span>
            ${celebrationMarkup}
          </div>
        </div>
        <p class="celebrate${isOver ? " incentive" : points === target ? " goal" : ""}" role="status" aria-label="${status}">${message}</p>
      </section>`;
    document.querySelector("#month-value").textContent = month;
    document.querySelector("#month-chip").textContent = month;
    document.querySelector("#target-title").textContent = format(target);
    if (points >= target) scheduleGong(flightDuration + 3);
    if (points > 0) animateBird(displayRatio, loopCount);
  }

  function createCelebrationMarkup(delay) {
    const pieces = Array.from({ length: 120 }, (_, index) => {
      const left = (index * 37) % 101;
      const drift = Math.round(Math.sin(index * 2.4) * 90);
      const rotation = (index * 47) % 360;
      const hue = (index * 41) % 360;
      const stagger = (index % 16) * 0.1;
      return `<span class="confetti-piece" style="--confetti-left: ${left}%; --confetti-drift: ${drift}px; --confetti-rotation: ${rotation}deg; --confetti-hue: ${hue}; --confetti-stagger: ${stagger}s"></span>`;
    }).join("");
    return `<div class="celebration" aria-hidden="true" style="--celebration-delay: ${delay}s; --gong-delay: ${delay + 3}s"><img class="celebration-gong" data-src="${assetRoot}gong.gif" alt=""><div class="confetti-field">${pieces}</div></div>`;
  }

  function scheduleGong(delay) {
    if (typeof window.setTimeout !== "function") return;
    const gong = content.querySelector(".celebration-gong");
    window.setTimeout(() => {
      gong.setAttribute(
        "src",
        `${gong.getAttribute("data-src")}?start=${Date.now()}`,
      );
    }, delay * 1000);
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
