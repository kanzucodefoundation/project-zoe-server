import {Request, Response, Router} from "express";
import {createUserRules, editUserRules} from './users.model'
import {validate} from "../../../utils/middleware";
import * as service from './users.service'
import {handleError} from "../../../utils/routerUtils";

const router = Router();

/* GET users listing. */
router.get('/', async (req: Request, res: Response) => {
    try {
        const data = await service.searchAsync(req.query);
        res.send(data);
    } catch (error) {
        handleError(error, res)
    }

});

/* Create user */
router.post('/', createUserRules, validate, async (req: Request, res: Response) => {
    try {
        const saved = await service.createAsync(req.body)
        res.json(saved);
    } catch (error) {
        handleError(error, res)
    }
});

/* Update user */
router.put('/', editUserRules, validate, async (req: Request, res: Response) => {
    try {
        const saved = await service.updateAsync(req.body)
        res.json(saved);
    } catch (error) {
        handleError(error, res)
    }
});

/* Delete task by id. */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const {id} = req.params;
        await service.deleteAsync(id);
        res.json({
            message: 'Operation succeeded'
        });
    } catch (error) {
        handleError(error, res)
    }
});

export default router;
