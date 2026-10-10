const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function run(search) {
  const monthElement = { textContent: "" };
  const monthChip = { textContent: "" };
  const targetTitle = { textContent: "" };
  const bird = {
    style: {},
    offsetTop: 58,
    clientHeight: 44,
    classList: { add() {} },
    addEventListener() {},
  };
  const content = {
    innerHTML: "",
    children: [],
    querySelector(selector) {
      if (selector === ".bird") return bird;
      if (selector === ".track-wrap")
        return {
          clientWidth: 800,
          querySelector() {
            return { offsetTop: 102 };
          },
        };
      throw new Error(`Unexpected selector: ${selector}`);
    },
    appendChild(node) {
      this.children.push(node);
    },
  };
  const document = {
    querySelector(selector) {
      if (selector === "#content") return content;
      if (selector === "#month-value") return monthElement;
      if (selector === "#month-chip") return monthChip;
      if (selector === "#target-title") return targetTitle;
      throw new Error(`Unexpected selector: ${selector}`);
    },
    createElement() {
      return {
        className: "",
        children: [],
        setAttribute() {},
        appendChild(node) {
          this.children.push(node);
        },
      };
    },
  };
  vm.runInNewContext(source, {
    URLSearchParams,
    Intl,
    document,
    window: { location: { search } },
  });
  return { content, monthElement, monthChip, targetTitle, bird };
}

test("renders an encoded month and explicit over-target state", () => {
  const result = run(
    "?month-name=October%20%26%20November&target-points=56&points=61",
  );
  assert.equal(result.monthElement.textContent, "October & November");
  assert.equal(result.monthChip.textContent, "October & November");
  assert.equal(result.targetTitle.textContent, "56");
  assert.match(result.content.innerHTML, /5 points above target/);
  assert.match(result.content.innerHTML, /class="celebrate incentive"/);
});

test("renders an incomplete state for missing values", () => {
  const result = run("?month-name=October&target-points=56");
  assert.equal(result.content.children.length, 1);
  assert.match(result.content.children[0].innerHTML, /Progress is incomplete/);
  assert.match(
    result.content.children[0].children[0].children[0].textContent,
    /points/,
  );
});

test("rejects negative points", () => {
  const result = run("?month-name=October&target-points=56&points=-1");
  assert.match(
    result.content.children[0].children[0].children[0].textContent,
    /non-negative whole number/,
  );
});

test("sets the swallow destination on the same scale as the progress bar", () => {
  const result = run("?month-name=October&target-points=56&points=13");
  assert.match(result.content.innerHTML, /class="bird"/);
  assert.match(result.content.innerHTML, /--bird-target: 17\.410714285714285%/);
  assert.doesNotMatch(result.content.innerHTML, /--bird-loop-/);
  assert.match(result.bird.style.offsetPath, /^path\("M 0 80 C /);
  assert.equal((result.bird.style.offsetPath.match(/ C /g) || []).length, 6);
  assert.ok(result.bird.style.offsetPath.endsWith('139.28571428571428 80")'));
});

test("keeps the swallow at zero when no points have been earned", () => {
  const result = run("?month-name=October&target-points=56&points=0");
  assert.match(result.content.innerHTML, /class="bird bird-still"/);
  assert.match(result.content.innerHTML, /--bird-target: 0%/);
  assert.equal(result.bird.style.offsetPath, undefined);
});
