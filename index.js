let AdmZip = require("adm-zip");
const express = require("express");
const expressWs = require("express-ws");
const pty = require("node-pty");
const os = require("os");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
let dest = path.resolve("../xiudongPupp/userData");

// let dest = path.resolve("./upload");
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, dest);
    },
    filename: function (req, file, cb) {
      cb(null, decodeURI(file.originalname));
    },
  }),
  fileFilter(req, file, callback) {
    file.originalname = Buffer.from(file.originalname, "latin1").toString(
      "utf8"
    );
    callback(null, true);
  },
});

const app = express();
expressWs(app);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join("./public")));

const termMap = new Map();
const logMap = new Map();

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

function nodeEnvBind() {
  //绑定当前系统 node 环境
  const shell = os.platform() === "win32" ? "bash.exe" : "bash";

  const term = pty.spawn(shell, [], {
    name: "xterm-color",
    cols: 80,
    rows: 24,
    cwd: process.env.HOME,
    env: process.env,
  });
  termMap.set(term.pid, term);
  return term;
}

//解决跨域问题
app.all("*", function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "*");
  next();
});

// 单文件上传接口
app.post("/uploadFile", upload.single("file"), async (req, res) => {
  console.log();
  let { name, config } = req.body;

  let filePath = path.resolve(dest, name + ".zip");
  const admzip = new AdmZip(filePath);
  admzip.extractAllTo(path.resolve(dest, name));
  fs.unlinkSync(filePath);
  let obj = await readFile("config.json");
  obj = JSON.parse(obj);
  obj[name] = JSON.parse(config);
  await writeFile("config.json", JSON.stringify(obj, null, 4));

  res.send("ok");
});
app.post("/copyUserFile", async (req, res) => {
  let { username: name, host, config } = req.body;

  const file = new AdmZip();
  const dest = path.resolve(
    __dirname,
    "../../../../xiudongPupp/userData/",
    name
  );
  const zipPath = path.resolve(dest, name + ".zip");
  file.addLocalFolder(dest);
  file.writeZip(zipPath);

  var localFile = fs.createReadStream(zipPath);
  var formData = new FormData();
  var headers = formData.getHeaders();

  formData.append("file", localFile);
  formData.append("config", JSON.stringify(config));
  formData.append("name", name);

  try {
    await axios({
      method: "post",
      url: "http://" + host + ":4000/uploadFile",
      headers: headers,
      data: formData,
      timeout: 6000,
    });
    res.send("ok");
  } catch (e) {
    res.send(e.message);
  }
  fs.unlinkSync(zipPath);
});

//服务端初始化
app.get("/terminal", (req, res) => {
  const term = nodeEnvBind();
  let pid = term.pid.toString();
  console.log("\r\n新增进程", pid);
  res.send(pid);
  res.end();
});
app.get("/closeAll", (req, res) => {
  termMap.forEach((term, pid) => {
    term && term.kill();
    termMap.delete(pid);
  });
  console.log("清除所有终端");
  res.end();
});

app.get("/close/:pid", (req, res) => {
  const pid = parseInt(req.params.pid);
  const term = termMap.get(pid);
  if (term) {
    term.kill();
    termMap.delete(pid);
  }
  console.log("清除pid", pid);
  res.end();
});

app.ws("/socket/:pid", (ws, req) => {
  const pid = parseInt(req.params.pid);
  const term = termMap.get(pid);
  let hasClose = false;
  term.on("data", (data) => {
    if (!hasClose) {
      console.log("发送信息");
      ws.send(data);
    }
  });

  ws.on("message", (data) => {
    console.log("命令", data.trim());
    term.write(data);
  });
  ws.on("close", () => {
    console.log(pid + "关闭连接", Object.keys(term));
    hasClose = true;
  });
});

app.listen(4000, "0.0.0.0");
console.log("server listening 4000");
