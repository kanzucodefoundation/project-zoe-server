import bcrypt from "bcryptjs";
import passport from "passport";
import * as PassportLocal from "passport-local";
import * as PassportJWT from "passport-jwt";
import {ExtractJwt} from "passport-jwt";
import * as service from "../users/users.service";
import {jwtConstants} from "./auth.constants";
import {cleanUpUser} from "../users/users.model";

const LocalStrategy = PassportLocal.Strategy;
const JWTStrategy = PassportJWT.Strategy;

passport.use(
    new LocalStrategy(
        {
            usernameField: "username",
            passwordField: "password",
        },
        async (username, password, done) => {
            try {
                const user = await service.findByUsername(username);
                if (!user) {
                    console.warn("invalid username: ", username);
                    return done("Incorrect Username / Password");
                }
                const passwordsMatch = await bcrypt.compare(password, user.password);
                if (passwordsMatch) {
                    cleanUpUser(user);
                    return done(null, user);
                } else {
                    console.warn("invalid password: ", username);
                    return done("Incorrect Username / Password");
                }
            } catch (error) {
                done(error);
            }
        }));

passport.use(
    new JWTStrategy(
        {
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: jwtConstants.secret
        },
        (jwtPayload, done) => {
            if (Date.now() > jwtPayload.expires) {
                return done("Access token expired");
            }
            return done(null, jwtPayload);
        }
    )
);
