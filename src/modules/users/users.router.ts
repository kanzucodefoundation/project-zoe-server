import {Request, Response, Router} from "express";
import {createUserRules, editUserRules} from './users.model'
import {validate} from "../../utils/middleware";
import * as service from './users.service'

const router = Router();

/* GET users listing. */
router.get('/', async (req: Request, res: Response) => {
    const data = await service.searchAsync(req.query);
    res.send(data);
});

/* Create user */
router.post('/', createUserRules, validate, async (req: Request, res: Response) => {
    const saved = await service.createAsync(req.body)
    res.json(saved);
});

/* Update user */
router.put('/', editUserRules, validate, async (req: Request, res: Response) => {
    const saved = await service.updateAsync(req.body)
    res.json(saved);
});

/* Delete task by id. */
router.delete('/:id', async (req: Request, res: Response) => {
    const {id} = req.params;
    await service.deleteAsync(id);
    res.json({
        message: 'Operation succeeded'
    });
});

export default router;
