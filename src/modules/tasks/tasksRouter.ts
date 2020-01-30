import {Request, Response, Router} from "express";
import {validationResult} from "express-validator";
import Task, {updateValidation, validation} from './taskModel'
import UserModel from "../security/users/users.model";

const router = Router();

/* GET tasks listing. */
router.get('/',async (req: Request, res: Response) => {
    try {
        const data = await Task.find({});
        res.json(data);
    } catch (err) {
        console.error(err);
        res.json('Failed to load');
    }
});

/* GET tasks by id. */
router.get('/:taskId', async (req: Request, res: Response) => {
    try {
        const {taskId} = req.params;
        const data = await Task.findById(taskId);
        res.json(data);
    } catch (err) {
        console.error(err);
        res.send('Failed to load');
    }
});

/* Create task */
router.post('/', validation, async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({errors: errors.array()});
    }
    try {
        const dt= req.body
        const user = await UserModel.findById(dt)
        const data = await Task.create(req.body);
        res.send(data);
    } catch (err) {
        console.error(err);
        res.status(500).send('Failed to load');
    }
});

/* Update task */
router.put('/', updateValidation, async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({errors: errors.array()});
    }
    try {
        const {_id, ...rest} = req.body
        const data: any = await Task.updateOne({_id}, rest);
        console.log(data)
        const {nModified, n, ok} = data
        if (nModified === 0) {
            console.warn("No data changes made")
        }
        if (n === 0 || ok == 0) {
            throw new Error('Failed to Update data');
        }
        const updated = await Task.findById(_id);
        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json(err.message);
    }
});

/* Delete task by id. */
router.delete('/:taskId', async (req: Request, res: Response) => {
    try {
        const {taskId} = req.params;
        const data = await Task.findByIdAndDelete(taskId);
        res.send(data);
    } catch (err) {
        console.error(err);
        res.send('Failed to load');
    }
});

export default router;
