const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('sample.pdf');

pdf(dataBuffer).then(function(data) {
    console.log("SUCCESS:", data.text);
}).catch(function(err){
    console.log("ERROR:", err);
});
