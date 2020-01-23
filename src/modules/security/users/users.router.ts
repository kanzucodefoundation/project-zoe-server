import {Request, Response, Router} from "express";
import {cleanUpUser, createUserRules, editUserRules} from "./users.model";
import {validate} from "../../../utils/middleware";
import * as service from "./users.service";
import * as groupService from "../usergroup/usergroup.service";
import * as contactsService from "../../crm/contacts/contact.service";
import {handleError} from "../../../utils/routerHelpers";

const router = Router();

/* GET users listing. */
router.get("/", async (req: Request, res: Response) => {
    try {
        const data = await service.searchAsync(req.query);
        res.send(data);
    } catch (error) {
        handleError(error, res);
    }
});

/* Get by id. */
router.get("/:id", async (req: Request, res: Response) => {
    try {
        const {id} = req.params;
        const data = await service.getByIdAsync(parseInt(id));
        res.json(data);
    } catch (error) {
        handleError(error, res);
    }
});

/* Create user */
router.post("/", createUserRules, validate, async (req: Request, res: Response) => {
    try {
        const saved = await service.createAsync(req.body);
        const data = await service.getByIdAsync(saved.id);
        res.json(data);
    } catch (error) {
        handleError(error, res);
    }
});

/* Update user */
router.put("/", editUserRules, validate, async (req: Request, res: Response) => {
    try {
        const model = req.body;
        await service.updateAsync(model);
        const data = await service.getByIdAsync(model.id);
        res.json(data);
    } catch (error) {
        handleError(error, res);
    }
});

/* Delete task by id. */
router.delete("/:id", async (req: Request, res: Response) => {
    try {
        const {id} = req.params;
        await service.deleteAsync(Number(id));
        res.json({
            message: "Operation succeeded"
        });
    } catch (error) {
        handleError(error, res);
    }
});

export default router;
