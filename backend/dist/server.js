import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { PgDataService } from './services/providerService.js';
const dataService = new PgDataService(pool, config.retentionDays);
const app = createApp(dataService, config.apiUpdateKey);
app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on port ${config.port}`);
});
