import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorHandler.js';
import { createRouter } from './routes/index.js';
export const createApp = (dataService, apiKey) => {
    const app = express();
    app.use(helmet());
    app.use(cors());
    app.use(express.json({ limit: '1mb' }));
    app.use(morgan('combined'));
    app.use(createRouter(dataService, apiKey));
    app.use(errorHandler);
    return app;
};
