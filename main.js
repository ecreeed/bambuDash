const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Read config.json
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const printers = config.printers;

// Create go2RTC configuration
const go2rtcConfig = {
  streams: {},
  log: {
    level: 'error'
  }
};

// Add streams for each printer
printers.forEach(printer => {
  const rtspUrl = `rtsps://bblp:${printer.accessCode}@${printer.url}:322/streaming/live/1`;
  go2rtcConfig.streams[printer.url] = rtspUrl;
});

// Write go2RTC config to temporary file
const go2rtcConfigPath = path.join(__dirname, 'go2rtc_temp.yaml');
const yamlContent = `streams:
${Object.entries(go2rtcConfig.streams).map(([ip, url]) => `  ${ip}: ${url}`).join('\n')}
log:
  level: error  # default level
`;

fs.writeFileSync(go2rtcConfigPath, yamlContent);
console.log('go2RTC configuration created:');
console.log(yamlContent);

// Start the BambuBoard backend
const bambu = spawn('node', [path.join(__dirname, 'bambuConnection.js')], { stdio: 'inherit' });

// Build and start go2RTC server from source
const go2rtcDir = path.join(__dirname, 'go2rtc-master');
const go2rtcBinary = path.join(go2rtcDir, 'go2rtc');

console.log('Building go2RTC from source...');
const buildProcess = spawn('go', ['build', '-o', go2rtcBinary], { 
  cwd: go2rtcDir,
  stdio: 'inherit' 
});

buildProcess.on('exit', (code) => {
  if (code === 0) {
    console.log('go2RTC built successfully');
    
    // Start go2RTC server with config
    const go2rtc = spawn(go2rtcBinary, ['-config', go2rtcConfigPath], { 
      stdio: 'inherit',
      cwd: go2rtcDir 
    });

    go2rtc.on('exit', code => {
      console.log(`go2RTC server exited with code ${code}`);
      // Clean up temporary config file
      try {
        fs.unlinkSync(go2rtcConfigPath);
      } catch (err) {
        console.error('Error cleaning up go2RTC config file:', err);
      }
    });

    go2rtc.on('error', error => {
      console.error('go2RTC server error:', error);
    });
  } else {
    console.error('Failed to build go2RTC');
  }
});

buildProcess.on('error', error => {
  console.error('Error building go2RTC:', error);
  console.log('Make sure Go is installed and available in your PATH');
});

 