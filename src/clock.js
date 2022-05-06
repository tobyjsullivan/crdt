// Lamport clock
let clock = 1;

function getTime() {
  const time = clock;
  clock += 1;
  return time;
}

function updateTime(seen) {
  if (seen >= clock) {
    clock = seen + 1;
  }
}

module.exports = {
  getTime,
  updateTime,
};
