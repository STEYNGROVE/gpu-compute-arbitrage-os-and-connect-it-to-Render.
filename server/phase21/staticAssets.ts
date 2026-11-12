import express, {type Express, type RequestHandler} from 'express';
import path from 'node:path';

/** Backend bundles share dist with Vite output; only client assets may be public. */
const rejectPrivateArtifacts:RequestHandler=(req,res,next)=>{
  let pathname:string;
  try {pathname=decodeURIComponent(req.path).replace(/\\/g,'/');}
  catch {res.status(400).end();return;}
  if(/\.(?:cjs|map)(?:\/|$)/i.test(pathname)) {res.status(404).end();return;}
  next();
};
export function registerProductionStatic(app:Express,distPath:string) {
  app.use(rejectPrivateArtifacts);
  app.use('/assets',express.static(path.join(distPath,'assets'),{index:false,dotfiles:'deny'}));
  app.use('/api',(_req,res)=>res.status(404).json({status:'not_found',error:'API_ROUTE_NOT_FOUND'}));
  app.get('*',(_req,res)=>res.sendFile(path.join(distPath,'index.html')));
}
