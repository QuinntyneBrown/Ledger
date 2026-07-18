import http from 'k6/http';
import { check } from 'k6';
export const options={vus:20,duration:'30s',thresholds:{http_req_failed:['rate<0.001'],http_req_duration:['p(95)<400']}};
export default function(){const response=http.get(`${__ENV.LEDGER_API_URL||'http://localhost:8080'}/health/ready`);check(response,{'ready':r=>r.status===200});}
