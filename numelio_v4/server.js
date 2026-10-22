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
    let text="";
    let visualSource=null;
    if(req.file){
      path=req.file.path;
      const fileBuffer=fs.readFileSync(path);
      const filename=req.file.originalname.toLowerCase();
      if(req.file.mimetype==="application/pdf" || filename.endsWith(".pdf")){
        const data=await pdfParse(fileBuffer);
        text=(data.text||"").replace(/\\s+/g," ").trim();
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
    text=text.replace(/\\s+/g," ").trim();
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
    const msg=await client.messages.create({model:"claude-sonnet-5-5",max_tokens:6000,messages:[{role:"user",content:messageContent}]});
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
    const msg=await client.messages.create({model:"claude-sonnet-5-5",max_tokens:5000,messages:[{role:"user",content:prompt}]});
    const raw=msg.content?.find(x=>x.type==="text")?.text||"";
    res.json(JSON.parse(cleanJson(raw)));
  }catch(err){
    console.error(err); res.status(500).json({error:"No se pudo corregir el examen."});
  }
});

app.listen(process.env.PORT||3000,()=>console.log(`Numelio en http://localhost:${process.env.PORT||3000}`));
