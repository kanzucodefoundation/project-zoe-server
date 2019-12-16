import {Request, Response, Router} from "express";
import UserGroupModel, {IUserGroup, UserGroupDto, userGroupRules} from './usergroup.model'
import {validate} from "../../../utils/middleware";
import * as repo from "../../../utils/repository";
import {hasValue} from "../../../utils/validation";
import {handleError} from "../../../utils/routerHelpers";

const router = Router();

/* GET groups listing. */
router.get('/', async (req: Request, res: Response) => {
    try {
        const q = req.query
        const filter: any = {}
        if (hasValue(q.query)) {
            filter['name'] = {$regex: new RegExp(q.query), $options: 'i'}
        }
        const data = await UserGroupModel.find(filter, null, {skip: q.skip, limit: q.limit});
        res.send(data);
    } catch (e) {
        handleError(e, res)
    }
});

/* Create user */
router.post('/', userGroupRules, validate, async (req: Request, res: Response) => {
    try {
        const data = await repo.createAsync<IUserGroup>(UserGroupModel, UserGroupDto.create(req.body))
        res.json(data);
    } catch (e) {
        handleError(e, res)
    }
});

/* Update user */
router.put('/', userGroupRules, validate, async (req: Request, res: Response) => {
    try {
        const model = UserGroupDto.create(req.body)
        const data = await repo.updateAsync<IUserGroup>(UserGroupModel, model)
        res.json(data);
    } catch (e) {
        handleError(e, res)
    }
});

/* Get task by id. */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const {id} = req.params;
        const data = await repo.getByIdAsync(UserGroupModel, id);
        res.json(data);
    } catch (e) {
        handleError(e, res)
    }
});

/* Delete task by id. */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const {id} = req.params;
        await repo.deleteAsync(UserGroupModel, id);
        res.json({
            message: 'Operation succeeded'
        });
    } catch (e) {
        handleError(e, res)
    }
});

export default router;
