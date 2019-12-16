import {Request, Response, Router} from "express";

import {handleError} from "../../../utils/routerHelpers";
import {check} from "express-validator";
import {validate} from "../../../utils/middleware";
import * as service from '../contacts/subdoc.service'

const router = Router();

export const createRules = [
    check("category", "category is required").not().isEmpty(),
    check("value", "value is required").not().isEmpty()
]

export const editRules = [
    check("id", "Id is required").not().isEmpty(),
    ...createRules
]
const childName = 'phones'

/* Create phone by contactId. */
router.post('/:contactId', createRules, validate, async (req: Request, res: Response) => {
    try {
        const {contactId} = req.params;
        const data = await service.createAsync(childName, contactId, req.body)
        res.json(data);
    } catch (error) {
        handleError(error, res)
    }
});


/* Update by contactId. */
router.put('/:contactId', editRules, validate, async (req: Request, res: Response) => {
    try {
        const {contactId} = req.params;
        const data = await service.updateAsync(childName, contactId, req.body)
        res.json(data);
    } catch (error) {
        handleError(error, res)
    }
});

/* Delete by contactId. */
router.delete('/:contactId/:id', async (req: Request, res: Response) => {
    try {
        const {contactId, id} = req.params;
        const data = await service.deleteAsync(childName, contactId, id)
        res.json(data);
    } catch (error) {
        handleError(error, res)
    }
});
export default router;
