const pty = require("node-pty");
const { WxPusher, Message } = require("wxpusher");
const os = require("os");
let AdmZip = require("adm-zip");
const fsExtra = require("fs-extra");
const path = require("path");
const fs = require("fs");

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
module.exports = {
  zipConfig,
  removeConfig,
  readFile,
  writeFile,
  nodeEnvBind,
  sendMsgForCustomer
};
