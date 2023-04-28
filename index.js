const Koa = require("koa");
const Router = require("koa-router");

const { koaBody } = require("koa-body");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

const AdmZip = require("adm-zip");
let cmd = require("./cmd");
let cmd2 = require("./cmd2");
const websocket = require("koa-easy-ws");
const getDynv6Ip = require("../xiudongPupp/getDynv6Ip");
const {
  zipConfig,
  removeConfig,
  readFile,
  writeFile,
  nodeEnvBind,
} = require("./utils");
let dest = path.resolve("../xiudongPupp/userData");

const app = new Koa();
const router = new Router();
app
  .use(async (ctx, next) => {
    await next();
    let ignoreUrls = ["/downloadConfig"];
    let noHandle = ignoreUrls.some((one) => ctx.request.url.includes(one));
    if (noHandle) {
      return;
    }
    let data = ctx.body;
    if (!ctx.body || ctx.body.code === undefined) {
      ctx.body = {
        code: 0,
        data,
      };
    } else {
      ctx.body = data;
    }
  })
  .use(async (ctx, next) => {
    ctx.set("Access-Control-Allow-Origin", "*");
    ctx.set("Access-Control-Allow-Headers", "Content-Type");
    ctx.set("Access-Control-Allow-Methods", "*");
    await next();
  })
  .use(websocket())
  .use(
    koaBody({
      uploadDir: dest,
      multipart: true,
    })
  )
  .use(router.routes())
  .use(router.allowedMethods());

let uidToWsMap = {};
const termMap = new Map();
const pidToCmd = {};

router.post("/uploadFile", async (ctx, next) => {
  const file = ctx.request.files.file;
  const { name, config } = ctx.request.body;

  const admzip = new AdmZip(file.filepath);
  admzip.extractAllTo(path.resolve(dest, name), true);
  fs.unlinkSync(file.filepath);
  let obj = await readFile("config.json");
  obj = JSON.parse(obj);
  obj[name] = JSON.parse(config);
  await writeFile("config.json", JSON.stringify(obj, null, 4));
  ctx.body = "ok";
});

router.post("/addInfo", async (ctx) => {
  console.log(ctx.req.body, ctx.request.body);
  let { uid, phone, activityId, username } = ctx.request.body;
  let cmdStr = `npm run add ${username} ${activityId} ${phone} true  ${uid}`;
  try {
    await cmd({
      cmd: cmdStr,
      successStr: "需要登",
      failStr: "已经有了",
      isSuccessStop: false,
    });
    ctx.body = {
      code: 0,
    };
  } catch (e) {
    ctx.body = {
      code: -1,
      msg: "nickname重复",
    };
  }
});

router.post("/copyUserFile", async (ctx) => {
  let { username: name, host, config } = ctx.request.body;
  let { dnsIp } = await readFile("localConfig.json");
  console.log(name);
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
    ctx.body = {
      code: 0,
    };
  } catch (e) {
    console.log(e);
    ctx.body = {
      code: -1,
    };
  }
  // fs.unlinkSync(zipPath);
});

//服务端初始化
router.get("/terminal", (ctx, next) => {
  const term = nodeEnvBind(termMap);
  let pid = term.pid.toString();
  console.log("\r\n新增进程", pid);
  ctx.body = pid;
});

router.get("/closeAll", (ctx, next) => {
  termMap.forEach((term, pid) => {
    if (term) {
      cmd2("taskkill /T /F /PID " + term.pid);
    }
    termMap.delete(pid);
    delete pidToCmd[pid];
  });
  console.log("清除所有终端");
  ctx.body = "";
});

router.get("/close/:pid", (ctx, next) => {
  const pid = parseInt(ctx.params.pid);
  const term = termMap.get(pid);
  let isFromRemote = ctx.query.isFromRemote;
  if (term) {
    try {
      cmd2("taskkill /T /F /PID " + term.pid);
      console.log("终止终端");
      if (isFromRemote) {
        localSocket.emit("closePid", pid);
      }
    } catch (e) {
      console.log(e);
    }
    termMap.delete(pid);
    delete pidToCmd[pid];
  }
  console.log("清除pid", pid);
  ctx.body = "";
});

router.get("/getAllUserConfig", async (ctx, next) => {
  let config = await readFile("config.json");
  let obj = { config: JSON.parse(config), pidToCmd };
  ctx.body = obj;
});

router.get("/downloadConfig", async (ctx, next) => {
  let { username } = ctx.query;
  let zipPath = zipConfig(username);
  var localFile = fs.createReadStream(zipPath);
  ctx.body = localFile;
  localFile.on("end", async () => {
    await removeConfig(username);
  });
});

router.get("/socket/:pid", async (ctx, next) => {
  if (ctx.ws) {
    const ws = await ctx.ws();

    const pid = parseInt(ctx.request.params.pid);
    const term = termMap.get(pid);
    let hasClose = false;
    term.on("data", (data) => {
      if (!hasClose) {
        console.log("发送信息");
        ws.send(data);
      }
    });

    ws.on("message", (data) => {
      console.log("命令", data.toString());
      pidToCmd[pid] = data.toString();
      term.write(data.toString());
    });
    ws.on("close", () => {
      console.log(pid + "关闭连接", Object.keys(term));
      hasClose = true;
    });
  }
});

router.post("/sendMsgToApp/:uid", (ctx, next) => {
  let uid = ctx.params.uid;
  let ws = uidToWsMap[uid];
  let { msg, phone } = ctx.request.body;
  console.log(msg);
  if (!ws) {
    console.log(uid + "没有socket连接");
    ctx.response.status = 200;
    return;
  }
  ws.send(JSON.stringify({ type: "ticketSuccess", msg, phone }));
  ctx.response.status = 200;
});

router.get("/socket-app/:uid", async (ctx, next) => {
  const uid = ctx.request.params.uid;
  uidToWsMap[uid] = ctx.websocket;
  ctx.websocket.on("message", (data) => {
    console.log("收到信息", data.trim());
    if (data === "ping") {
      ctx.websocket.send(
        JSON.stringify({
          type: "pong",
        })
      );
    }
  });
  ctx.websocket.on("close", () => {
    console.log(uid + "关闭连接");
    delete uidToWsMap[uid];
    hasClose = true;
  });
});

router.get("/ping", (ctx, next) => {
  ctx.body = Date.now().toString();
});

router.get("/getDnsIp", async (ctx, next) => {
  ctx.body = await getDynv6Ip();
});

router.post("/startUserFromRemote", async (ctx, next) => {
  localSocket.once("startUserDone", (isSuccess) => {
    ctx.response.body = {
      code: isSuccess ? 0 : -1,
    };
  });
  localSocket.emit("startUser", ctx.request.body.cmd);
});

router.post("/removeConfig", async (ctx, next) => {
  let { username } = ctx.request.body;
  await removeConfig(username, true);
  localSocket.emit("getConfigList");
  ctx.response.body = {
    code: 0,
  };
});

// io.on("connection", (socket) => {
//   console.log("已连接electron");
//   localSocket = socket;
// });

app.listen(4000, "0.0.0.0");
console.log("server listening 4000");
