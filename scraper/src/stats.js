// Shared counters, read by index.js at the end of a run to write
// output/run-report.json. A module-level object is the simplest way to
// let fetchPage.js record what it did without threading a counter
// through every function call.
module.exports = {
  pagesFetched: 0,
  cacheHits: 0,
};
