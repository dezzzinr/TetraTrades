import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
dotenv.config({path:path.join(root,'.env.local'),quiet:true});
dotenv.config({path:path.join(root,'.env'),quiet:true});
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();
try{await client.query(readFileSync(path.join(root,'migrations/20261030_crypto_universe.sql'),'utf8'));console.log('Crypto universe migration applied.');}finally{await client.end();}
