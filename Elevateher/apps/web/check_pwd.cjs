const bcrypt = require('bcryptjs'); // or bcrypt
const hash = '$2b$12$jLJdgWiXNEsTytLZz34wyeDk2O4DBD8UaeDbUXbcMsH2vgm.N/6Jy';
async function run() {
  console.log('Comparing password123...', await bcrypt.compare('password123', hash));
}
run();
