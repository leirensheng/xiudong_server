const express = require("express");
const expressWs = require("express-ws");
const pty = require("node-pty");
const os = require("os");
const multer = require("multer");
const path = require("path");

let dest = path.resolve(__dirname, "../xiudongPupp/userData");
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
app.use(express.static(path.join(__dirname, "public")));

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
app.post("/file", upload.single("file"), (req, res) => {
  console.log(req.file);
  res.send("ok");
});

//服务端初始化
app.get("/terminal", (req, res) => {
  const term = nodeEnvBind();
  let pid = term.pid.toString();
  console.log("新增进程", pid);
  res.send(pid);
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
    term.kill();
    termMap.delete(pid);
  });
});

app.listen(4000, "127.0.0.1");
console.log("server listening 4000");
