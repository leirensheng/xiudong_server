let cmd = require("./cmd");

let start = async () => {
  await cmd({
    cmd: "npm run start fuyu",
    successStr: "信息获取完成",
    failStr: "自动输入验证码错误",
    isSuccessStop: false,
  });
  console.log("执行成功了");
};
start();
