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
app.post("/uploadFile", upload.single("file"), (req, res) => {
  console.log(req.query.name);
  let filePath = path.resolve(dest, req.query.name + ".zip");
  const admzip = new AdmZip(filePath);
  admzip.extractAllTo(path.resolve(dest, req.query.name));
  fs.unlinkSync(filePath);
  res.send("ok");
});
app.get("/copyUserFile", async (req, res) => {
  let name = req.query.name;
  let host = req.query.host;

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

  await axios({
    method: "post",
    url: host+":4000/uploadFile?name=" + name,
    headers: headers,
    data: formData,
  });
  fs.unlinkSync(zipPath);
  res.send("ok");
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

  term.on("data", (data) => {
    ws.send(data);
  });

  ws.on("message", (data) => {
    console.log("命令", data.trim());
    term.write(data);
  });
  ws.on("close", () => {
    console.log(pid + "关闭连接");
  });
});

app.listen(4000, "127.0.0.1");
console.log("server listening 4000");
