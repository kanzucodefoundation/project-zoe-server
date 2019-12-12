import express from 'express'
import * as  path from 'path'
import mongoose from "mongoose"
import bluebird from "bluebird"
import cors from "cors"
import indexRouter from "./modules/index"
import authRouter from "./modules/auth/auth.router"
import usersRouter from "./modules/auth/usersRouter"
import tasksRouter from "./modules/tasks/tasksRouter"
import logger from "morgan"
import passport from "passport";
import './modules/auth/passport.setup'
import {authorize} from './utils/middleware'

const app = express();
mongoose.Promise = bluebird;
const mongoUrl: string = process.env.MONGO_URL || "mongodb://localhost:27017/angie-server";
if (mongoUrl.length === 0) {
    console.log(`Invalid mongo url: ${mongoUrl}`)
}
mongoose.connect(mongoUrl, {useNewUrlParser: true, useUnifiedTopology: true}).then(
    () => { /** ready to use. The `mongoose.connect()` promise resolves to undefined. */
    },
).catch(err => {
    console.log("MongoDB connection error. Please make sure MongoDB is running. " + err)
})
app.use(cors())
app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({extended: false}))
app.use(passport.initialize());
app.use(express.static(path.join(__dirname, '../public')))

app.use('/', indexRouter)
app.use('/auth', authRouter)
app.use('/users', authorize, usersRouter)
app.use('/tasks', tasksRouter)

export default app
