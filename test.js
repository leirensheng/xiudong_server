const eventEmitter = require("events");
const eventBus = new eventEmitter();
let isSliding = false;
let { sleep } = require("./utils");

let setSlidingFalse = () => {
  isSliding = false;
  eventBus.emit("test");
};

let doSome = async () => {
  console.log("开始进行", isSliding);
  isSliding = true;
  console.log("设置了true");
  await sleep(4000);
  setSlidingFalse();
};

let waitOk = async () => {
  if (isSliding) {
    await new Promise((r) => {
      eventBus.once("test", r);
    });
    await sleep(0);
    if (isSliding) {
      return waitOk();
    }
  }
};

let slide = async () => {
  await waitOk();
  console.group('一次任务');
  await doSome();
  console.groupEnd('一次任务');
};

slide();

setTimeout(() => {
  slide();
  slide();
  slide();
  slide();
  slide();
  slide();
  slide();
  slide();
  slide();
  slide();
}, 1000);
