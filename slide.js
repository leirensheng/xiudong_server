const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer-core");
const { runExe, stopExe } = require("./runExe");
const { sleep, sendAppMsg, randomVal } = require("./utils");
const findChrome = require("./node_modules/carlo/lib/find_chrome");
let slide = async ({ user, url }) => {
  let findChromePath = await findChrome({});
  let executablePath = findChromePath.executablePath;
  let userDataDir = path.resolve(__dirname, "../damai/userData", user, "data");

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
      await browser.close();
      reject();
    }, 15000);

    sendAppMsg("提醒", user + "需要滑动验证", { type: "info" });
    await runExe(pid, "a.exe", title);
    clearTimeout(timer);
    sendAppMsg("提醒", user + "自动验证码Ok", { type: "info" });
    await browser.close();
    resolve();
  });
};

module.exports = slide;
