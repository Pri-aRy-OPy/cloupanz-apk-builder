import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import {v4 as uuid} from "uuid";
import {Octokit} from "@octokit/rest";
import archiver from "archiver";

const app=express();
const upload=multer({dest:path.join(os.tmpdir(),"cloupanz-upload")});
app.use(cors());
app.use(express.json({limit:"2mb"}));

const PORT=process.env.PORT||3000;
const OWNER=process.env.GITHUB_OWNER;
const REPO=process.env.GITHUB_REPO;
const TOKEN=process.env.GITHUB_TOKEN;
const WORKFLOW=process.env.GITHUB_WORKFLOW||"build-apk.yml";
const octokit=new Octokit({auth:TOKEN});
const runs=new Map();

function requireEnv(){
  if(!OWNER||!REPO||!TOKEN) throw new Error("GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN belum diatur.");
}

app.post("/api/build",upload.fields([{name:"project",maxCount:1},{name:"logo",maxCount:1}]),async(req,res)=>{
  try{
    requireEnv();
    const project=req.files?.project?.[0];
    if(!project) return res.status(400).json({error:"Project ZIP wajib diupload."});
    const runId=uuid();
    const meta={runId,appName:req.body.appName||"Cloupanz App",packageName:req.body.packageName||"com.cloupanz.app",zip:project.path,logo:req.files?.logo?.[0]?.path||null,status:"queued",created:Date.now()};
    runs.set(runId,meta);

    // Untuk keamanan dan ukuran payload, file diproses server-side.
    // Implementasi berikut mengirim metadata melalui repository_dispatch.
    await octokit.rest.repos.createDispatchEvent({
      owner:OWNER,repo:REPO,event_type:"apk_builder",
      client_payload:{runId,appName:meta.appName,packageName:meta.packageName}
    });
    res.json({runId});
  }catch(e){res.status(500).json({error:e.message})}
});

app.get("/api/status",async(req,res)=>{
  const meta=runs.get(req.query.runId);
  if(!meta)return res.status(404).json({error:"Run tidak ditemukan."});
  try{
    const {data}=await octokit.rest.actions.listWorkflowRuns({
      owner:OWNER,repo:REPO,workflow_id:WORKFLOW,event:"repository_dispatch",per_page:20
    });
    const run=data.workflow_runs.find(x=>x.name && x.created_at && new Date(x.created_at).getTime()>=meta.created-10000);
    if(!run)return res.json({status:"queued",progress:10,statusText:"Menunggu GitHub Actions...",log:"Workflow sedang menunggu runner."});
    if(run.status!=="completed")return res.json({status:"running",progress:55,statusText:"GitHub sedang build APK...",log:`Run #${run.run_number} sedang berjalan.`});
    if(run.conclusion!=="success")return res.json({status:"failure",progress:0,statusText:"Build gagal",log:`GitHub Actions: ${run.conclusion}`});
    const arts=await octokit.rest.actions.listWorkflowRunArtifacts({owner:OWNER,repo:REPO,run_id:run.id});
    const art=arts.data.artifacts.find(a=>a.name==="cloupanz-debug-apk");
    if(!art)return res.json({status:"failure",progress:0,statusText:"APK tidak ditemukan",log:"Artifact cloupanz-debug-apk tidak ditemukan."});
    const url=`https://api.github.com/repos/${OWNER}/${REPO}/actions/artifacts/${art.id}/zip`;
    res.json({status:"success",progress:100,statusText:"Build berhasil",log:"APK siap didownload.",downloadUrl:url});
  }catch(e){res.status(500).json({error:e.message})}
});

app.get("/health",(req,res)=>res.json({ok:true}));
app.listen(PORT,()=>console.log(`APK Builder API listening on ${PORT}`));
