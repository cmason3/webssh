(() => {
  document.getElementById("upload").addEventListener("change", () => {
    let files = document.getElementById("upload").files;

    if (files.length > 0) {
      let xHR = new XMLHttpRequest();

      xHR.upload.addEventListener("progress", (e) => {
        document.getElementById("progress").innerHTML = Math.round((e.loaded / e.total) * 100) + "%";
      });

      xHR.addEventListener("load", () => {
        if (xHR.status === 200) {
          document.getElementById("progress").innerHTML = "100%";
          alert(xHR.responseText);
        }
      });

      document.getElementById("progress").innerHTML = "0%";

      xHR.open("PUT", "/ft/" + files[0].name)
      xHR.send(files[0])
    }
    else {
      document.getElementById("progress").innerHTML = "&nbsp;";
    }
  });
})();
