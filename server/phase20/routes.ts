import express, {type Express, type RequestHandler} from 'express';
import { rateLimit } from '../rateLimit.js';
import { denyRealExecution, previewGateway, gatewayLimits } from './gateway.js';
import { planEvidenceQuote } from './quotation.js';
import { supplierCapabilities } from './supplierEvidence.js';
/** Owner-only evaluation. No production store, collector, signer, payment or provider dependency. */
export function registerPhase20Readiness(app: Express, owner: RequestHandler) {
  const limits=rateLimit(30,60000);
  const noStore: RequestHandler=(_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();};
  const bounded: RequestHandler=(req,res,next)=>{
    try {if (Buffer.byteLength(JSON.stringify(req.body ?? {}))>32768) return void res.status(413).json({error:'PHASE20_REQUEST_TOO_LARGE'});next();}
    catch {res.status(400).json({error:'INVALID_PHASE20_REQUEST'});}
  };
  app.get('/api/owner/phase20/readiness',owner,limits,noStore,(_req,res)=>res.json({
    mode:'SIMULATION_DISCOVERY_ONLY',commerciallyOperational:false,execution:denyRealExecution(),gatewayLimits,supplierCapabilities,
    verifiedCustomers:0,realizedRevenueCents:0,independentCollectorsConfigured:false,productionJournalConnected:false,remainingBlockers:5
  }));
  app.post('/api/owner/phase20/gateway-preview',owner,limits,noStore,express.json({limit:'32kb'}),bounded,(req,res)=>{
    const result=previewGateway(req.body);res.status(result.code==='INVALID_GATEWAY_REQUEST'?400:200).json(result);
  });
  app.post('/api/owner/phase20/quote-preview',owner,limits,noStore,express.json({limit:'32kb'}),bounded,(req,res)=>{
    try {res.json({quote:planEvidenceQuote(req.body),executionAuthorized:false,realizedRevenueCents:0});}
    catch {res.status(400).json({error:'INVALID_OR_INCOMPLETE_QUOTE_EVIDENCE',executionAuthorized:false});}
  });
}
