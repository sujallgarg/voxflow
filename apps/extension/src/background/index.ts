console.log("VoxFlow background service started");

chrome.runtime.onInstalled.addListener(() => {
  console.log("VoxFlow extension installed");
});