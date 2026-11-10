import assert from 'node:assert/strict';
import { isCommercialComputeLead as qualifies } from '../server/commercialLeadFilter.js';
const cases: Array<[string,string,string,boolean]> = [
  ['RFQ for H100 GPU inference cluster','Request for quotation from suppliers','https://example.com/rfq',true],
  ['Need GPU capacity','Looking to rent H100 for inference','https://example.com/buy',true],
  ['GPU advances','Machine learning news and tutorials','https://example.com/news',false],
  ['We are hiring CUDA engineers','Full-time position, procurement experience','https://example.com/jobs',false],
  ['GPU inference procurement RFP','Tender open','https://news.ycombinator.com/whoishiring',false],
  ['Procurement update','Office chairs requested','https://example.com/feed',false],
  ['Looking to hire a GPU engineer','Apply for this job','https://example.com/feed',false],
  ['Seeking GPU provider','Need GPU capacity for model training','https://example.com/feed',true],
];
for (const [title,description,feed,expected] of cases) {
 assert.equal(qualifies(title,description,feed),expected, title);
}
console.log(`PASS: ${cases.length} commercial lead filtering cases`);
