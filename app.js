'use strict';

process.stdout.isTTY = true; // for colors plugin. https://github.com/Marak/colors.js/issues/196#issuecomment-302943622
let colors = require('colors');
const fs = require('fs');
const path = require('path');
let csv = require('fast-csv');
let readStream = fs.createReadStream(process.argv[2] || './customers.csv');
// let readStream = fs.createReadStream('./customers.csv');
let http = require('http');
const { exec } = require('child_process');

process.on('beforeExit', code => {
    console.log('beforeExit', code);
    // exec(`taskkill -F -T -PID ${cp.pid}`, (error, stdout, stderr) => {
    //     if (error) {
    //         console.error(`exec error: ${error}`);
    //         return;
    //     }
    //     console.log(`stdout: ${stdout}`, typeof stdout, stdout);
    //     console.log(`stderr: ${stderr}`, typeof stderr, stderr);
    // });
})

let options = {
    hostname: '127.0.0.1',
    port: 9090,
    path: '/messages',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    }
}

var csvStream = csv({
    headers: true,
    // objectMode: false,
})
.on("data", function(chunk) {
    let sd = chunk.schedule.split('-').map(val => val.replace(/s$/i, '') );
    let timers = {};
    for(let t of sd) {

        let tid = setTimeout((props) => {
            console.log(`${t}s:`.yellow.bold, `\`${props.email}\``.yellow);

            let postData = JSON.stringify(props);
            options.headers['Content-Length'] = Buffer.byteLength(postData);

            let req = http.request(options);
            req.on('response', (res) => {
                // console.log('RESPONSE statusCode', res.statusCode);
                res.setEncoding('utf8');
                res.on('data', (resp) => {
                    let json = JSON.parse(resp);
                    // console.log(`resp: ${resp}`);
                    if(json.paid === true) {
                        console.log(`  Paid.`.green.bold, `No more remiders for \`${json.email}\`.`);
                        // console.log(`timers: ${Object.keys(timers)}`);
                        clearTimers(timers);
                        return;
                    }
                    else {
                        console.log(`  Not paid!`.red.bold, `Reminders to be sent: ${Object.keys(timers).length}.\n`)
                    }
                });
                res.on('end', () => {
                    // console.log('END http request');
                });
            });
            req.write(postData);
            req.end();

            clearTimeout(tid);
            delete timers[`${t}_${chunk.email}`];
        }, t*1000,
        {text: chunk.text, email: chunk.email});

        timers[`${t}_${chunk.email}`] = tid;
    }
})
.on("close", function(val){
    // console.log("CLOSE parsing CSV", val);
})
.on("end", function(val){
    // console.log("END parsing CSV", val);
});

readStream.pipe(csvStream);


function clearTimers(timers) {
    let keys = Object.keys(timers);
    console.log(`  Unscheduling ${keys.length} reminders.\n`);
    keys.forEach(t => {
        // console.log('DELETING', t);
        clearTimeout(timers[t]);
    });
    // console.log('\n');
}