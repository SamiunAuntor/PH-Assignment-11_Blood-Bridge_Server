import fs from "fs";

const json = fs.readFileSync("./bloodbridge-firebase-adminsdk.json", "utf-8");
const singleLine = JSON.stringify(JSON.parse(json));
console.log(singleLine);
