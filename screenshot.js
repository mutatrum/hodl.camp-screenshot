require('log-timestamp');
const cron = require('node-cron');
const request = require('request');
const fs = require('fs');
const puppeteer = require('puppeteer');
const Client = require('ftp');
const config = require('./config.js');

(function () {
  console.log('init')
  cron.schedule('0 15 3 * * *', () => onSchedule());
})();

async function onSchedule() {
  console.log('start');
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  console.log('load page');
  await page.goto('https://hodl.camp/#pair=btc-usd&scale=33', { waitUntil: 'networkidle0' });
  console.log('sleep');
  await page.waitFor(2000);

  let width = await page.evaluate(() => {
    let element = document.getElementById('hodl');
    return element.width;
  });

  let size = Math.floor(width * 0.33) + 16;
  console.log('size: ' + size);

  await page.setViewport({
    width: size,
    height: size,
    deviceScaleFactor: 1,
  });

  await page.mouse.move(810, 228);

  console.log('screenshot');

  await page.screenshot({path: 'screenshot.png'});

  console.log('close');

  await browser.close();

  console.log('tinify');

  var options1 = {
    url: 'https://api.tinify.com/shrink',
    method: 'POST',
    body: fs.createReadStream('screenshot.png'),
    auth: config.tinify
  };

  function callback1(error, response, body) {
    console.log('upload ' + response.statusCode);
    if (error) {
      console.log(error);
    }
    let data = JSON.parse(body);

    var options2 = {
      url: data.output.url,
      auth: config.tinify,
      json: { 'resize': { 'method': 'scale', 'width': 1024 } }
    };

    function callback2(error, response, body) {
      console.log('download ' + response.statusCode);
      if (error) {
        console.log(error);
      }
      
      upload();
    }
    request(options2, callback2).pipe(fs.createWriteStream('screenshot.png'));
  }

  request(options1, callback1);
};

function upload() {
  console.log(`ftp ${config.ftp.host}`);

  var client = new Client();
  client.on('ready', function() {
    client.put('screenshot.png', 'httpdocs/hodl.png', function(err) {
      if (err) throw err;
      client.end();
      
      fs.unlinkSync('screenshot.png');

      console.log('done');
    });
  }).on('error', function(error) {
    console.log(`error: ${error}`);
  }).on('greeting', function(msg) {
    console.log(`greeting: ${msg}`);
  });
  client.connect(config.ftp);
}
