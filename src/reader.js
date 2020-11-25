const readline = require('readline');

const LOOKUP_HM_EVENTS = {
    'OPERATING_VOLTAGE': 'voltage',
    'ACTUAL_HUMIDITY': 'actual_humidity',
    'HUMIDITY': 'humidity',
    'VALVE_STATE': 'ventil_open',
    'BATTERY_STATE': 'battery_state',
    'ACTUAL_TEMPERATURE': 'actual_temp',
    'TEMPERATURE': 'temp',
    'ILLUMINATION': 'illumination',
    'OPERATING_VOLTAGE': 'battery_voltage',
    'RSSI_DEVICE':'rssi_device',
    'FREQUENCY': 'frequency',
    'ENERGY_COUNTER': 'energy_counter_wh',
    'VOLTAGE': 'voltage_v',
    'CURRENT': 'current_ma',
    'POWER': 'power_w'
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', function(line){
    const event = JSON.parse(line);
    const origin = event.origin;
    if (origin == 'hm') {
        const ts = Math.round(event.ts / 1000);
        if (LOOKUP_HM_EVENTS[event.event] && event.hm.ADDRESS) {
            const source = event.hm.ADDRESS.split(':')[0];
            console.log(`homematic.${source}.${LOOKUP_HM_EVENTS[event.event]} ${event.val} ${ts}`);
        }
        // if (!LOOKUP_HM_EVENTS[event.event] && typeof event.val == 'number') {
        //     if (event.hm && event.hm.UNIT) {
        //         if (!event.event.startsWith('PARTY_')) console.log(event.event);
        //         if (event.event == 'LEVEL') console.log(event);
        //     }
        // }
    } else if (origin == 'km200') {
        const ts = event.ts;
        console.log(`buderus.${event.source}.${event.event} ${event.val} ${ts}`);
    }
});

