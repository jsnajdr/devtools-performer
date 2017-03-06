const buttons = require('sdk/ui/button/action');
const tabs = require("sdk/tabs");
const { viewFor } = require("sdk/view/core");
const { devtools } = require("resource://devtools/shared/Loader.jsm");
const { gDevTools } = devtools.require("devtools/client/framework/devtools");

var button = buttons.ActionButton({
  id: "reload",
  label: "Reload",
  icon: {
    "16": "./perf-icon.png"
  },
  onClick
});

function timeFrom(start) {
  return Date.now() - start;
}

let measurements = [];

// from netmonitor/constants
const EVENTS = {
  NETWORK_EVENT: "NetMonitor:NetworkEvent",
  RECEIVED_EVENT_TIMINGS: "NetMonitor:NetworkEventUpdated:EventTimings",
};

async function takeMeasurement() {
  let timings = {};

  let tab = tabs.activeTab;
  let target = devtools.TargetFactory.forTab(viewFor(tab));

  let openStart = Date.now();
  let toolbox = await gDevTools.showToolbox(target, "netmonitor");
  timings.open = timeFrom(openStart);

  let reloadStart = Date.now();
  let onReload = new Promise(r => tab.once("ready", r));
  tab.reload();
  await onReload;
  timings.reload = timeFrom(reloadStart);

  await waitForAllRequestsFinished(toolbox);
  timings.requests = timeFrom(reloadStart);

  let settleStart = Date.now();
  await target.client.waitForRequestsToSettle();
  timings.settle = timeFrom(settleStart);

  let closeStart = Date.now();
  await gDevTools.closeToolbox(target);
  timings.close = timeFrom(closeStart);

  return timings;
}

function average(values) {
  return values.reduce((sum, v) => sum + v) / values.length;
}

function averageAndDeviation(values) {
  let avg = average(values);
  let dev = Math.sqrt(average(values.map(v => (v - avg) ** 2)));
  return { avg, dev };
}

async function onClick(state) {
  // Take a new measurement and record it
  let timings = await takeMeasurement();
  measurements.push({ timings, index: measurements.length + 1 });

  // Display the last five measurements, plus stats about totals
  const lastFive = measurements.slice(-5);

  const totals = lastFive.reduce((total, { timings }) => {
    for (let [ name, time ] of Object.entries(timings)) {
      total[name] = (total[name] || []).concat(time);
    }
    return total;
  }, {});

  const reports = lastFive.map(m => [
    `Measurement #${m.index}:`,
    ...Object.entries(m.timings).map(([ name, time ]) => {
      return `\t${name}: ${time.toFixed(2)} ms`;
    })
  ].join("\n"));

  reports.push([
    "Averages:",
    ...Object.entries(totals).map(([ name, total ]) => {
      let stats = averageAndDeviation(total);
      return `\t${name}: ${stats.avg.toFixed(2)} ± ${stats.dev.toFixed(2)} ms`;
    })
  ].join("\n"));

  // Show the results as the button label (on mouseover)
  button.label = reports.join("\n\n");
}

/**
 * Start monitoring all incoming update events about network requests and wait until
 * a complete info about all requests is received. (We wait for the timings info
 * explicitly, because that's always the last piece of information that is received.)
 *
 * This method is designed to wait for network requests that are issued during a page
 * load, when retrieving page resources (scripts, styles, images). It has certain
 * assumptions that can make it unsuitable for other types of network communication:
 * - it waits for at least one network request to start and finish before returning
 * - it waits only for request that were issued after it was called. Requests that are
 *   already in mid-flight will be ignored.
 * - the request start and end times are overlapping. If a new request starts a moment
 *   after the previous one was finished, the wait will be ended in the "interim"
 *   period.
 * @returns a promise that resolves when the wait is done.
 */
async function waitForAllRequestsFinished(toolbox) {
  let panel = toolbox.getCurrentPanel();
  let window = panel.panelWin;

  return new Promise(resolve => {
    // Key is the request id, value is a boolean - is request finished or not?
    let requests = new Map();

    function onRequest(_, id) {
      requests.set(id, false);
    }

    function onTimings(_, id) {
      requests.set(id, true);
      maybeResolve();
    }

    function maybeResolve() {
      // Have all the requests in the map finished yet?
      if (![...requests.values()].every(finished => finished)) {
        return;
      }

      // All requests are done - unsubscribe from events and resolve!
      window.off(EVENTS.NETWORK_EVENT, onRequest);
      window.off(EVENTS.RECEIVED_EVENT_TIMINGS, onTimings);
      resolve();
    }

    window.on(EVENTS.NETWORK_EVENT, onRequest);
    window.on(EVENTS.RECEIVED_EVENT_TIMINGS, onTimings);
  });
}
