import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import pdfParse from "pdf-parse";
import fs from "fs";

const app = express();
const upload = multer({dest:"uploads/", limits:{fileSize:10*1024*1024}});
app.use(cors());
app.use(express.json({limit:"2mb"}));
app.use(express.static("."));

const client = new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY});

function cleanJson(raw){
  return raw.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim();
}

app.post("/api/generate-exam", upload.single("file"), async (req,res)=>{
  let path;
  try{
    if(!req.file) return res.status(400).json({error:"No se ha enviado ningún archivo."});
    path=req.file.path;
    let text="";
    if(req.file.mimetype==="application/pdf" || req.file.originalname.toLowerCase().endsWith(".pdf")){
      const data=await pdfParse(fs.readFileSync(path));
      text=data.text;
    } else text=fs.readFileSync(path,"utf8");
    text=text.replace(/\s+/g," ").trim();
    if(text.length<100) return res.status(400).json({error:"No se ha podido extraer suficiente texto. Si el PDF es escaneado, necesitará OCR."});

    const subject=req.body.subject||"General";
    const difficulty=req.body.difficulty||"Media";
    const count=Math.min(Math.max(Number(req.body.count)||10,1),20);
    const prompt=`Eres el generador de exámenes de Numelio. Crea un examen educativo en español basado EXCLUSIVAMENTE en los apuntes.
Asignatura: ${subject}. Dificultad: ${difficulty}. Preguntas: ${count}.
Combina tipo test (4 opciones) y respuesta corta. Reparte las preguntas por el contenido disponible. No inventes datos externos.
Devuelve SOLO JSON válido: {"title":"...","questions":[{"type":"choice","question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."},{"type":"short","question":"...","answer":"respuesta esperada","explanation":"..."}]}
APUNTES:\n${text.slice(0,120000)}`;
    const msg=await client.messages.create({model:"claude-sonnet-4-5",max_tokens:6000,messages:[{role:"user",content:prompt}]});
    const raw=msg.content?.find(x=>x.type==="text")?.text||"";
    const exam=JSON.parse(cleanJson(raw));
    res.json(exam);
  }catch(err){
    console.error(err);
    res.status(500).json({error:err?.message?.includes("credit")?"La API no tiene crédito disponible. Comprueba tu cuenta de Anthropic.":"No se pudo generar el examen. Comprueba la API key y vuelve a intentarlo."});
  }finally{ if(path) fs.unlink(path,()=>{}); }
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
    const msg=await client.messages.create({model:"claude-sonnet-4-5",max_tokens:5000,messages:[{role:"user",content:prompt}]});
    const raw=msg.content?.find(x=>x.type==="text")?.text||"";
    res.json(JSON.parse(cleanJson(raw)));
  }catch(err){
    console.error(err); res.status(500).json({error:"No se pudo corregir el examen."});
  }
});

app.listen(process.env.PORT||3000,()=>console.log(`Numelio en http://localhost:${process.env.PORT||3000}`));
