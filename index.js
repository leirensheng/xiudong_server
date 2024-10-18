const Koa = require("koa");
const Router = require("koa-router");

const { koaBody } = require("koa-body");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const eventEmitter = require("events");
const AdmZip = require("adm-zip");
let cmd = require("./cmd");
let cmd2 = require("./cmd2");
const websocket = require("koa-easy-ws");
const getDynv6Ip = require("../xiudongPupp/getDynv6Ip");
const eventBus = new eventEmitter();
const fsExtra = require("fs-extra");
eventEmitter.setMaxListeners(0);
const child_process = require("child_process");

const {
  sleep,
  zipConfig,
  removeConfig,
  readFile,
  writeFile,
  sendAppMsg,
  sendMsgForCustomer,
  getDouyaIp,
} = require("./utils");
const { getTime } = require("../xiudongPupp/utils");
let dest = path.resolve("../xiudongPupp/userData");
const agentMap = require("./agentMap.js");
const schedule = require("node-schedule");
let localSocket;
let getLocalSocket = async () => {
  if (localSocket) {
    return localSocket;
  } else {
    return new Promise((r) => {
      eventBus.once("socketReady", () => {
        sendAppMsg("提示", "新方式等待完成获取得到localSocket");
        r(localSocket);
      });
    });
  }
};

let startUserServer = () => {
  cmd2("cd ../damaiUser/toN1 &&  http-server -p 7777");
};

startUserServer();

schedule.scheduleJob("0 0 22 * * *", function () {
  let dir = "C:/Users/leirensheng/AppData/Local/Temp";
  let res = fs.readdirSync(dir);
  res.forEach((one) => {
    fsExtra.remove(path.resolve(dir, one), (err) => {
      if (err) {
        console.log("删除文件失败:" + one);
      }
    });
  });
});
let usingIp = {
  damai: [],
  bili: [],
  xingqiu: [],
  maoyan: [],
  xiudong: [],
};
let notExpiredIp = {
  damai: [],
  bili: [],
  xingqiu: [],
  maoyan: [],
  xiudong: [],
};
let allPlatforms = Object.keys(notExpiredIp);
let msgList = [];
const app = new Koa();
const router = new Router();

app
  .use(async (ctx, next) => {
    await next();
    let ignoreUrls = ["/downloadConfig", "/startUserFromRemote"];
    let noHandle =
      ignoreUrls.some((one) => ctx.request.url.includes(one)) || ctx.ws;
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
  let {
    uid,
    phone,
    activityId,
    username,
    remark,
    nameIndex,
    port,
    isCopy,
    targetTypes,
  } = ctx.request.body;

  let cmdStr = `npm run add ${username} ${isCopy} ${activityId}-${phone}-${uid}-${remark}-${nameIndex}-${port}-${targetTypes.join(
    "_"
  )}`;

  try {
    await cmd({
      cmd: cmdStr,
      failStr: "已经有了",
      isSuccessStop: true,
    });
    ctx.body = {
      code: 0,
    };
    let curSocket = await getLocalSocket();
    curSocket.send(JSON.stringify({ type: "getConfigList" }));
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
    if (host.includes("mticket.ddns.net") && dnsIp) {
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
  let childProcess = child_process.fork("./openMiddleProcess.js");
  let pid = childProcess.pid;
  termMap.set(pid, childProcess);
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

router.get("/restartSlideServer", (ctx, next) => {
  cmd2("pm2 restart slideServer");
  ctx.body = "";
});

router.get("/close/:pid", async (ctx, next) => {
  const pid = parseInt(ctx.params.pid);
  const term = termMap.get(pid);
  let isFromRemote = ctx.query.isFromRemote;
  if (term) {
    try {
      cmd2("taskkill /T /F /PID " + term.pid);
      console.log("终止终端");
      if (isFromRemote) {
        let curSocket = await getLocalSocket();
        curSocket.send(
          JSON.stringify({
            type: "closePid",
            pid,
          })
        );
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
    term.on("message", (data) => {
      if (!hasClose) {
        console.log("发送信息");
        ws.send(data);
      }
    });

    ws.on("message", (data) => {
      console.log("命令", data.toString().trim());
      pidToCmd[pid] = data.toString().trim();
      term.send({ type: "startCmd", cmd: data.toString() });
    });
    ws.on("close", () => {
      console.log(pid + "关闭连接", Object.keys(term));
      hasClose = true;
    });
  }
});

router.get("/electronSocket", async (ctx, next) => {
  if (ctx.ws) {
    localSocket = await ctx.ws();
    eventBus.emit("socketReady");
    localSocket.on("message", (str) => {
      try {
        let { type, data } = JSON.parse(str);
        if (type === "ping") {
          localSocket.send(
            JSON.stringify({
              type: "pong",
            })
          );
        } else {
          console.log("eventBus发出", type);
          eventBus.emit(type, data);
        }
      } catch (e) {
        console.log("parse出错,", e);
      }
    });
    localSocket.on("close", () => {
      console.log("electron关闭连接");
      localSocket = null;
    });
  }
});

router.post("/sendMsgToApp/:uid", (ctx, next) => {
  let uid = ctx.params.uid;
  let ws = uidToWsMap[uid];
  let { msg, phone, type = "ticketSuccess" } = ctx.request.body;
  if (!ws) {
    console.log(uid + "没有socket连接");
    ctx.response.status = 200;
    return;
  }
  ws.send(JSON.stringify({ type, msg, phone }));
  ctx.response.status = 200;
});

router.post("/sendMsgToUser", async (ctx, next) => {
  let { msg, uid } = ctx.request.body;
  await sendMsgForCustomer(msg, uid);
  ctx.response.status = 200;
});

router.get("/socket-app/:uid", async (ctx, next) => {
  if (ctx.ws) {
    let ws = await ctx.ws();
    const uid = ctx.request.params.uid;
    console.log(uid + "连接");
    uidToWsMap[uid] = ws;
    ws.on("message", (data) => {
      console.log("收到信息", data.toString());
      try {
        let { type } = JSON.parse(data);
        if (type === "ping") {
          ws.send(
            JSON.stringify({
              type: "pong",
            })
          );
        }
      } catch (e) {
        console.log(e, "parse 错误");
      }
    });
    ws.on("close", () => {
      console.log(uid + "关闭连接");
      delete uidToWsMap[uid];
      hasClose = true;
    });
  }
});

router.get("/ping", (ctx, next) => {
  ctx.body = Date.now().toString();
});

router.get("/getDnsIp", async (ctx, next) => {
  ctx.body = await getDynv6Ip();
});

router.post("/startUserFromRemote", async (ctx, next) => {
  let promise = new Promise((r) => {
    eventBus.once("startUserDone", r);
  });
  let curSocket = await getLocalSocket();
  curSocket.send(
    JSON.stringify({ type: "startUser", cmd: ctx.request.body.cmd })
  );
  let { isSuccess, msg } = await promise;
  ctx.response.body = {
    code: isSuccess ? 0 : -1,
    msg,
  };
});

router.post("/removeConfig", async (ctx, next) => {
  let { username } = ctx.request.body;
  await removeConfig(username, true);
  let curSocket = await getLocalSocket();
  curSocket.send(JSON.stringify({ type: "getConfigList" }));
  ctx.status = 200;
});

router.post("/toCheck", async (ctx, next) => {
  let { username } = ctx.request.body;
  await cmd({
    cmd: `npm run remove ${username}`,
    successStr: "标记成功",
    failStr: "已经有了",
    isSuccessStop: true,
  });
  await removeConfig(username, true);
  let curSocket = await getLocalSocket();
  curSocket.send(JSON.stringify({ type: "getConfigList" }));
  ctx.status = 200;
});

router.get("/recover", async (ctx) => {
  let curSocket = await getLocalSocket();
  curSocket.send(JSON.stringify({ type: "recover" }));
  let { failCmds } = await new Promise((resolve) => {
    eventBus.once("recoverDone", resolve);
  });
  ctx.body = failCmds;
});

router.post("/editConfig", async (ctx) => {
  const { username, config, isRefresh } = ctx.request.body;
  let obj = await readFile("config.json");
  obj = JSON.parse(obj);
  let oldConfig = obj[username];
  delete config[username];

  if (config.uid) {
    config.uid = config.uid.replace("尊敬的用户，你的UID是：", "");
  }
  obj[username] = { ...oldConfig, ...config };

  if (isRefresh) {
    let arr = ["showTime", "recordTime", "cmd", "typeMap", "activityName"];
    arr.forEach((one) => {
      delete obj[username][one];
    });
    obj[username].typeMap = {};

    obj[username].targetTypes = [];
  }
  await writeFile("config.json", JSON.stringify(obj, null, 4));
  ctx.body = "ok";
});
// 公共服务

router.get("/getValidIp", async (ctx) => {
  let platform = ctx.query.platform;
  let ip;

  let platformsCanUse = allPlatforms.filter((one) => one !== platform);
  let hasIpsPlatform = platformsCanUse.find((one) => notExpiredIp[one].length);
  if (hasIpsPlatform) {
    // 优先从有效期最长的拿？
    console.log(notExpiredIp);
    console.log(
      `=======${hasIpsPlatform}还有的ip数量: ${notExpiredIp[hasIpsPlatform].length}==========================`
    );
    ip = notExpiredIp[hasIpsPlatform].pop();
  } else {
    ip = await getDouyaIp();
    if (!notExpiredIp[platform].includes(ip)) {
      notExpiredIp[platform].push(ip);
      console.count();
      // 确保notExpiredIp至少有7s有效时间
      setTimeout(() => {
        let i = notExpiredIp[platform].indexOf(ip);
        if (i !== -1) {
          notExpiredIp[platform].splice(i, 1);
        }
      }, 53000);
    }
  }
  ctx.body = ip;
});

// 暂时没有用
router.get("/getProxyIp", async (ctx) => {
  let platform = ctx.query.platform;
  let realIp = await getDouyaIp(platform, usingIp);
  usingIp[platform].push(realIp);
  notExpiredIp[platform].push(realIp);

  console.log("在用的ip" + platform, usingIp[platform].length);
  console.count();
  // 确保notExpiredIp至少有7s有效时间
  setTimeout(() => {
    let i = notExpiredIp[platform].indexOf(realIp);
    if (i !== -1) {
      notExpiredIp[platform].splice(i, 1);
    }
  }, 53000);
  ctx.body = realIp;
  // fs.writeFileSync("./usingIp.json", JSON.stringify(usingIp, null, 4));
});
router.get("/removeIp", async (ctx, next) => {
  let { ip, platform } = ctx.query;
  let i = usingIp[platform].indexOf(ip);
  usingIp[platform].splice(i, 1);
  i = notExpiredIp[platform].indexOf(ip);
  if (i !== -1) {
    notExpiredIp[platform].splice(i, 1);
  }
  // console.log(platform + "删除一个");
  ctx.response.status = 200;
});
router.post("/saveAppMsg", async (ctx, next) => {
  let msg = ctx.request.body;
  msgList.unshift(msg);
  ctx.response.status = 200;
});
router.get("/getAllAppMsg", async (ctx, next) => {
  ctx.body = msgList;
});
router.post("/removeAppMsg", async (ctx, next) => {
  let { id } = ctx.request.body;
  let i = msgList.findIndex((one) => one.id === id);
  msgList.splice(i, 1);
  ctx.status = 200;
});

router.get("/removeAllAppMsg", async (ctx, next) => {
  msgList = [];
  ctx.status = 200;
});

router.post("/sendAppMsg", async (ctx, next) => {
  let { title, content, payload } = ctx.request.body;
  // console.log("接受到请求发送app", content);
  await sendAppMsg(title, content, payload);
  ctx.status = 200;
});

router.get("/getAgentMap", async (ctx) => {
  ctx.body = agentMap;
});

app.listen(4000, "0.0.0.0");
console.log("server listening 4000", getTime());
