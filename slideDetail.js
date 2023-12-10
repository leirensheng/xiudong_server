const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer-core");
const { runExe, stopExe } = require("./runExe");
const { sleep, sendAppMsg, randomVal ,cleanFileAfterClose } = require("./utils");
const findChrome = require("./node_modules/carlo/lib/find_chrome");
let slide = async (url) => {
  let findChromePath = await findChrome({});
  let executablePath = findChromePath.executablePath;
  const { intercept, patterns } = require("puppeteer-interceptor");

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
    args,
    defaultViewport: { width: 1366, height: 768 },
  });
  cleanFileAfterClose(browser)

  let { pid } = browser.process();
  let newPage = await browser.newPage();
  await newPage.goto(url);

  let title = randomVal(1, 900) + "need to slide and restart";

  await newPage.evaluate((title) => {
    document.title = title;
  }, title);

  let cookie=await new Promise(async (resolve, reject) => {
    let interceptOrder
    let timer = setTimeout(async () => {
      sendAppMsg("出错", "自动滑动验证失败, 请手动滑动并启动", {
        type: "error",
      });
      stopExe();
      reject();
      interceptOrder.disable();
      await sleep(0)
      await browser.newClose();
    }, 15000);

    sendAppMsg("提醒", "获取详情需要滑动验证", { type: "info" });

    let cookie = await new Promise(async (r) => {
       interceptOrder = await intercept(
        newPage,
        patterns.XHR("*_____tmd_____/report*"),
        {
          onResponseReceived: async ({ request, response }) => {
            try {
              console.log("拦截到",request.headers.Cookie);
              if (request.headers.Cookie.includes("x5sec")) {
                interceptOrder.disable();
                r(request.headers.Cookie);
              }
            } catch (e) {
              console.log(e);
              console.log(response);
            }
            return response;
          },
        }
      );
      runExe(pid, "a.exe", title);
    });
    clearTimeout(timer);
    sendAppMsg("提醒", "自动验证码Ok", { type: "info" });
    await sleep(0)
    await browser.newClose();
    resolve(cookie);
  });
  return cookie
};

module.exports = slide;
