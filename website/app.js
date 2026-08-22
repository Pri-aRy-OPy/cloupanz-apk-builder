const API_BASE = window.CLoupanz_API || "";

const $ = (id) => document.getElementById(id);
const zip = $("zip");
const logo = $("logo");
const drop = $("drop");
let timer = null;

function setStatus(text, pct, log) {
  $("status").classList.remove("hidden");
  $("statusText").textContent = text;
  $("percent").textContent = `${pct}%`;
  $("bar").style.width = `${pct}%`;
  $("log").textContent = log || "";
}

function setDownload(url) {
  const a = $("download");
  a.href = url;
  a.classList.remove("hidden");
}

zip.onchange = () => {
  const f = zip.files[0];
  if (!f) return;
  $("zipTitle").textContent = f.name;
  $("zipInfo").textContent = `${(f.size / 1024 / 1024).toFixed(2)} MB · ZIP project`;
};

logo.onchange = () => {
  const f = logo.files[0];
  if (!f) return;

  if (f.size > 2 * 1024 * 1024) {
    alert("Logo maksimal 2 MB.");
    logo.value = "";
    return;
  }

  $("logoInfo").textContent = `${f.name} · ${(f.size / 1024).toFixed(0)} KB`;
  const r = new FileReader();
  r.onload = () => {
    $("preview").innerHTML = `<img alt="Logo" src="${r.result}">`;
  };
  r.readAsDataURL(f);
};

drop.ondragover = (e) => {
  e.preventDefault();
  drop.classList.add("drag");
};

drop.ondragleave = () => drop.classList.remove("drag");

drop.ondrop = (e) => {
  e.preventDefault();
  drop.classList.remove("drag");
  if (e.dataTransfer.files?.length) {
    try {
      const dt = new DataTransfer();
      dt.items.add(e.dataTransfer.files[0]);
      zip.files = dt.files;
      zip.onchange();
    } catch {
      alert("Silakan pilih ZIP lewat tombol Pilih ZIP.");
    }
  }
};

function validatePackage(pkg) {
  return /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(pkg);
}

$("build").onclick = async () => {
  const project = zip.files[0];

  if (!project) return alert("Pilih ZIP project dulu.");
  if (!project.name.toLowerCase().endsWith(".zip")) return alert("File harus ZIP.");
  if (project.size > 20 * 1024 * 1024) return alert("ZIP maksimal 20 MB.");

  const name = $("appName").value.trim() || "Cloupanz App";
  const pkg = $("packageName").value.trim() || "com.cloupanz.app";

  if (!validatePackage(pkg)) {
    return alert("Package name tidak valid.\nContoh: com.cloupanz.app");
  }

  if (timer) clearInterval(timer);

  $("build").disabled = true;
  $("download").classList.add("hidden");
  $("workflow").classList.add("hidden");
  setStatus("Mengupload project...", 8, "Mengirim ZIP dan konfigurasi ke server...");

  try {
    const fd = new FormData();
    fd.append("project", project);
    fd.append("appName", name);
    fd.append("packageName", pkg);
    if (logo.files[0]) fd.append("logo", logo.files[0]);

    const response = await fetch(`${API_BASE}/api/build`, {
      method: "POST",
      body: fd
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Upload gagal.");

    setStatus("GitHub Actions dimulai...", 18, data.message);
    poll(data.runId);
  } catch (error) {
    setStatus("Build gagal", 0, error.message);
    $("build").disabled = false;
  }
};

function poll(runId) {
  timer = setInterval(async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/status?runId=${encodeURIComponent(runId)}`
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Gagal cek status.");

      setStatus(
        data.statusText || "Building...",
        Number(data.progress || 25),
        data.log || ""
      );

      if (data.workflowUrl) {
        $("workflow").href = data.workflowUrl;
        $("workflow").classList.remove("hidden");
      }

      if (data.status === "success") {
        clearInterval(timer);
        setDownload(data.downloadUrl);
        $("build").disabled = false;
        setStatus("APK berhasil dibuat!", 100, data.log);
      }

      if (data.status === "failure") {
        clearInterval(timer);
        $("build").disabled = false;
        setStatus("Build gagal", 0, data.log || "Lihat log GitHub Actions.");
      }
    } catch (error) {
      clearInterval(timer);
      $("build").disabled = false;
      setStatus("Gagal cek status", 0, error.message);
    }
  }, 5000);
}
