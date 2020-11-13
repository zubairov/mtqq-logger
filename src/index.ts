import { runInContext } from "vm";

const MQTT = require("async-mqtt");
const util = require('util');
const fs = require('fs');

const TOPIC = '#';
const state = {};
const MAX_FILE_SIZE = '1M';
const LOG_FILE_NAME = '/tmp/mtqq-exporter/mtqq-log-%DATE%';
const AUDIT_FILE_NAME = '/tmp/mtqq-exporter/audit-log.json';


run();

async function run() {
  console.log("Starting...");
  const client = await MQTT.connectAsync("mqtt://192.168.178.56")
  console.log("Connected to local MQTT");
  try {
    await client.subscribe(TOPIC);
    console.log(`Subscribed to ${TOPIC}`);
  } catch (e) {
    // Do something about it!
    console.log(e.stack);
    process.exit();
  }

  client.on('message', async (t, m) => {
    // console.log(`Topic ${t} has got message ${m.toString()}`);
    const path = t.split('/');
    const body = JSON.parse(m.toString());
    const type = path.shift();
    path.shift(); // status
    if (type == 'hm') {
      // console.log('Processing HM event');
      body.source = path.shift();
      body.event = path.shift();
      dumpEvent(body);
    } else if (type == 'km200') {
      //console.log('Processing KM200 event');
      let root = state;
      while (path.length > 1) {
        const next = path.shift();
        if (!root[next]) {
          root[next] = {};
        }
        root = root[next]
      }
      if (body.km200_unitOfMeasure) {
        root[path.join('_')] = body;
      } else {
        root[path.join('_')] = body.val;
      }
    }
  });

}

const logStream = require('file-stream-rotator').getStream(
  {
    filename: LOG_FILE_NAME,
    frequency: "custom",
    verbose: true,
    date_format: "YYYY-MM-DD",
    size: MAX_FILE_SIZE,
    extension: '.json',
    max_logs: 10,
    audit_file: AUDIT_FILE_NAME
  }
);
logStream.on('rotate', function (oldFile, newFile) {
  console.log(`File ${oldFile} is ready for upload`);
  fs.closeSync(fs.openSync(oldFile + '.ready', 'w'));
});

logStream.on('error', err => console.error(err));

async function dumpEvent(event) {
  const needDrain = logStream.write(JSON.stringify(event) + '\n', 'utf8');
  if (needDrain) {
    await new Promise(cb => logStream.once('drain', cb));
  }
}