const crypto = require("crypto");
const fetch = require("node-fetch");
const findChrome = require("./node_modules/carlo/lib/find_chrome");
let {
  sendAppMsg,
  sleep,
  myClick,
  waitUntilSuccess,
  getTime,
} = require("./utils");
let slideDetail = require("./slideDetail");

class Main {
  constructor() {
    this.cookie = "";
    this.token = "";
    this.isRunning = false;
  }
  waitUntilOk = async (eventBus) => {
    if (this.isRunning) {
      await new Promise((r) => {
        eventBus.once("runningDone", r);
      });
      await sleep(0);
      if (this.isRunning) {
        return this.waitUntilOk(eventBus);
      }
    }
  };
  getSign(data, t, token = "undefined") {
    const text = `${token}&${t}&12574478&${JSON.stringify(data)}`;
    const md5 = crypto.createHash("md5");
    md5.update(text, "utf8");
    const result = md5.digest("hex");
    return result;
  }

  async slide(url) {
    let findChromePath = await findChrome({});
    let executablePath = findChromePath.executablePath;
    let userDataDir = path.resolve(
      __dirname,
      "../damai/userData",
      user,
      "data"
    );

    let args = [
      "--start-fullscreen",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-extensions",
      "--disable-blink-features=AutomationControlled",
      "--start-maximized",
    ];

    let browser = await puppeteer.launch({
      executablePath,
      ignoreDefaultArgs: ["--enable-automation"],
      headless: false,
      userDataDir,
      args,
      defaultViewport: { width: 1366, height: 768 },
    });

    let { pid } = browser.process();
    let newPage = await browser.newPage();
    await newPage.goto(url);

    let title = randomVal(1, 900) + "need to slide and restart";

    await newPage.evaluate((title) => {
      document.title = title;
    }, title);

    await new Promise(async (resolve, reject) => {
      let timer = setTimeout(async () => {
        sendAppMsg("出错", "自动滑动验证失败, 请手动滑动并启动" + user, {
          type: "error",
        });
        stopExe();
        reject();
        await browser.close();
      }, 15000);

      sendAppMsg("提醒", user + "需要滑动验证", { type: "info" });
      await runExe(pid, "a.exe", title);
      clearTimeout(timer);
      sendAppMsg("提醒", user + "自动验证码Ok", { type: "info" });
      await browser.close();
      resolve();
    });
  }
  getToken(cookie) {
    let v1 = cookie.match(/_m_h5_tk_enc=(.*?);/)[1];
    let v2 = cookie.match(/_m_h5_tk=(.*?);/)[1];
    cookie = `_m_h5_tk_enc=${v1};_m_h5_tk=${v2};`;

    let token = v2.split("_")[0];
    this.token = token;
    this.cookie = cookie;
  }

  async getMobileCookieAndToken(activityId, isWx) {
    // todo:微信的
    let fn = async () => {
      let t = Date.now();
      let data = {
        itemId: activityId,
        platform: "8",
        comboChannel: "2",
        dmChannel: "damai@damaih5_h5",
      };
      let sign = this.getSign(data, t);
      let agent;
      let res = await fetch(
        `https://mtop.damai.cn/h5/mtop.alibaba.damai.detail.getdetail/1.2/?jsv=2.7.2&appKey=12574478&t=${t}&sign=${sign}&api=mtop.alibaba.damai.detail.getdetail&v=1.2&H5Request=true&type=originaljson&timeout=10000&dataType=json&valueType=original&forceAntiCreep=true&AntiCreep=true&useH5=true&data=${encodeURIComponent(
          JSON.stringify(data)
        )}`,
        {
          agent,
          headers: {
            accept: "application/json",
            "accept-language": "zh-CN,zh;q=0.9",
            "cache-control": "no-cache",
            "content-type": "application/x-www-form-urlencoded",
            pragma: "no-cache",
            "sec-ch-ua":
              '"Chromium";v="118", "Microsoft Edge";v="118", "Not=A?Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",

            Referer: "https://m.damai.cn/",
            "Referrer-Policy": "strict-origin-when-cross-origin",
          },
          body: null,
          method: "GET",
        }
      );

      let cookie = res.headers.get("Set-Cookie");
      this.getToken(cookie);
    };
    let res;
    try {
      res = await fn();
    } catch (e) {
      fn = waitUntilSuccess(fn, 5, 0);
      res = await fn(true);
    }
    return res;
  }
  async getMobileDetail(
    activityId,
    dataId,
    eventBus,
    setIsSlideRunning,
    waitUntilSlideOk
  ) {
    if (this.isRunning) {
      await this.waitUntilOk(eventBus);
    }
    this.isRunning = true;

    let isWx = [
      746552023427, 747189662387, 747510019489, 752523428569, 743801673038,
    ].includes(Number(activityId));

    if (!this.cookie) {
      await this.getMobileCookieAndToken(activityId);
      console.log("获取cookie和token完成");
    }

    let t = String(Date.now());
    let data = {
      // dataId,
      itemId: activityId,
      bizCode: "ali.china.damai",
      scenario: "itemsku",
      exParams: JSON.stringify({ dataType: 2, dataId, privilegeActId: "" }),
      platform: "8",
      comboChannel: "2",
      dmChannel: isWx ? "damai@weixin_gzh" : "damai@damaih5_h5",
    };
    let sign = this.getSign(data, t, this.token);
    let url = `https://mtop.damai.cn/h5/mtop.alibaba.detail.subpage.getdetail/2.0/?jsv=2.7.2&appKey=12574478&t=${t}&sign=${sign}&api=mtop.alibaba.detail.subpage.getdetail&v=2.0&H5Request=true&type=originaljson&timeout=10000&dataType=json&valueType=original&forceAntiCreep=true&AntiCreep=true&useH5=true&data=${encodeURIComponent(
      JSON.stringify(data)
    )}`;

    let result = {};
    try {
      let getOneTime = async () => {
        let headers = {
          accept: "application/json",
          "accept-language": "zh-CN,zh;q=0.9",
          "cache-control": "no-cache",
          "content-type": "application/x-www-form-urlencoded",
          pragma: "no-cache",
          "sec-ch-ua": '""',
          "sec-ch-ua-mobile": "?1",
          "sec-ch-ua-platform": '""',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site",
          Referer: "https://m.damai.cn/",
          "Referrer-Policy": "strict-origin-when-cross-origin",
          "content-type": "application/x-www-form-urlencoded",
          pragma: "no-cache",
          Cookie: this.cookie,
          "User-Agent": isWx
            ? `Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.${Math.random()}.138 Safari/${Math.random()}.36 NetType/WIFI MicroMessenger/7.0.20.${Math.random()}(0x6700143B) WindowsWechat(0x6305002e)`
            : `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gbckko${Math.random()}) Chrome/118.0.0.0 Safari/537.36 Edg/118.0.2088.76`,

          Referer: "https://m.damai.cn/",
        };
        let res = await fetch(url, {
          headers,
          timeout: 1500,
          body: null,
          method: "GET",
        });

        res = await res.json();
        if (res.ret && res.ret.some((one) => one.includes("挤爆"))) {
          console.log("挤爆");
          let slideUrl = res.data.url;
          console.log(slideUrl);
          await waitUntilSlideOk();
          setIsSlideRunning(true);
          try {
            let cookie = await slideDetail(slideUrl);
            setIsSlideRunning(false);

            console.log(cookie);
            this.cookie = this.cookie + cookie;
            return await getOneTime();
          } catch (e) {
            throw e;
          }
        } else if (res.ret.some((one) => one.includes("令牌过期"))) {
          this.cookie = "";
          this.token = "";
          return await getMobileDetail(
            activityId,
            dataId,
            eventBus,
            setIsSlideRunning,
            waitUntilSlideOk
          );
        } else if (res.ret[0].includes("成功")) {
          return JSON.parse(res.data.result);
        } else {
          sendAppMsg("提示", "滑动服务返回信息异常" + JSON.stringify(res), {
            type: "error",
          });
          throw new Error("滑动服务返回信息异常" + JSON.stringify(res));
        }

      };
      result = await getOneTime();
    } catch (e) {
      console.log(e);
      return {};
    }
    this.isRunning = false;
    eventBus.emit("runningDone", true);
    console.log("获取完成");

    return result;
  }
}

let obj = new Main();
obj.getMobileDetail.bind(obj);
module.exports = async (...args) => {
  let res = await obj.getMobileDetail(...args);
  return res;
};

// (async () => {
//   await obj.getMobileDetail(729843682819, 211410839);
//   await obj.getMobileDetail(729843682819, 211410839);
//   await obj.getMobileDetail(729843682819, 211410839);
// })();
