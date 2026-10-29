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
        if (turn.role === "assistant") appendReferences(item, payload);
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

    function appendReferences(item, payload) {
      const references = [];
      const seen = new Set();
      const candidates = Array.isArray(payload.citations) ? [...payload.citations] : [];
      const evidence = Array.isArray(payload.evidence) ? payload.evidence : [];
      evidence.forEach((entry) => {
        if (!entry || typeof entry !== "object") return;
        candidates.push({ ...entry, ...(entry.citation || {}) });
      });
      candidates.forEach((citation) => {
        if (!citation || typeof citation !== "object") return;
        const url = relativeReferenceUrl(citation);
        const headingPath = Array.isArray(citation.headingPath) ? citation.headingPath : [];
        const identity = `${url || ""}|${headingPath.join("/")}`;
        if (!url || seen.has(identity) || references.length >= 8) return;
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
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
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

    searchForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const question = searchInput.value.trim();
      if (!question) {
        status.textContent = "Enter a question first.";
        return;
      }
      status.textContent = "Asking the Hub...";
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
        status.textContent = payload.outcome || "The Hub returned a response.";
        renderConversation(payload.conversation);
        searchInput.value = "";
      } catch (error) {
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
