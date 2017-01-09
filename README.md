# Devtools Performer

SDK add-on to measure performance of Firefox Netmonitor. Performs tests similar
to talos DAMP, but directly in your current browser, after clicking a button.

1. Build and install the add-on with `jpm xpi` (or `jpm run`)
2. Navigate to a testing page of your choice
3. Click the toolbar button to take a performance measurement
4. The tool will open Netmonitor, reload the page, and close
5. On mouse over the toolbar button, last 5 measurement are displayed, including
   aggregate stats (average + stddev)

Requires the latest Firefox Nightly, with patches from
[bug 1328553](https://bugzilla.mozilla.org/show_bug.cgi?id=1328553).

Contributors are welcome! Some first ideas for enhancements:
- create a better icon :) The current one is the best I could do after a hard fight with Pixelmator
- replace the primitive results display in a tooltip with a nice formatted Panel
- add more common actions, like "do X measurements in a row"
- add support for measuring other tools, not only Netmonitor

## More detailed install instruction

### Get the addon

Get addon source from github

```
$ git clone https://github.com/jsnajdr/devtools-performer.git
$ cd devtools-performer
```

### Compile addon

Compile with jpm tool

```
$ npm install -g jpm
$ jpm xpi
```

### Install addon
Go to Firefox `about:config` page and set `xpinstall.signatures.required` to `false`.

Drag `devtools-performer.xpi` to firefox to install it.
