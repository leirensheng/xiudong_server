let timer = setInterval(() => {}, 5000);
let execCmd = require("./cmd2");
let child;
process.on("message", (msg) => {
  clearInterval(timer);
  let { type, cmd } = msg;
  if (type === "startCmd") {
    child = execCmd(cmd, (val) => {
      process.send(val);
    });
  }
});
