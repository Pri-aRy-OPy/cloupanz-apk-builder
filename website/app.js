const API_BASE = ""; // Jika API beda domain, isi URL API tanpa slash.

const $ = id => document.getElementById(id);
const zip = $("zip"), logo = $("logo"), drop = $("drop");
let logoData = null;

zip.onchange = () => {
  const f = zip.files[0];
  if(f){$("zipTitle").textContent=f.name;$("zipInfo").textContent=(f.size/1024/1024).toFixed(2)+" MB"; }
};
logo.onchange = () => {
  const f=logo.files[0]; if(!f)return;
  $("logoInfo").textContent=f.name;
  const r=new FileReader(); r.onload=()=>{logoData=r.result;$("preview").innerHTML=`<img src="${logoData}">`}; r.readAsDataURL(f);
};
drop.ondragover=e=>{e.preventDefault();drop.style.borderColor="#6d7cff"};
drop.ondrop=e=>{e.preventDefault();zip.files=e.dataTransfer.files;zip.onchange()};

function setStatus(text,pct,log){
  $("status").classList.remove("hidden");$("statusText").textContent=text;$("percent").textContent=pct+"%";$("bar").style.width=pct+"%";$("log").textContent=log||"";
}

$("build").onclick=async()=>{
  const f=zip.files[0];
  if(!f)return alert("Pilih ZIP project dulu.");
  if(!f.name.toLowerCase().endsWith(".zip"))return alert("File harus ZIP.");
  const name=$("appName").value.trim()||"Cloupanz App";
  const pkg=$("packageName").value.trim()||"com.cloupanz.app";
  $("build").disabled=true; setStatus("Mengupload project...",10,"Mengirim project ke builder...");
  try{
    const fd=new FormData();
    fd.append("project",f); fd.append("appName",name); fd.append("packageName",pkg);
    if(logo.files[0]) fd.append("logo",logo.files[0]);
    const r=await fetch(API_BASE+"/api/build",{method:"POST",body:fd});
    const d=await r.json(); if(!r.ok)throw new Error(d.error||"Build gagal");
    poll(d.runId);
  }catch(e){setStatus("Build gagal",0,e.message);$("build").disabled=false}
};

async function poll(runId){
  const timer=setInterval(async()=>{
    try{
      const r=await fetch(API_BASE+"/api/status?runId="+encodeURIComponent(runId));const d=await r.json();
      setStatus(d.statusText||"Building...",d.progress||30,d.log||"");
      if(d.status==="success"){clearInterval(timer);$("download").href=d.downloadUrl;$("download").classList.remove("hidden");$("build").disabled=false;setStatus("Build berhasil",100,d.log||"APK siap didownload.");}
      if(d.status==="failure"){clearInterval(timer);$("build").disabled=false;setStatus("Build gagal",0,d.log||"Lihat log GitHub Actions.");}
    }catch(e){clearInterval(timer);$("build").disabled=false;setStatus("Gagal cek status",0,e.message)}
  },4000);
}