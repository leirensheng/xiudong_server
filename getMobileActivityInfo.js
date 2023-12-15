let path = require("path");
const findChrome = require("carlo/lib/find_chrome");
let puppeteer = require("puppeteer-core");
let { sendAppMsg, sleep, myClick, getTime } = require("./utils");
const { intercept, patterns } = require("puppeteer-interceptor");
let random = (min, max) => Math.floor(Math.random() * (max - min)) + min;
const { runExe, stopExe } = require("./runExe");
let dir = path.resolve(__dirname, "mobileBrowser");
const fsExtra = require('fs-extra')

let pid;
let openPage = async (userDataDir, isHeadless) => {
  let findChromePath = await findChrome({});
  let executablePath = findChromePath.executablePath;

  let args = [
    "--start-fullscreen",
    "--disable-gpu", // disable掉，比如GPU、Sandbox、插件等，减少内存的使用和相关计算
    "--disable-dev-shm-usage", // 禁止使用 /dev/shm 共享内存 (Chrome 默认使用 /dev/shm 共享内存docker 默认/dev/shm 只有64MB)
    "--disable-accelerated-2d-canvas", // canvas渲染
    // '-–no-first-run', // 跳过第一次运行任务
    "--no-zygote", // 禁止使用合子进程来分叉子进程
    "--no-sandbox",
    "--disable-extensions",
    "--allow-running-insecure-content",
    "--disable-blink-features=AutomationControlled",
    "--disable-web-security", //允许https访问http
  ];

  let option = {
    executablePath,
    ignoreDefaultArgs: ["--enable-automation"],
    headless: isHeadless,
    devtools: true,
    args,
    defaultViewport: { width: 1366, height: 768 },
  };
  if (userDataDir) {
    option.userDataDir = userDataDir;
  }
  let browser = await puppeteer.launch(option);
  let processInfo = browser.process();
  pid = processInfo.pid;
  console.log("更新了pid" + pid);
  const page = await browser.newPage();
  await page.setCacheEnabled(true);
  //   await intercept(page, patterns.Image("*"), {
  //     onInterception: (event, { abort }) => {
  //       abort("Aborted");
  //     },
  //   });
  //   await intercept(page, patterns.Stylesheet("*"), {
  //     onInterception: (event, { abort }) => {
  //       abort("Aborted");
  //     },
  //   });
  let toBlock = [
    // "img.alicdn.com",
    // "wireless.comment.module.get",
    // "wireless.search.projectlis",
    // "baxia",
    // "aplus",
    // "bl.j",
    // "weixin",
    // "byrecommend",
    // "mmstat.com",
  ];

  for (let one of toBlock) {
    await intercept(page, patterns.All(`*${one}*`), {
      onInterception: (event, { abort }) => {
        abort("Aborted");
      },
    });
  }

  // page.on("console", (message) => {
  //   console.log(`【浏览器消息】: ${message.text()}`);
  // });
  let randomValue = random(1, 1000);
  await page.setUserAgent(
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko${randomValue}) Chrome/66.0.3359.${randomValue} Safari/${randomValue}.36`
  );
  return { page, browser };
};

let page;
let browser;
let isRunning = false;

let waitUntilOk = async (eventBus) => {
  if (isRunning) {
    await new Promise((r) => {
      eventBus.once("runningDone", r);
    });
    await sleep(0);
    if (isRunning) {
      return waitUntilOk(eventBus);
    }
  }
};

let slide = async (
  url,
  pid,
  isHeadless,
  waitUntilSlideOk,
  setIsSlideRunning
) => {
  if (isHeadless) {
    throw new Error("需要验证", getTime());
  }

  await waitUntilSlideOk();

  sendAppMsg("提醒", "页面需要滑动验证", { type: "info" });

  console.log("开始滑动", getTime());
  let newPage = await browser.newPage();
  await newPage.goto(url);

  let title = random(0, 100) + "need to slide";
  await newPage.evaluate((title) => {
    document.title = title;
  }, title);

  setIsSlideRunning(true);
  await runExe(pid, "a.exe", title);
  setIsSlideRunning(false);
  console.log("滑动完成", getTime());

  sendAppMsg("提醒", "自动验证码ok", { type: "info" });
  const isConnected = await browser.isConnected();
  if (isConnected) {
    await newPage.close();
  }
};

let getInfo = async (
  activityId,
  dataId,
  eventBus,
  setIsSlideRunning,
  getIsSlideRunning,
  waitUntilSlideOk
) => {
  if (isRunning) {
    await waitUntilOk(eventBus);
  }
  isRunning = true;
  let fn = async (isHeadless) => {
    if (!browser) {
      let res = await openPage(dir, isHeadless);
      page = res.page;
      browser = res.browser;
      const [blankPage] = await browser.pages();
      blankPage.evaluate(() => {
        document.title = "获取票价信息";
      });
    } else {
      page = await browser.newPage();
      // page.on("console", (message) => {
      //   console.log(`【浏览器消息】: ${message.text()}`);
      // });
    }
    // todo:微信检测 固定在文件上
    let isWx = [
      746552023427, 747189662387, 747510019489, 752523428569, 743801673038,
    ].includes(Number(activityId));
    if (isWx) {
      console.log("设置微信的ua");
      await page.setUserAgent(
        `Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36 NetType/WIFI MicroMessenger/7.0.20.1781(0x6700143B) WindowsWechat(0x6305002e)`
      );
    }

    let getFirst = async () =>
      await new Promise(async (resolve, reject) => {

        let interceptInfo = async () => {
          let interceptDetail = await intercept(
            page,
            patterns.XHR("*detail.subpage.getdetail*"),
            {
              onResponseReceived: async ({ request, response }) => {
                try {
                  interceptDetail.disable();
                  let res = JSON.parse(
                    decodeURIComponent(escape(response.body))
                  );
                  if (res.ret[0].includes("成功")) {
                    resolve(JSON.parse(res.data.result));
                  } else if (res.ret.some((one) => one.includes("挤爆"))) {
                    console.log("getFirst挤爆", getTime());
                    await slide(
                      res.data.url,
                      pid,
                      isHeadless,
                      waitUntilSlideOk,
                      setIsSlideRunning
                    );
                    let newRes = await getFirst();
                    resolve(newRes);
                  } else if (res.ret.some((one) => one.includes("令牌过期"))) {
                    console.log("令牌过期");
                    let newRes = await getFirst();
                    resolve(newRes);
                  } else {
                    sendAppMsg(
                      "提示",
                      "滑动服务返回信息异常" + JSON.stringify(res),
                      {
                        type: "error",
                      }
                    );
                    reject(
                      new Error("滑动服务返回信息异常" + JSON.stringify(res))
                    );
                  }
                } catch (e) {
                  console.log(444444444444, e);
                  reject(e);
                  // throw new Error('出错')
                }
                return response;
              },
            }
          );
        };
        interceptInfo();
        try {
          await page.goto(
            "https://m.damai.cn/damai/detail/item.html?itemId=" + activityId
          );

          let p1 = page.waitForSelector(".buy__button");
          let p2 = page.waitForSelector("iframe");

          await Promise.race([p1, p2]);

          let iframeUrl = await page.evaluate(
            () =>
              document.querySelector("iframe") &&
              document.querySelector("iframe").src
          );
          if (iframeUrl) {
            console.log("直接打开的时候就出现iframe", isHeadless);
            await slide(
              iframeUrl,
              pid,
              isHeadless,
              waitUntilSlideOk,
              setIsSlideRunning
            );
            await page.close();
            let newRes = await getFirst();
            resolve(newRes);
          } else {
            setTimeout(() => {
              console.log("getFirst超时")
              reject(new Error("getFirst超时"));
            }, 1500);
            await page.waitForFunction(
              () => {
                return document.querySelector(".buy__button").innerText;
              },
              { timeout: 10000 }
            );

            await myClick(page, ".buy__button");
          }
        } catch (e) {
          if (e.message.includes("需要验证")) {
            reject(e);
          }

          console.log(e);
          let text = await page.evaluate(
            () => document.querySelector("html").innerText
          );
          let iframeUrl = await page.evaluate(
            () =>
              document.querySelector("iframe") &&
              document.querySelector("iframe").src
          );
          if (iframeUrl) {
            console.log("getFirst超时挤爆", getTime());
            try {
              await slide(
                iframeUrl,
                pid,
                isHeadless,
                waitUntilSlideOk,
                setIsSlideRunning
              );
              await page.close();
              let newRes = await getFirst();
              resolve(newRes);
            } catch (e) {
              if (e.message.includes("需要验证")) {
                reject(e);
              } else {
                sendAppMsg("提示", "未知错误123" + JSON.stringify(e.message), {
                  type: "error",
                });
              }
            }
          } else {
            reject(
              new Error(
                `打开页面执行有问题,页面内容:${text},是否有iframe${iframeUrl}`
              )
            );
          }
        }
      });
    let res = await getFirst(!!dataId);
    console.log("getFirst完成", getTime());

    if (!dataId) {
      await page.close();
      return res;
    }

    let getOneDate = async () =>
      await new Promise(async (resolve, reject) => {
        let {
          performCalendar: { performViews },
        } = res;

        let performIds = performViews.map((one) => one.performId);
        let performIdToPerformName = performIds.reduce((prev, cur, index) => {
          prev[cur] = performViews[index].performName;
          return prev;
        }, {});

        let interceptInfo = async () => {
          let interceptDetail = await intercept(
            page,
            patterns.XHR("*detail.subpage.getdetail*"),
            {
              onResponseReceived: async ({ request, response }) => {
                try {
                  interceptDetail.disable();
                  let res = JSON.parse(
                    decodeURIComponent(escape(response.body))
                  );
                  if (res.ret[0].includes("成功")) {
                    resolve(JSON.parse(res.data.result));
                  } else if (res.ret.some((one) => one.includes("挤爆"))) {
                    console.log("getDate挤爆", getTime());
                    await slide(
                      res.data.url,
                      pid,
                      isHeadless,
                      waitUntilSlideOk,
                      setIsSlideRunning
                    );
                    await page.close();
                    let newRes = await fn();
                    resolve(newRes);
                  } else if (res.ret.some((one) => one.includes("令牌过期"))) {
                    console.log("令牌过期");
                    sendAppMsg("提示", "令牌过期" + JSON.stringify(res), {
                      type: "error",
                    });
                    await page.close();
                    let newRes = await fn();
                    resolve(newRes);
                  } else {
                    sendAppMsg(
                      "提示",
                      "滑动服务返回信息异常" + JSON.stringify(res),
                      {
                        type: "error",
                      }
                    );
                    reject(
                      new Error("滑动服务返回信息异常" + JSON.stringify(res))
                    );
                  }
                } catch (e) {
                  console.log(55555555555, e);
                  reject(e);
                }
                return response;
              },
            }
          );
        };

        try {
          await page.waitForSelector(".item-content");
          interceptInfo();
          let type = performIdToPerformName[dataId];

          console.log(type);
          await page.evaluate(async (type) => {
            let doms = [...document.querySelectorAll(".item-content")];
            let sleep = (time) => new Promise((r) => setTimeout(r, time));

            doms.forEach((one) => {
              let dom = one.querySelector(".item-tag-outer");
              dom && (dom.innerHTML = "");
            });

            await sleep(100);
            let names = doms.map((one) => one.innerText.trim());
            console.log(1111, names.join(","));
            let i = names.findIndex((one) =>
              one.replace(/\s/g, "").includes(type.replace(/\s/g, ""))
            );
            doms[i].click();
          }, type);
          console.log("dom 点击了", getTime());
        } catch (e) {
          console.log(e);
          reject("打开页面出错");
        }
      });

    let result = await getOneDate();
    console.log("ggetOneDate完成", getTime());

    page.close();
    return result;
  };
  let res = {};
  console.group("开始获取" + activityId, getTime());
  try {
    let p1 = sleep(60000);
    let p2 = new Promise(async (resolve, reject) => {
      try {
        let res = await fn(true);
        resolve(res);
      } catch (e) {
        if (e && e.message && e.message.includes("需要验证")) {
          await browser.close();
          browser = null;
          console.log("准备打开可视化浏览器", getTime());
          let res = await fn(false);

          await browser.close();
          browser = null;
          console.log("可视化浏览器后返回的结果", getTime());
          resolve(res);
        } else if (e && e.message && e.message.includes("getFirst超时")) {
          await browser.close();
          browser = null;
          await sleep(2000)
          await fsExtra.removeSync(path.resolve(__dirname, "mobileBrowser"));
          await fsExtra.ensureDir(path.resolve(__dirname, "mobileBrowser"));

          console.log('删除了')
          console.log("准备打开可视化浏览器", getTime());
          let res = await fn(false);
          await browser.close();
          browser = null;
          console.log("可视化浏览器后返回的结果", getTime());
          resolve(res);
        } else {
          reject(e);
        }
      }
    });
    let obj = await Promise.race([p1, p2]);
    if (!obj) {
      console.log("超时了呢", getTime());
      sendAppMsg("出错", "获取演出信息超时", { type: "error" });
      stopExe();
      if (browser) {
        await browser.close();
        browser = null;
      }
    } else {
      res = obj;
    }
  } catch (e) {
    console.log(2222222, e);
    if (browser) {
      await browser.close();
      browser = null;
    }
    sendAppMsg("出错", "获取演出信息出错", { type: "error" });
    stopExe();
  }

  isRunning = false;
  eventBus.emit("runningDone", true);
  console.log("获取完成");
  console.groupEnd("开始获取" + activityId);

  return res;
};

module.exports = getInfo;
