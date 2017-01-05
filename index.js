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

async function takeMeasurement() {
  let timings = {};

  let tab = tabs.activeTab;
  let target = devtools.TargetFactory.forTab(viewFor(tab));

  let openStart = Date.now();
  let toolbox = await gDevTools.showToolbox(target, "netmonitor");
  timings.open = timeFrom(openStart);

  const { NetMonitorController } = toolbox.getCurrentPanel().panelWin;

  let reloadStart = Date.now();
  let onReload = new Promise(r => tab.once("ready", r));
  tab.reload();
  await onReload;
  timings.reload = timeFrom(reloadStart);

  await NetMonitorController.waitForAllRequestsFinished();
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
