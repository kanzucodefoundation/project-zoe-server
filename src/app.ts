import express, {Express} from 'express'
import * as  path from 'path'
import mongoose from "mongoose"
import bluebird from "bluebird"
import cors from "cors"
import loggerMiddleware from './utils/logging/loggerMiddleware'
import passport from "passport";
import './modules/security/auth/passport.setup'
import {seedDataAsync} from "./data/seed";
import {errorMiddleware} from "./utils/routerHelpers";
import configureRouter from "./utils/routerConfig";
import logger from "./utils/logging/logger";

const app: Express = express();
mongoose.Promise = bluebird;
const mongoUrl: string = process.env.MONGO_URL || "mongodb://localhost:27017/angie-server";
if (mongoUrl.length === 0) {
    logger.error(`Invalid mongo url: ${mongoUrl}`)
}
mongoose.set('debug', true);
mongoose.connect(mongoUrl, {useNewUrlParser: true, useUnifiedTopology: true}).then(
    async () => {
        await seedDataAsync()
    },
).catch(err => {
    logger.error("DB connection error." , err)
})
app.use(cors())
app.use(loggerMiddleware)
app.use(express.json())
app.use(express.urlencoded({extended: false}))
app.use(passport.initialize());
app.use(express.static(path.join(__dirname, '../public')))
configureRouter(app)
app.use(errorMiddleware)
export default app
