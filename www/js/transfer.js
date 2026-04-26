(() => {
  window.addEventListener("load", (e) => {
    document.getElementById("upload").addEventListener("change", (e) => {
      const xHR = new XMLHttpRequest();

      xHR.upload.addEventListener("loadstart", (e) => {
        document.getElementById("up").value = 0;
      });
      xHR.upload.addEventListener("progress", (e) => {
        document.getElementById("up").value = e.loaded;
      });
      xHR.upload.addEventListener("loadend", (e) => {
        document.getElementById("up").value = 100;
      });

      xHR.addEventListener("error", (e) => {
        alert("Error");
      }); 
      xHR.addEventListener("load", (e) => {
        if (xHR.status == 200) {
          alert(xHR.responseText);
        }
      });

      xHR.open("PUT", "transfer");
      xHR.send(e.target.files[0]);
    });
  });
})();
