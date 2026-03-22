const fs = require('fs');
const path = require('path');

const callerPath = process.cwd();
const exePath = path.join(callerPath, "replace.exe");
const distPath = path.join(callerPath, "dist");

fs.access(exePath, fs.constants.F_OK, (err) => {
  if (err) {
    console.error('replace.exe 不存在');
    return;
  }
  const childProcess = require('child_process');
  const child = childProcess.spawn(exePath, ['-d', 'dist', '-s', '__uno', '-r', 'uno', '-c', '-n']);
  child.stdout.on('data', (data) => {
    console.log(`${data}`);
    fs.appendFileSync(path.join(callerPath, 'output.log'), data);
  });
  child.stderr.on('data', (data) => {
    console.error("Check the ErrorOutput.log file for more information.");
    fs.appendFileSync(path.join(callerPath, 'ErrorOutput.log'), data);
  });

  child.on('close', (code) => {
    const unoFiles = ['__uno.css', '__uno.js'];
    unoFiles.forEach(file => {
      const filePath = path.join(distPath, file);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`已删除残留文件: ${file}`);
        } catch (err) {
          console.error(`删除文件失败: ${file}`, err);
        }
      }
    });
  });
});