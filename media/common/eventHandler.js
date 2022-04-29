const vscode = acquireVsCodeApi();

document.addEventListener("DOMContentLoaded", function () {
  document.body.addEventListener(
    "click",
    function (e) {
      if (e.target.dataset.command) {
        var msg = Object.assign({}, e.target.dataset);
        vscode.postMessage(msg);
      }
    },
    false
  );
});
