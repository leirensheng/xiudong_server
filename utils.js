const { WxPusher, Message } = require("wxpusher");
const os = require("os");
let AdmZip = require("adm-zip");
const fsExtra = require("fs-extra");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
let isDistinct = 1;
let sleep = (time) => new Promise((r) => setTimeout(r, time));
let mainUid = `UID_ZFqEpe7kmm27SJ466yXdnbeWyIgL`;
const uniPush = require("./uniPush");

let sendMsgForCustomer = async (content, uid) => {
  const message = new Message();
  message.content = content;
  message.uids = [uid];
  const result = await new WxPusher("AT_s8ql37DbRNkrItpYhUK60xNNTeNE3ekp").send(
    message
  );
  console.log(result);
};

let zipConfig = (username) => {
  const file = new AdmZip();
  const dest = path.resolve(__dirname, "../xiudongPupp/userData/", username);
  const zipPath = path.resolve(dest, username + ".zip");
  file.addLocalFolder(dest);
  file.writeZip(zipPath);
  return zipPath;
};
let sendMsg = async (content) => {
  const message = new Message();
  message.content = `${content}`;
  message.uids = [mainUid];
  const result = await new WxPusher("AT_s8ql37DbRNkrItpYhUK60xNNTeNE3ekp").send(
    message
  );
  console.log(result);
};

let removeConfig = async (username, isNoRemove) => {
  let obj = await readFile("config.json");
  obj = JSON.parse(obj);
  delete obj[username];
  await writeFile("config.json", JSON.stringify(obj, null, 4));

  if (!isNoRemove) {
    const dest = path.resolve(__dirname, "../xiudongPupp/userData/", username);
    fsExtra.removeSync(dest);
  }
};
function readFile(name) {
  return new Promise((resolve, reject) => {
    fs.readFile(path.resolve("../xiudongPupp", name), "utf-8", (e, res) => {
      if (e) {
        reject(e);
        return;
      }
      resolve(res);
    });
  });
}
function writeFile(name, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(path.resolve("../xiudongPupp", name), data, (e) => {
      if (e) {
        reject(e);
        return;
      }
      resolve();
    });
  });
}


let startSendTime;
let sendTimeInLast30Second = 0;
let sendFre = false;
let sendAppMsg = async (title, content, payload) => {
  if (!content || typeof content !== "string") {
    let msg = "发送信息出错,内容错";
    console.log(msg, content);
    await uniPush("出错", "发送信息出错,内容错", {
      type: "error",
    });
    return;
  }
  try {
    if (sendFre) return;
    sendTimeInLast30Second++;

    if (!startSendTime) {
      startSendTime = Date.now();
    } else {
      let dis = Date.now() - startSendTime;
      console.log(dis, sendTimeInLast30Second);
      if (dis >= 30) {
        startSendTime = Date.now();
        if (sendTimeInLast30Second > 40) {
          sendFre = true;

          await uniPush(
            "出错",
            "发送信息频繁,0.3秒内超过40条信息, 暂停接受30s",
            {
              type: "error",
            }
          );
          sendTimeInLast30Second = 0;
          setTimeout(() => {
            sendFre = false;
          }, 30000);
          return;
        }
        sendTimeInLast30Second = 0;
      }
    }

    await uniPush(title, content, payload);
  } catch (e) {
    sendMsg("推送失败" + e.message);
    console.log(e);
  }
};

let startDamaiUser = async (user) => {
  await axios({
    method: "post",
    data: {
      cmd: "npm run start " + user,
    },
    url: `http://localhost:5000/startUserFromRemote`,
  });
};

let waitUntilSuccess = (fn, times0 = 20, sleepTime = 5000) => {
  return async function (...args) {
    let times = times0;
    while (times) {
      try {
        let res = await fn.call(this, ...args);
        times = 0;
        return res;
      } catch (e) {
        if (sleepTime) {
          await sleep(sleepTime);
        }
        times--;
        console.log(e);
        console.log("出错重试");
      }
    }
    throw new Error("出错了");
  };
};

let formatNumber = (val) => (val < 10 ? "0" + val : val);
let getTime = (date, isNoMillisecond) => {
  if (!date) {
    date = new Date();
  }
  let hour = date.getHours();
  let minute = date.getMinutes();
  let second = date.getSeconds();
  let millisecond = date.getMilliseconds();

  return `${formatNumber(hour)}:${formatNumber(minute)}:${formatNumber(
    second
  )}${isNoMillisecond ? "" : "." + millisecond}`;
};

let random = () =>
  String(Math.floor(Math.random() * 10000000000000000000)).padStart(10, "0");

let myClick = async (page, selector, timeout = 6000) => {
  await page.waitForSelector(selector, { timeout });
  await page.$eval(selector, (dom) => dom.click());
};

let cleanFileAfterClose = (browser) => {
  let chromeSpawnArgs = browser.process().spawnargs;
  let chromeTmpDataDir;
  for (let i = 0; i < chromeSpawnArgs.length; i++) {
    if (chromeSpawnArgs[i].indexOf("--user-data-dir=") === 0) {
      chromeTmpDataDir = chromeSpawnArgs[i].replace("--user-data-dir=", "");
      break;
    }
  }
  browser.newClose = async () => {
    try {
      const isConnected = browser.isConnected();
      if (!isConnected) {
        browser = null;
      } else {
        await browser.close();
      }

      setTimeout(() => {
        fsExtra.removeSync(chromeTmpDataDir);
      }, 2000);
    } catch (e) {
      sendAppMsg("出错", "newClose执行失败", { type: "error" });
    }
  };
};

let getDouyaIp = async (platform, usingIp) => {
  let getIp = async () => {
    let { data } = await axios(
      `https://api.douyadaili.com/proxy/?service=GetUnl&authkey=wLBiTQSHE5opEXokzDwZ&num=${1}&format=json&distinct=${isDistinct}&detail=1&portlen=4`
    );
    if (data.msg.match(/今日最大|资源不足/)) {
      isDistinct = 0;
    }
    let ip = data.data[0].ip + ":" + data.data[0].port;
    // console.log("platform", platform);
    if (usingIp[platform].includes(ip)) {
      throw new Error(platform+"重复");
    }
    console.count();
    return ip;
  };
  let newFn = waitUntilSuccess(getIp, 5, 1000);
  let realIp = await newFn();
  return realIp;
};

let randomVal = (min, max) => Math.floor(Math.random() * (max - min)) + min;

module.exports = {
  zipConfig,
  removeConfig,
  readFile,
  writeFile,
  sendMsgForCustomer,
  waitUntilSuccess,
  random,
  randomVal,
  getTime,
  sleep,
  sendAppMsg,
  getDouyaIp,
  sleep,
  startDamaiUser,
  myClick,
  cleanFileAfterClose,
};
