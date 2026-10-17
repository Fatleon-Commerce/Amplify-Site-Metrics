import { VISIT_GAP_MS } from "../../lib/constants";
import { boardWidget } from "./board-widget";

export function trackerScript(siteKey: string, endpoint: string, boardEndpoint = ""): string {
  const key = JSON.stringify(siteKey);
  const url = JSON.stringify(endpoint);
  const source = `(function(){
  if (window.__siteMetrics) return;
  window.__siteMetrics = 1;
  var siteKey = ${key};
  var endpoint = ${url};
  var GAP = ${VISIT_GAP_MS};
  var VID = "sm_vid";
  var SID = "sm_sid";
  var LAST = "sm_seen";
  function rid(n) {
    var alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    var bytes = (window.crypto && crypto.getRandomValues) ? crypto.getRandomValues(new Uint8Array(n)) : null;
    var value = "";
    for (var i = 0; i < n; i++) value += alphabet[(bytes ? bytes[i] : Math.floor(Math.random() * 256)) % alphabet.length];
    return value;
  }
  function vid() {
    try {
      var id = localStorage.getItem(VID);
      if (!id) { id = rid(24); localStorage.setItem(VID, id); }
      return id;
    } catch (e) { return rid(24); }
  }
  function sid() {
    var now = Date.now();
    try {
      var id = sessionStorage.getItem(SID);
      var last = Number(sessionStorage.getItem(LAST) || 0);
      if (!id || now - last > GAP) id = rid(16);
      sessionStorage.setItem(SID, id);
      sessionStorage.setItem(LAST, String(now));
      return id;
    } catch (e) { return rid(16); }
  }
  function utm(name) {
    try { return new URLSearchParams(location.search).get(name) || ""; } catch (e) { return ""; }
  }
  function referrer() {
    try {
      if (sessionStorage.getItem("sm_ref")) return "";
      sessionStorage.setItem("sm_ref", "1");
      if (!document.referrer) return "";
      var host = new URL(document.referrer).host;
      if (host === location.host) return "";
      return document.referrer;
    } catch (e) { return ""; }
  }
  function send(payload) {
    payload.siteKey = siteKey;
    payload.visitorId = vid();
    payload.sessionId = sid();
    payload.lang = navigator.language || "";
    var body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob([body], { type: "text/plain;charset=UTF-8" }))) return;
    } catch (e) {}
    fetch(endpoint, { method: "POST", body: body, headers: { "Content-Type": "text/plain;charset=UTF-8" }, mode: "cors", keepalive: true }).catch(function () {});
  }
  var open = null;
  function ping(finalPing) {
    if (!open) return;
    send({ op: "pageleave", eventId: open.eventId, path: open.path, durationMs: Date.now() - open.t, occurredAt: new Date().toISOString() });
    if (finalPing) open = null;
  }
  function page() {
    var path = location.pathname + location.search;
    if (open && open.path === path) return;
    ping(true);
    var eventId = rid(12);
    open = { eventId: eventId, path: path, t: Date.now() };
    send({
      op: "pageview",
      eventId: eventId,
      path: path,
      title: document.title || "",
      referrer: referrer(),
      occurredAt: new Date().toISOString(),
      utmSource: utm("utm_source"),
      utmMedium: utm("utm_medium"),
      utmCampaign: utm("utm_campaign")
    });
  }
  var pushState = history.pushState;
  history.pushState = function () {
    var result = pushState.apply(this, arguments);
    setTimeout(page, 0);
    return result;
  };
  window.addEventListener("popstate", function () { setTimeout(page, 0); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") ping(false);
  });
  window.addEventListener("pagehide", function () { ping(true); });
  page();
})();`;
  if (!boardEndpoint) return source;
  return `${source}\n${boardWidget(boardEndpoint)}`;
}
