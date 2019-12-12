import {Request, Response, Router} from "express";
import UserGroupModel, {IUserGroup, UserGroupDto, userGroupRules} from './usergroup.model'
import {validate} from "../../../utils/middleware";
import * as repo from "../../../utils/repository";
import {hasValue} from "../../../utils/validation";

const router = Router();

/* GET groups listing. */
router.get('/', async (req: Request, res: Response) => {
    try {
        const q = req.query
        const filter: any = {}
        if (hasValue(q.query)) {
            filter['name'] = new RegExp(`/${q.query}/i`)
        }
        const data = await UserGroupModel.find(filter, null, {skip: q.skip, limit: q.limit});
        res.send(data);
    }catch (e) {
        throw e
    }

});

/* Create user */
router.post('/', userGroupRules, validate, async (req: Request, res: Response) => {
    try {
        const data = await repo.createAsync<IUserGroup>(UserGroupModel, UserGroupDto.create(req.body))
        res.json(data);
    }catch (error) {
        const message = error.message || 'Oops, unknown error, please contact admin'
        res.status(500)
            .json({message});
    }
});

/* Update user */
router.put('/', userGroupRules, validate, async (req: Request, res: Response) => {
    const data = await repo.updateAsync<IUserGroup>(UserGroupModel, UserGroupDto.create(req.body))
    res.json(data);
});


/* Delete task by id. */
router.delete('/:id', async (req: Request, res: Response) => {
    const {id} = req.params;
    await repo.deleteAsync(UserGroupModel, id);
    res.json({
        message: 'Operation succeeded'
    });
});

export default router;
