'use strict';
// The release manifest is local audit metadata, never a credential.
const fs = require('node:fs');
const { main } = require('./real-case-round3');
if (require.main === module) {
  const [manifestFile,...args]=process.argv.slice(2);
  const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  if (!manifest.commit || !manifest.policy || !manifest.hashes) throw new Error('Incomplete release manifest');
  main({args,outputDirectory:'audits/real-cases/2026-10-06-round5',releaseCommit:manifest.commit,
    expectedPolicy:manifest.policy,expectedHashes:args[0]==='report' ? manifest.localHashes : manifest.hashes})
    .catch(error=>{console.error(error.message);process.exitCode=1;});
}
