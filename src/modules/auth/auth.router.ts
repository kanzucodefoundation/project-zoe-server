import {Request, Response, Router} from "express";
import passport from 'passport'
import {createJWT} from "./jwtConstants";

const router = Router();


router.post('/login', function(req: Request, res: Response) {
    passport.authenticate(
        'local',
        {session: false},
        function (error, user, info) {
            if (error) {
                console.log('Auth Error',error)
                res.status(401).json({message: error});
            } else if (!user) {
                res.status(401).json({message: 'invalid user', info});
            } else {
                const payload: any = {
                    username: user.username,
                    contactId: user.contactId
                };
                const token = createJWT(payload);
                res.status(200)
                    .send({user, token});
            }
        }
    )(req, res);
});

export default router;
