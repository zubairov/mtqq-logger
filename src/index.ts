import { runInContext } from "vm";

const MQTT = require("async-mqtt");

const TOPIC = 'km200/status/#';
const state = {};

run();

async function run() {
  console.log("Starting...");
  const client = await MQTT.connectAsync("mqtt://192.168.178.56")
  console.log("Connected to local MQTT");
  const google = await connectToGoogle();
  const deviceId = `BuderusHeizung`;
  setInterval(async () => {
    console.log(`Sending state to Google Cloud \n ${JSON.stringify(state, null, '\t')}`);
    const mqttTopic = `/devices/${deviceId}/state`;
    await google.publish(mqttTopic, JSON.stringify(state));
    console.log('Published to google');
  b}, 60000)

  try {
    await client.subscribe(TOPIC);
    console.log(`Subscribed to ${TOPIC}`);
  } catch (e) {
    // Do something about it!
    console.log(e.stack);
    process.exit();
  }

  client.on('message', async (t, m) => {
    console.log(`Topic ${t} has got message ${m.toString()}`);
    const path = t.split('/');
    const body = JSON.parse(m.toString());
    // timestamp = body.ts;
    delete body.ts;
    path.shift();
    path.shift();
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
  });

}

async function connectToGoogle() {
  const projectId = `homeiot-295316`;
  const deviceId = `BuderusHeizung`;
  const registryId = `Home`;
  const gatewayId = 'homebridge';
  const region = `europe-west1`;
  const mqttBridgeHostname = `mqtt.googleapis.com`;
  const privateKeyFile = `./resources/rsa_private.pem`
  const mqttBridgePort = 8883;
  const messageType = `state`;
  const algorithm = `RS256`;


  // The mqttClientId is a unique string that identifies this device. For Google
  // Cloud IoT Core, it must be in the format below.
  const mqttClientId = `projects/${projectId}/locations/${region}/registries/${registryId}/devices/${gatewayId}`;

  // With Google Cloud IoT Core, the username field is ignored, however it must be
  // non-empty. The password field is used to transmit a JWT to authorize the
  // device. The "mqtts" protocol causes the library to connect using SSL, which
  // is required for Cloud IoT Core.
  const connectionArgs = {
    host: mqttBridgeHostname,
    port: mqttBridgePort,
    clientId: mqttClientId,
    username: 'unused',
    password: createJwt(projectId, privateKeyFile, algorithm),
    protocol: 'mqtts',
    secureProtocol: 'TLSv1_2_method',
  };
  console.log('Connecting to Google MQTT');
  const client = await MQTT.connectAsync(connectionArgs);
  console.log('Connected to Google MQTT');

  client.on('error', err => {
    console.log('error in Google MQTT', err);
  });
  client.subscribe(`/devices/${gatewayId}/errors`, { qos: 0 });
  await attachDevice(deviceId, client);
  client.on('message', (topic, message) => {
    const decodedMessage = Buffer.from(message, 'base64').toString('ascii');
    console.log(`message received on Google error topic ${topic}: ${decodedMessage}`);
  });
  client.on('packetsend', () => {
    console.log('Google Packetsend');
  });
  return client;
}


// Create a Cloud IoT Core JWT for the given project id, signed with the given
// private key.
// [START iot_mqtt_jwt]
const createJwt = (projectId, privateKeyFile, algorithm) => {
  // Create a JWT to authenticate this device. The device will be disconnected
  // after the token expires, and will have to reconnect with a new token. The
  // audience field should always be set to the GCP project id.
  const token = {
    iat: Math.round(new Date().getTime() / 1000),
    exp: Math.round(new Date().getTime() / 1000) + 20 * 60, // 20 minutes
    aud: projectId,
  };
  const privateKey = fs.readFileSync(privateKeyFile);
  return jwt.sign(token, privateKey, { algorithm: algorithm });
};

// Attaches a device to a gateway.
const attachDevice = async (deviceId, client, jwt?: undefined) => {
  const attachTopic = `/devices/${deviceId}/attach`;
  console.log(`Attaching: ${attachTopic}`);
  let attachPayload = '{}';
  if (jwt && jwt !== '') {
    attachPayload = `{ 'authorization' : ${jwt} }`;
  }
  console.log(`Attaching device ${deviceId} to the gateway`);
  await client.publish(attachTopic, attachPayload, { qos: 1 });
};