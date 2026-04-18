const fs = require('fs');
let text = fs.readFileSync('src/components/CrimesSection.jsx', 'utf8');

const head = text.substring(0, text.indexOf('return ('));
const tail = text.substring(text.indexOf('function IncidentPopup'));

fs.writeFileSync('src/components/CrimesSection.jsx', head + '__REPLACE_ME__\n\n' + tail);
console.log("Ready for replace!");
