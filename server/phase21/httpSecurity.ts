import type {RequestHandler} from 'express';
export function runtimePort(value:string|undefined) {
 if(value===undefined)return 3000;
 if(!/^[0-9]{1,5}$/.test(value)||Number(value)<1||Number(value)>65535)throw Error('INVALID_PORT');return Number(value);
}
export const productionHeaders:RequestHandler=(req,res,next)=>{
 res.set('X-Content-Type-Options','nosniff');res.set('X-Frame-Options','DENY');res.set('Referrer-Policy','no-referrer');
 res.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 if(req.path.startsWith('/api/'))res.set('Cache-Control','no-store');
 if(process.env.NODE_ENV==='production') {
  res.set('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  res.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
 }
 next();
};
