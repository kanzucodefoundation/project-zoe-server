import bcrypt from 'bcryptjs'
import passport from 'passport'
import * as PassportLocal from 'passport-local'
import * as PassportJWT from 'passport-jwt'
import {ExtractJwt} from 'passport-jwt'
import UserModel from '../users/users.model'
import {jwtConstants} from "./jwtConstants";

const LocalStrategy = PassportLocal.Strategy;
const JWTStrategy = PassportJWT.Strategy;

passport.use(
    new LocalStrategy(
        {
            usernameField: 'username',
            passwordField: 'password',
        },
        async (username, password, done) => {
            try {
                const userDocument = await UserModel.findOne({username: username}).exec();
                if (!userDocument) {
                    console.warn('invalid username: ', username)
                    return done('Incorrect Username / Password');
                }
                const passwordsMatch = await bcrypt.compare(password, userDocument.password);
                if (passwordsMatch) {
                    return done(null, userDocument);
                } else {
                    console.warn('invalid password: ', username)
                    return done('Incorrect Username / Password');
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
                return done('Access token expired');
            }
            return done(null, jwtPayload);
        }
    )
);
