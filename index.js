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
const fsExtra = require("fs-extra");
let cmd = require("./cmd");
let getDynv6Ip = require('../xiudongPupp/getDynv6Ip');

let zipConfig = (username) => {
  const file = new AdmZip();
  const dest = path.resolve(__dirname, "../xiudongPupp/userData/", username);
  const zipPath = path.resolve(dest, username + ".zip");
  file.addLocalFolder(dest);
  file.writeZip(zipPath);
  return zipPath;
};

let removeConfig = async (username) => {
  let obj = await readFile("config.json");
  obj = JSON.parse(obj);
  delete obj[username];
  await writeFile("config.json", JSON.stringify(obj, null, 4));

  const dest = path.resolve(__dirname, "../xiudongPupp/userData/", username);
  fsExtra.removeSync(dest);
};
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
const pidToCmd = {};

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
  admzip.extractAllTo(path.resolve(dest, name), true);
  fs.unlinkSync(filePath);
  let obj = await readFile("config.json");
  obj = JSON.parse(obj);
  obj[name] = JSON.parse(config);
  await writeFile("config.json", JSON.stringify(obj, null, 4));

  res.send("ok");
});
app.post("/addInfo", async (req, res) => {
  let { uid, phone, code, activityId } = req.body;
  let cmdStr = `npm run add ${phone} ${activityId} ${phone} true ${code} ${uid}`;
  try{
    await cmd({
      cmd: cmdStr,
      successStr: "信息获取完成",
      failStr: "自动输入验证码错误",
      isSuccessStop: false,
    });
    res.json({
      code:0
    })
  }catch(e){
    res.json({
      code: -1,
      msg:'验证码错误,请重新输入'
    });
  }
});

app.post("/copyUserFile", async (req, res) => {
  let { username: name, host, config } = req.body;
  let { dnsIp } = await readFile("localConfig.json");

  let zipPath = zipConfig(name);

  var localFile = fs.createReadStream(zipPath);
  var formData = new FormData();
  var headers = formData.getHeaders();

  formData.append("file", localFile);
  formData.append("config", JSON.stringify(config));
  formData.append("name", name);

  let send = (ip) => {
    return axios({
      method: "post",
      url: "http://" + ip + ":4000/uploadFile",
      headers: headers,
      data: formData,
      timeout: 20000,
    });
  };

  try {
    if (host.includes("7l235k7324.yicp.fun") && dnsIp) {
      try {
        await send(dnsIp);
      } catch (e) {
        console.log(e);
        await send(host);
      }
    } else {
      await send(host);
    }
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
    delete pidToCmd[pid];
  });
  console.log("清除所有终端");
  res.end();
});

app.get("/close/:pid", (req, res) => {
  const pid = parseInt(req.params.pid);
  const term = termMap.get(pid);
  if (term) {
    try {
      term.kill();
    } catch (e) {
      console.log(e);
    }
    termMap.delete(pid);
    delete pidToCmd[pid];
  }
  console.log("清除pid", pid);
  res.end();
});

app.get("/getAllUserConfig", async (req, res) => {
  let config = await readFile("config.json");
  console.log(111, pidToCmd);
  let obj = { config: JSON.parse(config), pidToCmd };
  res.json(obj);
});

app.get("/downloadConfig", async (req, res) => {
  let { username } = req.query;
  let zipPath = zipConfig(username);
  var localFile = fs.createReadStream(zipPath);

  localFile.pipe(res);
  localFile.on("end", async () => {
    await removeConfig(username);
  });
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
    pidToCmd[pid] = data.trim();
    term.write(data);
  });
  ws.on("close", () => {
    console.log(pid + "关闭连接", Object.keys(term));
    hasClose = true;
  });
});
app.get("/ping", (req, res) => {
  res.json({
    msg:Date.now().toString(),
    code: 0
  });
});


app.get("/getDnsIp", async (req, res) => {
  let ip = await getDynv6Ip()
  res.json({
    data: ip,
    code: 0
  });
});
app.listen(4000, "0.0.0.0");
console.log("server listening 4000");
