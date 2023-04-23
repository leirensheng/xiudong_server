const shell = require('shelljs');

module.exports = (str, cb) =>{
  let val = 'cd ../xiudongPupp &&' + str;
  var child = shell.exec(val, {async: true, silent: true});
  if (cb) {
    child.stdout.on('data', cb);
    child.stderr.on('data', cb);
    child.stdout.on('end', () => {
      cb('done');
    });
  }
  child.close = () => {
    cmd('taskkill /T /F /PID ' + child.pid);
  };
  return child;
}
