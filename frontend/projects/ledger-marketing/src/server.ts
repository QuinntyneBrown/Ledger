import { AngularNodeAppEngine, createNodeRequestHandler, isMainModule, writeResponseToNodeResponse } from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const browserDistFolder=resolve(dirname(fileURLToPath(import.meta.url)),'../browser');const app=express();const engine=new AngularNodeAppEngine();app.use(express.static(browserDistFolder,{maxAge:'1y',index:false,redirect:false}));app.use((req,res,next)=>{engine.handle(req).then(response=>response?writeResponseToNodeResponse(response,res):next()).catch(next);});if(isMainModule(import.meta.url)){app.listen(process.env['PORT']||4000);}export const reqHandler=createNodeRequestHandler(app);
