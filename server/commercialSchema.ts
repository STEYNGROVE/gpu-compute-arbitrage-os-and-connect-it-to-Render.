import type pg from 'pg';

/** Read-only contract for the commercial adapters; evidence remains metadata, never capital. */
export const commercialColumnTypes: Record<string, Record<string,string>> = {
 commercial_quote_requests:{id:'uuid',created_at:'timestamp with time zone',company:'text',contact_name:'text',email:'text',workload:'text',gpu_model:'text',gpu_count:'integer',hours:'integer',notes:'text',status:'text'},
 customer_intelligence_leads:{id:'uuid',company:'text',source_url:'text',evidence:'text',workload:'text',contact_channel:'text',estimated_gpu_count:'integer',verified_customer:'boolean',status:'text',created_at:'timestamp with time zone'},
 gpu_hunter_opportunities:{id:'uuid',company:'text',source_url:'text',evidence:'text',workload:'text',contact_channel:'text',deadline:'timestamp with time zone',budget_evidence:'text',score:'integer',score_reasons:'jsonb',status:'text',created_at:'timestamp with time zone'},
 preapproved_workload_evidence:{id:'uuid',customer_name:'text',customer_email:'text',workload_description:'text',evidence_type:'text',evidence_sha256:'text',document_reference:'text',issuer_name:'text',issuer_contact:'text',budget_currency:'text',approved_budget:'numeric',valid_until:'date',state:'text',reviewer:'text',verification_notes:'text',verified_at:'timestamp with time zone',created_at:'timestamp with time zone'}
};
export async function verifyCommercialColumnTypes(client: pg.PoolClient) {
 const result=await client.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1)",[Object.keys(commercialColumnTypes)]);
 const found=new Map(result.rows.map(row=>[row.table_name+'.'+row.column_name,row.data_type]));
 for(const [table,columns] of Object.entries(commercialColumnTypes))for(const [column,type] of Object.entries(columns)){
  if(found.get(table+'.'+column)!==type)throw Error('COMMERCIAL_SCHEMA_INCOMPATIBLE');
 }
}
