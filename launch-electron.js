const { spawn } = require('child_process');
const electronPath = require('./node_modules/electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ['.'], { stdio: 'inherit', env });
child.on('close', code => process.exit(code));
