const fs = require('fs');
const path = require('path');

const callerPath = process.cwd();
const exePath = path.join(callerPath, "replaceParallel.exe");
fs.access(exePath, fs.constants.F_OK, (err) => {
  if (err) {
    console.error('replaceParallel.exe 不存在');
    return;
  }
  const childProcess = require('child_process');
  const child = childProcess.spawn(exePath, ['-d', 'dist', '-s', '__uno', '-r', 'uno', '-c', '-n']);
  child.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
    fs.appendFileSync(path.join(callerPath, 'output.log'), data);
  });
  child.stderr.on('data', (data) => {
    console.error("Check the ErrorOutput.log file for more information.");
    fs.appendFileSync(path.join(callerPath, 'ErrorOutput.log'), data);
  });
});