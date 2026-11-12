import express from 'express';
import {releaseEmergencyStop} from './reconciliation.js';
import type {Express,RequestHandler} from 'express';
import {rateLimit} from '../rateLimit.js';
import {validateProductionConfiguration} from './configuration.js';
import {deploymentLifecycle} from './lifecycle.js';
import {launchRequirements} from './launchReview.js';
export function registerPhase21Readiness(app:Express,owner:RequestHandler) {
  app.get('/api/owner/phase21/readiness',owner,rateLimit(30,60000),(_req,res)=>{
    res.set('Cache-Control','no-store');res.json({configuration:validateProductionConfiguration(process.env),runtime:deploymentLifecycle.snapshot(),
      launchRequirements,emergencyStop:releaseEmergencyStop.snapshot(),externalEvidence:'NOT_VERIFIED',productionArchiveConnected:false,independentCollectorsConfigured:false,
      deploymentAllowed:false,financialExecutionAllowed:false,separateReviewedAuthorizationRequired:true});
  });
  app.post('/api/owner/phase21/emergency-stop',owner,rateLimit(10,60000),express.json({limit:'1kb'}),(req,res)=>{
    res.set('Cache-Control','no-store');
    try {
      if(!req.body || Object.keys(req.body).some(k=>k!=='reason'))throw Error('INVALID_REQUEST');
      res.json(releaseEmergencyStop.engage(req.body.reason));
    }catch {res.status(400).json({error:'INVALID_EMERGENCY_REQUEST',financialExecutionAllowed:false});}
  });
}
