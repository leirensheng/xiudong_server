const iconv = require("iconv-lite");
const { spawn } = require("child_process");
const path = require("path");
let childProcess;
function runExe(pid, exeName, title) {
  const exePath = path.resolve(__dirname, exeName); // exe绝对路径
  const args = [pid, title]; // exe启动参数
  console.log(pid);
  const options = {
    cwd: __dirname, // 设置exe工作路径
  };

  return new Promise((r, reject) => {
    childProcess = spawn(exePath, args, options);
    // 监听子进程的输出
    childProcess.stdout.on("data", (data) => {
      console.log(`stdout: ${iconv.decode(data, "gbk")}`);
    });

    childProcess.stderr.on("data", (data) => {
      console.error(`stderr: ${iconv.decode(data, "gbk")}`);
    });

    // 监听子进程的退出
    childProcess.on("close", (code) => {
      console.log(`子进程退出，退出码 ${code}`);
      if (code === 0) {
        r("ok");
      } else {
        reject();
      }
    });
  });
}
let stopExe = () => {
  childProcess && childProcess.kill();
};
module.exports = {
  stopExe,
  runExe,
};
