import express, {Express} from 'express'
import * as  path from 'path'
import cors from "cors"
import loggerMiddleware from './utils/logging/loggerMiddleware'
import passport from "passport";
import './modules/security/auth/passport.setup'
import {errorMiddleware} from "./utils/routerHelpers";
import configureRouter from "./utils/routerConfig";
const app: Express = express();
app.use(cors())
app.use(loggerMiddleware)
app.use(express.json())
app.use(express.urlencoded({extended: false}))
app.use(passport.initialize());
app.use(express.static(path.join(__dirname, '../public')))
configureRouter(app)
app.use(errorMiddleware)
export default app
