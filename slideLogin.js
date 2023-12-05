const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer-core");
const { runExe, stopExe } = require("./runExe");
const { sleep, sendAppMsg, randomVal } = require("./utils");

let slideLogin = async ({ user, browserWSEndpoint, pid, url }) => {
  const browser = await puppeteer.connect({ browserWSEndpoint });
  let pages = await browser.pages();
  let promises = pages.map(async (page) => {
    return await page.evaluate(() => document.title);
  });

  let res = await Promise.all(promises);
  let targetIndex = res.findIndex((one) => one !== "");
  let page = pages[targetIndex];

  await page.setViewport({ width: 375, height: 896 });
  let title = randomVal(1, 900) + "need to slide";
  await page.evaluate((title) => {
    document.title = title;
  }, title);
  // 等待页面正常
  await sleep(500);
  await new Promise(async (resolve, reject) => {
    sendAppMsg("提醒", user + "登录需要滑动验证", { type: "info" });
    let p1 = runExe(pid, "slideLogin.exe", title);
    let p2 = sleep(10000);

    let res = await Promise.race([p1, p2]);
    if (!res) {
      stopExe();
      sendAppMsg("出错", "自动滑动验证失败, 请手动滑动并启动" + user, {
        type: "error",
      });
    } else {
      sendAppMsg("提醒", user + "自动验证码Ok", { type: "info" });
    }
    await browser.disconnect();
    resolve();
  });
};

module.exports = slideLogin;
