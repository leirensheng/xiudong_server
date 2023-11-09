const pty = require("node-pty");
const { WxPusher, Message } = require("wxpusher");
const os = require("os");
let AdmZip = require("adm-zip");
const fsExtra = require("fs-extra");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
let isDistinct = 1
let sleep = (time) => new Promise((r) => setTimeout(r, time));

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
function nodeEnvBind(termMap) {
  //绑定当前系统 node 环境
  const shell = os.platform() === "win32" ? "powershell.exe" : "bash";

  const term = pty.spawn(shell, [], {
    name: "xterm-color",
    cols: 80,
    rows: 24,
    cwd: path.resolve(__dirname, "../xiudongPupp"),
    env: process.env,
  });
  termMap.set(term.pid, term);
  return term;
}

let waitUntilSuccess = (fn, times0 = 20, sleepTime = 5000) => {
  return async function (...args) {
    let times = times0;
    while (times) {
      try {
        let res = await fn.call(this, ...args);
        times = 0;
        return res;
      } catch (e) {
        if(sleepTime){
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
let getTime = (date) => {
  if (!date) {
    date = new Date();
  }
  let hour = date.getHours();
  let minute = date.getMinutes();
  let second = date.getSeconds();
  let millisecond = date.getMilliseconds();

  return `${formatNumber(hour)}:${formatNumber(minute)}:${formatNumber(
    second
  )}.${millisecond}`;
};

let random = () =>
  String(Math.floor(Math.random() * 10000000000000000000)).padStart(10, "0");


let getDouyaIp = async(platform,usingIp)=>{
  let getIp = async () => {
    let { data } = await axios(
      `https://api.douyadaili.com/proxy/?service=GetUnl&authkey=wLBiTQSHE5opEXokzDwZ&num=${1}&format=json&distinct=${isDistinct}&detail=1&portlen=4`
    );
    console.log(data)
    if(data.msg.includes('资源不足')){
      isDistinct = 0
    }
    let ip = data.data[0].ip + ":" + data.data[0].port;
    if (usingIp[platform].includes(ip)) {
      throw new Error("重复");
    }
    return ip;
  };
  let newFn = waitUntilSuccess(getIp, 5, 1000);
  let realIp = await newFn();
  return realIp
}  
module.exports = {
  zipConfig,
  removeConfig,
  readFile,
  writeFile,
  nodeEnvBind,
  sendMsgForCustomer,
  waitUntilSuccess,
  random,
  getTime,
  getDouyaIp
};
