import 'dotenv/config';
import pool from '../src/config/database';
import { ApplicationModel } from '../src/models/application.model';
import { PipelineEventModel } from '../src/models/pipeline_event.model';

async function test() {
  const apps = await pool.query('SELECT * FROM applications LIMIT 1');
  if (apps.rows.length > 0) {
    const events = await PipelineEventModel.findByApplication(apps.rows[0].id);
    console.log('Events for app', apps.rows[0].id, ':', JSON.stringify(events, null, 2));
    
    // Check stats
    const stats = await ApplicationModel.getApplicationStats(apps.rows[0].applicant_id);
    console.log('Stats:', stats);
  } else {
    console.log('No apps found');
  }
  process.exit(0);
}
test();
