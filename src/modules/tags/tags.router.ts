import {Request, Response, Router} from "express";

import {validate} from "../../utils/middleware";
import * as repo from "../../utils/repository";
import {arrayHasValues, hasValue} from "../../utils/validation";
import {handleError} from "../../utils/routerHelpers";
import TagModel, {ITag, createTagRules, editTagRules} from "./tags.model";
import logger from "../../utils/logging/logger";

const router = Router();

/* GET list. */
router.get("/", async (req: Request, res: Response) => {
    try {
        const q = req.query;
        logger.info("tags.search ", q);
        const filter: any = {};
        if (hasValue(q.query)) {
            filter["name"] = {$regex: new RegExp(q.query), $options: "i"};
        }
        if (arrayHasValues(q.categories)) {
            filter["category"] = {$in: [...q.categories]};
        }
        const data = await TagModel.find(filter, null, {skip: q.skip, limit: q.limit});
        res.send(data);
    } catch (e) {
        handleError(e, res);
    }
});

/* Create new */
router.post("/", createTagRules, validate, async (req: Request, res: Response) => {
    try {
        logger.info("tags.create");
        const data = await repo.createAsync<ITag>(TagModel, req.body);
        res.json(data);
    } catch (e) {
        handleError(e, res);
    }
});

/* Update new */
router.put("/", editTagRules, validate, async (req: Request, res: Response) => {
    try {
        const model = req.body;
        logger.info(`tags.edit ${model.id}`);
        const data = await repo.updateAsync<ITag>(TagModel, model);
        res.json(data);
    } catch (e) {
        handleError(e, res);
    }
});

/* Get by id. */
router.get("/:id", async (req: Request, res: Response) => {
    try {
        const {id} = req.params;
        logger.info(`tags.getById ${id}`);
        const data = await repo.getByIdAsync(TagModel, id);
        res.json(data);
    } catch (e) {
        handleError(e, res);
    }
});

/* Delete by id. */
router.delete("/:id", async (req: Request, res: Response) => {
    try {
        const {id} = req.params;
        logger.info(`tags.delete ${id}`);
        await repo.deleteAsync(TagModel, id);
        res.json({
            message: "Operation succeeded"
        });
    } catch (e) {
        handleError(e, res);
    }
});

export default router;
