import {Request, Response, Router} from "express";
import jwt from 'jsonwebtoken'
import passport from 'passport'
import {createJWT, jwtConstants} from "./jwtConstants";

const router = Router();

router.post('/login', passport.authenticate('local', {session: false}), (req: Request, res: Response) => {
    try {
        const user: any = req.user;
        const payload: any = {
            username: user.username,
            contactId: user.contactId
        };
        const token = createJWT(payload);
        res.status(200)
            .send({user, token});
    } catch (error) {
        console.error(error);
        res.status(401).send({
            message: "Oops failed to login",
        });
    }
});

export default router;
