import {Request, Response, Router} from "express";
import passport from "passport";
import {appRoles, createJWT} from "./auth.constants";
import {authorize} from "../../../utils/middleware";

const router = Router();

router.post("/login", function (req: Request, res: Response) {
    passport.authenticate(
        "local",
        {session: false},
        function (error, user, info) {
            if (error) {
                console.log("Auth Error", error);
                res.status(401).json({message: error});
            } else if (!user) {
                res.status(401).json({message: "invalid user", info});
            } else {
                const token = createJWT(user);
                res.status(200)
                    .send({user, token});
            }
        }
    )(req, res);
});

router.get("/profile", authorize, function (req: Request, res: Response) {
    res.json(req.user);
});

router.get("/roles", authorize, function (req: Request, res: Response) {
    res.json(Object.values(appRoles));
});

export default router;
