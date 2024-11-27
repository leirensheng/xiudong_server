let AppID = `24hMFhqeIZ8eX0m1awTBh9`;
let appKey = `mWjoyqUGLt9IkhvyAhwuX5`;
let AppSecret = `GJrIw1V4ac5skDtHLqPrE4`;
let masterSecret = `nP2QpG1xuS9ZOwpQx274Q6`;
let AppName = `uni.UNIB50DDBF`;
let baseUrl = `https://restapi.getui.com/v2/${AppID}`;
let axios = require("axios");
// let { getTime } = require("./utils");

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

// 不能引用utils,循环引用了
const crypto = require("crypto");
let random = () =>
  String(Math.floor(Math.random() * 10000000000000000000)).padStart(10, "0");
const { EventEmitter } = require("events");
class Main extends EventEmitter {
  constructor() {
    super();
    this.token = "";
    this.gettingToken = false;
    this.getToken();
  }
  async getToken() {
    this.gettingToken = true;
    let timestamp = Date.now();
    let body = {
      sign: crypto
        .createHash("SHA256")
        .update(appKey + timestamp + masterSecret)
        .digest("hex"),
      timestamp,
      appkey: appKey,
    };
    let {
      data: {
        data: { token, expire_time },
      },
    } = await axios({
      method: "post",
      url: `${baseUrl}/auth`,
      data: body,
    });
    this.token = token;
    this.expireTime = expire_time;
    this.gettingToken = false;
    console.log("获取token 完成");
    this.emit("tokenReady");
    setTimeout(() => {
      this.getToken();
    }, 3600000);
  }
  async push({ title, body, payload = {} }) {
    if (this.gettingToken) {
      await new Promise((r) => {
        this.once("tokenReady", r);
      });
    }

    payload.id = random();
    payload.msg = `【${getTime("", true)}】${body}`;
    body = body.slice(0, 26);
    body = body.slice(0, 18);
    title = title.slice(0, 49);
    let transmission = {
      // a:555
      // title,
      // content: body,
      payload,
    };
    let data = {
      request_id: random(),
      settings: {
        ttl: 7200000,
      },
      audience: {
        cid: ["79c4b34ac27e1cb6ed900c2a78b7b9ae"],
      },
      push_channel: {
        android: {
          ups: {
            notification: {
              title,
              body,
              click_type: "intent",
              intent: `intent://io.dcloud.unipush/?#Intent;scheme=unipush;launchFlags=0x4000000;component=uni.UNIB50DDBF/io.dcloud.PandoraEntry;S.UP-OL-SU=true;S.title=${title};S.content=${body};S.payload=${JSON.stringify(
                payload
              )};end`,
            },
          },
        },
      },
      push_message: {
        transmission: JSON.stringify(transmission),
      },
    };
    let res = await axios({
      headers: {
        token: this.token,
      },
      method: "post",
      data,
      url: `${baseUrl}/push/single/cid`,
    });

    await axios({
      method: "post",
      data: payload,
      url: `http://127.0.0.1:4000/saveAppMsg`,
    });
    // console.log(res.data);
  }
}

let obj = new Main();

let start = async (title, content, payload) => {
  obj.push({ title, body: content, payload });
};

module.exports = start;
