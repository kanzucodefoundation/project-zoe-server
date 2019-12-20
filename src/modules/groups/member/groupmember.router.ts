import {Request, Response, Router} from "express";
import {createMemberRules, editMemberRules} from './groupmember.model'
import {validate} from "../../../utils/middleware";
import * as service from './groupmember.service'
import {handleError} from "../../../utils/routerHelpers";

const router = Router();

/* GET listing. */
router.get('/', async (req: Request, res: Response) => {
    try {
        const data = await service.searchAsync(req.query);
        res.send(data);
    } catch (error) {
        handleError(error, res)
    }
});

/* Get by id. */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const {id} = req.params;
        const data = await service.getByIdAsync(id);
        res.json(data);
    } catch (error) {
        handleError(error, res)
    }
});

/* Create */
router.post('/', createMemberRules, validate, async (req: Request, res: Response) => {
    try {
        const saved = await service.createAsync(req.body)
        res.json(saved);
    } catch (error) {
        handleError(error, res)
    }
});

/* Update */
router.put('/', editMemberRules, validate, async (req: Request, res: Response) => {
    try {
        const updated = await service.updateAsync(req.body)
        res.json(updated);
    } catch (error) {
        handleError(error, res)
    }
});

/* Delete by id. */
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
