import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import pdfParse from "pdf-parse";
import fs from "fs";
import crypto from "crypto";

const app = express();
const allowedFiles = new Map([
  [".pdf", new Set(["application/pdf"])],
  [".txt", new Set(["text/plain", "application/octet-stream"])],
  [".jpg", new Set(["image/jpeg"])],
  [".jpeg", new Set(["image/jpeg"])],
  [".png", new Set(["image/png"])],
  [".webp", new Set(["image/webp"])]
]);
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
    if (!allowedFiles.has(ext) || !allowedFiles.get(ext).has(file.mimetype)) {
      return cb(new Error("Formato no admitido. Usa PDF, TXT, JPG, PNG o WEBP."));
    }
    cb(null, true);
  }
});
app.use(cors());
app.use(express.json({limit:"2mb"}));
app.use(express.static("."));

const client = new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY});
const DAILY_GENERATION_LIMIT = 10;
const fallbackUsage = new Map();
const sha256 = value => crypto.createHash("sha256").update(String(value)).digest("hex");

async function identifyRequester(req) {
  const auth = req.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  let userId = null;
  if (token && process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY) {
    const response = await fetch(process.env.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", {
      headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY, Authorization: "Bearer " + token }
    });
    if (!response.ok) throw Object.assign(new Error("La sesión no es válida. Inicia sesión de nuevo."), { status: 401 });
    const user = await response.json();
    userId = user.id || null;
  }
  return { userId, ipHash: sha256(req.ip || req.socket?.remoteAddress || "unknown") };
}

async function checkDailyGenerationLimit(req, res) {
  try {
    const identity = await identifyRequester(req);
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const response = await fetch(process.env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/consume_generation_limit", {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ p_user_id: identity.userId, p_ip_hash: identity.ipHash, p_daily_limit: DAILY_GENERATION_LIMIT })
      });
      if (!response.ok) {
        console.error("No se pudo comprobar el límite diario:", await response.text());
        res.status(503).json({ error: "El control de uso no está disponible. Inténtalo más tarde." });
        return false;
      }
      if (await response.json() !== true) {
        res.status(429).json({ error: "Has alcanzado el límite de 10 operaciones de IA al día. Vuelve mañana para seguir estudiando." });
        return false;
      }
      return true;
    }
    const utcDay = new Date().toISOString().slice(0, 10);
    const key = (identity.userId ? "user:" + identity.userId : "ip:" + identity.ipHash) + ":" + utcDay;
    const used = fallbackUsage.get(key) || 0;
    if (used >= DAILY_GENERATION_LIMIT) {
      res.status(429).json({ error: "Has alcanzado el límite de 10 operaciones de IA al día. Vuelve mañana para seguir estudiando." });
      return false;
    }
    fallbackUsage.set(key, used + 1);
    return true;
  } catch (error) {
    res.status(error.status || 503).json({ error: error.status ? error.message : "No se ha podido comprobar tu sesión ni el límite de uso." });
    return false;
  }
}


function cleanJson(raw){
  return raw.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim();
}

app.post("/api/generate-exam", upload.single("file"), async (req,res)=>{
  let path;
  try{
    let text="";
    let visualSource=null;
    if(req.file){
      path=req.file.path;
      const fileBuffer=fs.readFileSync(path);
      const filename=req.file.originalname.toLowerCase();
      if(req.file.mimetype==="application/pdf" || filename.endsWith(".pdf")){
        const data=await pdfParse(fileBuffer);
        text=(data.text||"").replace(/\s+/g," ").trim();
        if(text.length<100){
          visualSource={type:"document",source:{type:"base64",media_type:"application/pdf",data:fileBuffer.toString("base64")}};
        }
      } else if(["image/jpeg","image/png","image/webp","image/gif"].includes(req.file.mimetype)){
        visualSource={type:"image",source:{type:"base64",media_type:req.file.mimetype,data:fileBuffer.toString("base64")}};
      } else if(req.file.mimetype==="text/plain" || filename.endsWith(".txt")){
        text=fileBuffer.toString("utf8");
      } else {
        return res.status(400).json({error:"Formato no admitido. Usa PDF, TXT, JPG, PNG o WEBP."});
      }
    } else if(typeof req.body.notesText==="string"){
      text=req.body.notesText;
    } else {
      return res.status(400).json({error:"No se han enviado apuntes ni un archivo."});
    }
    text=text.replace(/\s+/g," ").trim();
    if(!visualSource && text.length<100) return res.status(400).json({error:"No se ha podido extraer suficiente texto. Si el archivo es una foto o un PDF escaneado, prueba con una imagen más nítida o un PDF con texto legible."});

    const subject=req.body.subject||"General";
    const difficulty=req.body.difficulty||"Media";
    const count=Math.min(Math.max(Number(req.body.count)||10,1),20);
    const prompt=`Eres el generador de exámenes de Numelio. Crea un examen educativo en español basado EXCLUSIVAMENTE en los apuntes.
Asignatura: ${subject}. Dificultad: ${difficulty}. Preguntas: ${count}.
Combina tipo test (4 opciones) y respuesta corta. Reparte las preguntas por el contenido disponible. No inventes datos externos.
Devuelve SOLO JSON válido: {"title":"...","questions":[{"type":"choice","question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."},{"type":"short","question":"...","answer":"respuesta esperada","explanation":"..."}]}
APUNTES:\n${text.slice(0,120000)}`;
    const messageContent = visualSource
      ? [{type:"text",text:"Lee con cuidado el contenido de la imagen o del PDF adjunto. Úsalo como fuente exclusiva para crear el examen. Si alguna parte no se puede leer, no inventes información.\\n"+prompt},visualSource]
      : prompt;
    if (!(await checkDailyGenerationLimit(req,res))) return;
    const msg=await client.messages.create({model:"claude-sonnet-5-5",max_tokens:6000,messages:[{role:"user",content:messageContent}]});
    const raw=msg.content?.find(x=>x.type==="text")?.text||"";
    const exam=JSON.parse(cleanJson(raw));
    res.json(exam);
  }catch(err){
    console.error(err);
    res.status(500).json({error:err?.message?.includes("credit")?"La API no tiene crédito disponible. Comprueba tu cuenta de Anthropic.":"No se pudo generar el examen. Comprueba la API key y vuelve a intentarlo."});
  }finally{ if(path) fs.unlink(path,()=>{}); }
});

app.post("/api/generate-flashcards", upload.single("file"), async (req,res)=>{
  let path;
  try{
    let text="";
    let visualSource=null;
    if(req.file){
      path=req.file.path;
      const buffer=fs.readFileSync(path);
      const filename=req.file.originalname.toLowerCase();
      if(req.file.mimetype==="application/pdf"||filename.endsWith(".pdf")){
        const data=await pdfParse(buffer); text=(data.text||"").replace(/\s+/g," ").trim();
        if(text.length<100) visualSource={type:"document",source:{type:"base64",media_type:"application/pdf",data:buffer.toString("base64")}};
      }else if(["image/jpeg","image/png","image/webp"].includes(req.file.mimetype)){
        visualSource={type:"image",source:{type:"base64",media_type:req.file.mimetype,data:buffer.toString("base64")}};
      }else if(req.file.mimetype==="text/plain"||filename.endsWith(".txt")) text=buffer.toString("utf8");
      else return res.status(400).json({error:"Formato no admitido. Usa PDF, TXT, JPG, PNG o WEBP."});
    }else if(typeof req.body.notesText==="string") text=req.body.notesText;
    else return res.status(400).json({error:"Añade texto o un archivo."});
    text=text.replace(/\s+/g," ").trim();
    if(!visualSource&&text.length<40)return res.status(400).json({error:"No se ha podido leer suficiente texto de los apuntes."});
    const prompt=`Crea entre 8 y 20 flashcards educativas en español basadas exclusivamente en estos apuntes. Preguntas claras y respuestas breves pero útiles. Devuelve SOLO JSON válido con esta forma: {"cards":[{"question":"...","answer":"..."}]}. Asignatura: ${req.body.subject||"General"}. Apuntes: ${text.slice(0,90000)}`;
    const content=visualSource?[{type:"text",text:"Lee la imagen o PDF y crea tarjetas únicamente con información legible. "+prompt},visualSource]:prompt;
    if (!(await checkDailyGenerationLimit(req,res))) return;
    const msg=await client.messages.create({model:"claude-sonnet-5-5",max_tokens:5000,messages:[{role:"user",content}]});
    const result=JSON.parse(cleanJson(msg.content?.find(x=>x.type==="text")?.text||""));
    if(!Array.isArray(result.cards)||!result.cards.length)throw new Error("La IA no ha devuelto tarjetas válidas.");
    res.json({cards:result.cards.slice(0,20)});
  }catch(err){console.error(err);res.status(500).json({error:err?.message?.includes("credit")?"La API no tiene crédito disponible. Comprueba Anthropic.":"No se pudieron generar las tarjetas. Revisa los logs de Render."});}
  finally{if(path)fs.unlink(path,()=>{});}
});


app.post("/api/generate-oral-exam", upload.single("file"), async (req,res)=>{
 let path;
 try{
  let text="", visualSource=null;
  if(req.file){
   path=req.file.path;const buffer=fs.readFileSync(path);const filename=req.file.originalname.toLowerCase();
   if(req.file.mimetype==="application/pdf"||filename.endsWith(".pdf")){const parsed=await pdfParse(buffer);text=(parsed.text||"").replace(/\s+/g," ").trim();if(text.length<100)visualSource={type:"document",source:{type:"base64",media_type:"application/pdf",data:buffer.toString("base64")}};}
   else if(["image/jpeg","image/png","image/webp"].includes(req.file.mimetype))visualSource={type:"image",source:{type:"base64",media_type:req.file.mimetype,data:buffer.toString("base64")}};
   else if(req.file.mimetype==="text/plain"||filename.endsWith(".txt"))text=buffer.toString("utf8");
   else return res.status(400).json({error:"Formato no admitido. Usa PDF, TXT, JPG, PNG o WEBP."});
  } else if(typeof req.body.notesText==="string")text=req.body.notesText;
  else return res.status(400).json({error:"Añade tus apuntes o un archivo."});
  text=text.replace(/\s+/g," ").trim();
  if(!visualSource&&text.length<40)return res.status(400).json({error:"No se ha podido leer suficiente texto de los apuntes."});
  const count=Math.min(Math.max(Number(req.body.count)||5,3),10);
  const prompt=`Prepara un examen oral en español basado EXCLUSIVAMENTE en estos apuntes. Crea ${count} preguntas abiertas, una por una, de dificultad progresiva. Para cada una incluye una respuesta esperada y los conceptos esenciales que debe mencionar el alumno. No uses conocimientos externos ni inventes. Devuelve SOLO JSON válido: {"title":"...","questions":[{"question":"...","expected":"...","keyPoints":["...","..."]}]}. Apuntes: ${text.slice(0,90000)}`;
  const content=visualSource?[{type:"text",text:"Lee el archivo visual y usa solo información legible. "+prompt},visualSource]:prompt;
  if (!(await checkDailyGenerationLimit(req,res))) return;
  const msg=await client.messages.create({model:"claude-sonnet-5-5",max_tokens:4500,messages:[{role:"user",content}]});
  const result=JSON.parse(cleanJson(msg.content?.find(x=>x.type==="text")?.text||""));
  if(!Array.isArray(result.questions)||!result.questions.length)throw new Error("No se han generado preguntas válidas.");
  res.json({title:result.title||"Examen oral",questions:result.questions.slice(0,count)});
 }catch(err){console.error(err);res.status(500).json({error:"No se ha podido crear el examen oral. Revisa los logs de Render y la API de Anthropic."});}
 finally{if(path)fs.unlink(path,()=>{});}
});

app.post("/api/grade-oral-answer", async(req,res)=>{
 try{
  const {question,expected,keyPoints,answer}=req.body||{};
  if(!question||!answer?.trim())return res.status(400).json({error:"Falta la pregunta o tu respuesta."});
  const prompt=`Evalúa en español la respuesta oral transcrita del alumno. Usa EXCLUSIVAMENTE la respuesta esperada y puntos clave derivados de sus apuntes. No penalices el estilo oral ni pequeñas muletillas; evalúa precisión, conceptos y omisiones. Nota de 0 a 10. Devuelve SOLO JSON válido: {"score":7,"feedback":"...","missing":["..."],"modelAnswer":"..."}. Pregunta: ${question}\nRespuesta esperada basada en apuntes: ${expected}\nPuntos clave: ${JSON.stringify(keyPoints||[])}\nRespuesta del alumno: ${answer}`;
  const msg=await client.messages.create({model:"claude-sonnet-5-5",max_tokens:1200,messages:[{role:"user",content:prompt}]});
  res.json(JSON.parse(cleanJson(msg.content?.find(x=>x.type==="text")?.text||"")));
 }catch(err){console.error(err);res.status(500).json({error:"No se ha podido corregir la respuesta oral."});}
});
app.post("/api/grade-exam", async(req,res)=>{
  try{
    const {subject="General", questions=[], answers=[]}=req.body||{};
    if(!questions.length) return res.status(400).json({error:"No hay preguntas para corregir."});
    const prompt=`Eres el corrector de Numelio. Corrige este examen en español.
Asignatura: ${subject}.
Para preguntas tipo test, usa la respuesta indicada en answer (índice). Para respuestas cortas, valora el significado y no exijas que coincida literalmente.
Devuelve SOLO JSON válido: {"score":8.5,"correct":8,"total":10,"summary":"...","results":[{"index":0,"correct":true,"score":1,"feedback":"...","expected":"..."}]}
Examen y respuestas:\n${JSON.stringify(questions)}\nRESPUESTAS DEL ALUMNO:\n${JSON.stringify(answers)}`;
    if (!(await checkDailyGenerationLimit(req,res))) return;
    const msg=await client.messages.create({model:"claude-sonnet-5-5",max_tokens:5000,messages:[{role:"user",content:prompt}]});
    const raw=msg.content?.find(x=>x.type==="text")?.text||"";
    res.json(JSON.parse(cleanJson(raw)));
  }catch(err){
    console.error(err); res.status(500).json({error:"No se pudo corregir el examen."});
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "El archivo supera el límite de 10 MB." });
  }
  if (err) return res.status(err.status || 400).json({ error: err.message || "No se ha podido procesar la solicitud." });
  res.status(500).json({ error: "Error interno del servidor." });
});

app.listen(process.env.PORT||3000,()=>console.log(`Numelio en http://localhost:${process.env.PORT||3000}`));
