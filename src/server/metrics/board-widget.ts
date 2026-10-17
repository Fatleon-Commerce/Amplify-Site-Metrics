import { BOARD_LIST_LIMIT, BOARD_MAX_BODY, BOARD_MAX_NAME } from "../../lib/constants";

const CSS = `
:host { font-family: system-ui, "PingFang SC", "Noto Sans SC", sans-serif; color: #1f2328; }
.launcher {
  width: 48px; height: 48px; border-radius: 999px; border: 1px solid #e6e8ec; background: #fff;
  box-shadow: 0 8px 24px rgba(16, 24, 40, 0.16); cursor: pointer; display: grid; place-items: center; padding: 0;
}
.panel {
  position: absolute; right: 0; bottom: 60px; width: min(340px, calc(100vw - 32px));
  max-height: min(480px, 70vh); display: flex; flex-direction: column; overflow: hidden;
  background: #fff; color: #1f2328; border: 1px solid #e6e8ec; border-radius: 16px;
  box-shadow: 0 12px 40px rgba(16, 24, 40, 0.18);
}
.panel[hidden] { display: none; }
.head { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid #e6e8ec; }
.head strong { font-size: 15px; }
.head button { border: 0; background: transparent; color: #667085; font-size: 22px; line-height: 1; cursor: pointer; padding: 0 4px; }
.list { overflow: auto; padding: 12px 12px 4px; max-height: 280px; }
.msg { background: #f6f7f9; border-radius: 10px; padding: 8px 10px; margin: 0 0 10px; }
.msg strong { font-size: 13px; margin-right: 8px; }
.msg time { color: #667085; font-size: 12px; }
.msg p { margin: 4px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 14px; line-height: 1.5; }
.empty { margin: 8px 0 16px; color: #667085; font-size: 14px; }
form { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px 12px; border-top: 1px solid #e6e8ec; }
input, textarea {
  font: inherit; color: #1f2328; background: #fff; border: 1px solid #e6e8ec; border-radius: 8px; padding: 8px 10px;
}
textarea { resize: vertical; min-height: 72px; max-height: 140px; }
form button { border: 0; background: #0b57d0; color: #fff; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
form button:disabled { opacity: 0.6; cursor: default; }
.status { margin: 0; color: #b42318; font-size: 13px; }
.status:empty { display: none; }
.hp { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0; overflow: hidden; clip: rect(0 0 0 0); }
.launcher:focus-visible, .head button:focus-visible, form button:focus-visible { outline: 2px solid #b9d0fb; outline-offset: 2px; }
@media (max-width: 640px) {
  .panel {
    position: fixed; left: 12px; right: 12px; bottom: calc(72px + env(safe-area-inset-bottom, 0px));
    width: auto; max-height: 70vh;
  }
  .list { max-height: calc(70vh - 240px); }
}
@media print { :host { display: none; } }
`;

const ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v6A3.5 3.5 0 0 1 15.5 16H12l-3.2 3.2c-.6.6-1.8.2-1.8-.7V16H8.5A3.5 3.5 0 0 1 5 12.5v-6Z" stroke="#1f2328" stroke-width="1.8" stroke-linejoin="round"/></svg>`;

export function boardWidget(endpoint: string): string {
  const url = JSON.stringify(endpoint);
  const css = JSON.stringify(CSS);
  const icon = JSON.stringify(ICON);
  return `(function(){
  if (window.__siteBoard) return;
  window.__siteBoard = 1;
  var endpoint = ${url};
  var MAX_BODY = ${BOARD_MAX_BODY};
  var MAX_NAME = ${BOARD_MAX_NAME};
  var open = false;
  var loaded = false;
  var loading = false;
  var pending = false;
  var stamp = "";
  var items = [];
  function pad(value) { return (value < 10 ? "0" : "") + value; }
  function when(iso) {
    var date = new Date(iso);
    if (isNaN(date.getTime())) return "";
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[date.getMonth()] + " " + date.getDate() + ", " + pad(date.getHours()) + ":" + pad(date.getMinutes());
  }
  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }
  function mount() {
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", mount);
      return;
    }
    var host = document.createElement("div");
    host.setAttribute("data-site-board", "");
    host.style.cssText = "all:initial;position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom, 0px));z-index:2147483000;color-scheme:light;";
    var root = host.attachShadow({ mode: "open" });
    var style = el("style");
    style.textContent = ${css};
    var launcher = el("button", "launcher");
    launcher.type = "button";
    launcher.setAttribute("aria-label", "Guestbook");
    launcher.setAttribute("aria-expanded", "false");
    launcher.innerHTML = ${icon};
    var panel = el("div", "panel");
    panel.hidden = true;
    panel.id = "site-board-panel";
    launcher.setAttribute("aria-controls", panel.id);
    var head = el("div", "head");
    var title = el("strong");
    title.textContent = "Guestbook";
    var closeBtn = el("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "×";
    head.appendChild(title);
    head.appendChild(closeBtn);
    var list = el("div", "list");
    var status = el("p", "status");
    status.setAttribute("aria-live", "polite");
    var form = el("form");
    var honey = el("input", "hp");
    honey.tabIndex = -1;
    honey.setAttribute("aria-hidden", "true");
    honey.autocomplete = "off";
    honey.name = "company";
    var nameInput = el("input");
    nameInput.type = "text";
    nameInput.maxLength = MAX_NAME;
    nameInput.placeholder = "Name (optional)";
    nameInput.setAttribute("aria-label", "Name");
    nameInput.autocomplete = "nickname";
    var text = el("textarea");
    text.maxLength = MAX_BODY;
    text.placeholder = "Write a message";
    text.setAttribute("aria-label", "Message");
    var submitBtn = el("button");
    submitBtn.type = "submit";
    submitBtn.textContent = "Send";
    form.appendChild(honey);
    form.appendChild(nameInput);
    form.appendChild(text);
    form.appendChild(status);
    form.appendChild(submitBtn);
    panel.appendChild(head);
    panel.appendChild(list);
    panel.appendChild(form);
    root.appendChild(style);
    root.appendChild(panel);
    root.appendChild(launcher);
    document.body.appendChild(host);

    function render() {
      list.textContent = "";
      if (!items.length) {
        var empty = el("p", "empty");
        empty.textContent = "No messages yet";
        list.appendChild(empty);
        return;
      }
      for (var index = 0; index < items.length; index += 1) {
        var item = items[index];
        var box = el("div", "msg");
        var who = el("strong");
        who.textContent = item.name || "Anonymous";
        var time = el("time");
        time.dateTime = item.createdAt || "";
        time.textContent = when(item.createdAt);
        var body = el("p");
        body.textContent = item.body || "";
        box.appendChild(who);
        box.appendChild(time);
        box.appendChild(body);
        list.appendChild(box);
      }
      list.scrollTop = 0;
    }
    function setOpen(next) {
      open = next;
      panel.hidden = !open;
      launcher.setAttribute("aria-expanded", open ? "true" : "false");
      if (!open) return;
      load();
      text.focus();
    }
    function close() { setOpen(false); }
    function load() {
      if (loaded || loading) return;
      loading = true;
      status.textContent = "Loading…";
      fetch(endpoint, { headers: { accept: "application/json" }, cache: "no-store", credentials: "omit", mode: "cors" })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          loading = false;
          if (!data || data.ok !== true) throw new Error("load");
          loaded = true;
          stamp = data.stamp || "";
          items = data.enabled === false ? [] : (data.messages || []);
          form.hidden = data.enabled === false;
          status.textContent = data.enabled === false ? "Guestbook is off" : "";
          render();
        })
        .catch(function () {
          loading = false;
          status.textContent = "Could not load messages";
        });
    }
    function fail(code) {
      if (code === "wait") status.textContent = "Wait a few seconds and try again";
      else if (code === "rate") status.textContent = "Too many messages. Try again later";
      else if (code === "duplicate") status.textContent = "You already sent this";
      else if (code === "large") status.textContent = "Message is too long";
      else if (code === "empty") status.textContent = "Write a message first";
      else if (code === "closed") { form.hidden = true; status.textContent = "Guestbook is off"; }
      else if (code === "stamp") {
        status.textContent = "Try again";
        fetch(endpoint, { cache: "no-store", credentials: "omit", mode: "cors" })
          .then(function (response) { return response.json(); })
          .then(function (data) { if (data && data.stamp) stamp = data.stamp; })
          .catch(function () {});
      } else status.textContent = "Could not send";
    }
    launcher.addEventListener("click", function () { setOpen(!open); });
    closeBtn.addEventListener("click", function () { close(); });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") close();
    });
    document.addEventListener("click", function (event) {
      if (!open || event.target === host) return;
      close();
    });
    var pushState = history.pushState;
    history.pushState = function () {
      var result = pushState.apply(this, arguments);
      close();
      return result;
    };
    window.addEventListener("popstate", function () { close(); });
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (pending || form.hidden) return;
      var body = String(text.value || "").replace(/^\\s+|\\s+$/g, "");
      var name = String(nameInput.value || "").replace(/^\\s+|\\s+$/g, "");
      if (!body) { status.textContent = "Write a message first"; return; }
      pending = true;
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";
      status.textContent = "";
      fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "omit",
        mode: "cors",
        body: JSON.stringify({ body: body, name: name, company: honey.value, stamp: stamp })
      }).then(function (response) {
        return response.json().then(function (data) { return data || {}; }, function () { return {}; });
      }).then(function (data) {
        pending = false;
        submitBtn.disabled = false;
        submitBtn.textContent = "Send";
        if (data.ok === true && data.message) {
          items.unshift(data.message);
          if (items.length > ${BOARD_LIST_LIMIT}) items.length = ${BOARD_LIST_LIMIT};
          text.value = "";
          stamp = data.stamp || stamp;
          status.textContent = "";
          render();
          return;
        }
        if (data.ok === true) {
          text.value = "";
          status.textContent = "";
          return;
        }
        fail(data.error);
      }).catch(function () {
        pending = false;
        submitBtn.disabled = false;
        submitBtn.textContent = "Send";
        status.textContent = "Could not send";
      });
    });
  }
  mount();
})();`;
}
