import {Request, Response, Router} from "express";
import bcrypt from 'bcryptjs'
import UserModel, {createUserRules, editUserRules, IUser} from './user.model'
import {validate} from "../../utils/middleware";
import {isDupError} from "../../utils/dbUtils";

const router = Router();

/* GET users listing. */
router.get('/', async (req: Request, res: Response) => {
    try {
        const data = await UserModel.find({});
        res.send(data);
    } catch (err) {
        console.error(err);
        res.status(500).send({message: 'Failed to load users'});
    }
});

/* Create user */
router.post('/', createUserRules, validate, async (req: Request, res: Response) => {
    // authentication will take approximately 13 seconds
    // https://pthree.org/wp-content/uploads/2016/06/bcrypt.png
    const hashCost = 10;
    try {
        const {username, password, contactId} = req.body;
        const passwordHash = await bcrypt.hash(password, hashCost);
        const toSave: IUser = new UserModel({username, password: passwordHash, contactId})
        const saved = await toSave.save()
        res.status(200).send(saved);
    } catch (error) {
        if (isDupError(error)) {
            res.status(400).send({
                message: "Duplicate user",
            });
        }
        console.error(error);
        res.status(500).send({
            message: "Failed to create user",
        });
    }
});


/* Update user */
router.put('/', editUserRules, validate, async (req: Request, res: Response) => {
    // authentication will take approximately 13 seconds
    // https://pthree.org/wp-content/uploads/2016/06/bcrypt.png
    const hashCost = 10;
    try {
        const {username, password, contactId} = req.body;
        const passwordHash = await bcrypt.hash(password, hashCost);
        const toSave = new UserModel({username, password: passwordHash, contactId})
        const saved = await toSave.save()
        res.status(200).send(saved);
    } catch (error) {
        if (isDupError(error)) {
            res.status(400).send({
                message: "Duplicate user",
            });
        }
        console.error(error);
        res.status(500).send({
            message: "Failed to create user",
        });
    }
});

export default router;
