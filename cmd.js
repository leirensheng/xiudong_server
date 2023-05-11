const { exec } = require("child_process");
const path = require("path");
let execCmd = ({ cmd, successStr, failStr, isSuccessStop }) =>
  new Promise((resolve, reject) => {
    let data = "";
    let child = exec(cmd, { cwd: path.resolve(__dirname, "../xiudongPupp") });

    child.stdout.on("data", (cur) => {
      console.log(cur);
      data += cur;
      if (data.includes(failStr)) {
        reject();
      } else if (data.includes(successStr)) {
        resolve();
        if (isSuccessStop) {
          execCmd("taskkill /T /F /PID " + child.pid);
        }
      }
    });
    child.stdout.on("end", (cur) => {
      resolve()
    });
  });

module.exports = execCmd;
