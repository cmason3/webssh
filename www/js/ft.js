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
          let obj = JSON.parse(xHR.responseText);
          document.getElementById("progress").innerHTML = "100%";
          document.getElementById("url").innerHTML = '<a href="' + obj.url + '">' + obj.url + '</a>';
        }
        else {
          document.getElementById("progress").innerHTML = '<span class="text-danger">HTTP ' + xHR.status + '</span>';
        }
      });

      xHR.addEventListener("error", () => {
        document.getElementById("progress").innerHTML = '<span class="text-danger">Unknown Error</span>';
      });

      document.getElementById("progress").innerHTML = "0%";
      document.getElementById("url").innerHTML = "&nbsp;";

      xHR.open("PUT", "/ft/" + files[0].name)
      xHR.send(files[0])
    }
    else {
      document.getElementById("progress").innerHTML = "&nbsp;";
      document.getElementById("url").innerHTML = "&nbsp;";
    }
  });
})();
