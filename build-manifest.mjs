import fs from "node:fs";
import path from "node:path";
import { program } from "commander";

const srcFolder = "src";
const targetFolder = "build";

program.option("-n, --name <name>");
program.parse();

const options = program.opts();

const name = options.name;

const commonManifestPath = path.join(".", srcFolder, "manifest.common.json");
const commonManifest = JSON.parse(fs.readFileSync(commonManifestPath, "utf8"));

const customManifestPath = path.join(".", srcFolder, `manifest.${name}.json`);
let customManifest = {};

if (fs.existsSync(customManifestPath)) {
  customManifest = JSON.parse(fs.readFileSync(customManifestPath, "utf8"));
} else {
  console.log(
    "File " + customManifestPath + " not found. Only use common data"
  );
}

const finalManifest = { ...commonManifest, ...customManifest };

const targetFileName = path.join(".", targetFolder, "manifest.json");
fs.writeFileSync(targetFileName, JSON.stringify(finalManifest, null, 2));
console.log("Build manifest.json done for " + name);
