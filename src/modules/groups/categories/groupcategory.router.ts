import {Request, Response, Router} from "express";

import {validate} from "../../../utils/middleware";
import * as repo from "../../../utils/repository";
import {arrayHasValues, hasValue} from "../../../utils/validation";
import {handleError} from "../../../utils/routerHelpers";
import logger from "../../../utils/logging/logger";
import GroupCategoryModel, {
    createGroupCategoryRules,
    editGroupCategoryRules,
    IGroupCategory
} from "./groupcategory.model";

const router = Router();

/* GET list. */
router.get("/", async (req: Request, res: Response) => {
    try {
        const q = req.query;
        logger.info("groupCategories.search ", q);
        const filter: any = {};
        if (hasValue(q.query)) {
            filter["name"] = {$regex: new RegExp(q.query), $options: "i"};
        }
        if (arrayHasValues(q.categories)) {
            filter["category"] = {$in: [...q.categories]};
        }
        const data = await GroupCategoryModel.find(filter, null, {skip: q.skip, limit: q.limit});
        res.send(data);
    } catch (e) {
        handleError(e, res);
    }
});

/* Create new */
router.post("/", createGroupCategoryRules, validate, async (req: Request, res: Response) => {
    try {
        logger.info("groupCategories.create");
        const data = await repo.createAsync<IGroupCategory>(GroupCategoryModel, req.body);
        res.json(data);
    } catch (e) {
        handleError(e, res);
    }
});

/* Update new */
router.put("/", editGroupCategoryRules, validate, async (req: Request, res: Response) => {
    try {
        const model = req.body;
        logger.info(`groupCategories.edit ${model.id}`);
        const data = await repo.updateAsync<IGroupCategory>(GroupCategoryModel, model);
        res.json(data);
    } catch (e) {
        handleError(e, res);
    }
});

/* Get by id. */
router.get("/:id", async (req: Request, res: Response) => {
    try {
        const {id} = req.params;
        logger.info(`groupCategories.getById ${id}`);
        const data = await repo.getByIdAsync(GroupCategoryModel, id);
        res.json(data);
    } catch (e) {
        handleError(e, res);
    }
});

/* Delete by id. */
router.delete("/:id", async (req: Request, res: Response) => {
    try {
        const {id} = req.params;
        logger.info(`groupCategories.delete ${id}`);
        await repo.deleteAsync(GroupCategoryModel, id);
        res.json({
            message: "Operation succeeded"
        });
    } catch (e) {
        handleError(e, res);
    }
});

export default router;
