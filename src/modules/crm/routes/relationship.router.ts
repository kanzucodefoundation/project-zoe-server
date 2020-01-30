import {Request, Response, Router} from "express";
import {handleError} from "../../../utils/routerHelpers";
import {check} from "express-validator";
import {validate} from "../../../utils/middleware";
import DependentService from '../contacts/subdoc.service'
import {getRepository} from "typeorm";
import {Relationship} from "../entities/relationship";

const router = Router();

export const createRules = [
    check("category", "category is required").not().isEmpty(),
    check("rootId", "rootId is required").not().isEmpty(),
    check("referenceId", "referenceId is required").not().isEmpty()
]

export const editRules = [
    check("id", "Id is required").not().isEmpty(),
    ...createRules
]


const repo = () => getRepository(Relationship)
const service = new DependentService(repo, 'category')
/* Create phone . */
router.post('/', createRules, validate, async (req: Request, res: Response) => {
    try {
        const data = await service.createAsync(req.body)
        res.json(data);
    } catch (error) {
        handleError(error, res)
    }
});

/* Update . */
router.put('/', editRules, validate, async (req: Request, res: Response) => {
    try {
        const data = await service.updateAsync(req.body)
        res.json(data);
    } catch (error) {
        handleError(error, res)
    }
});

/* Delete . */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const {id} = req.params;
        const data = await service.deleteAsync(id)
        res.json(data);
    } catch (error) {
        handleError(error, res)
    }
});
export default router;
