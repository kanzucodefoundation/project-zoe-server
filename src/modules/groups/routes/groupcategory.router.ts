import {Request, Response, Router} from "express";

import {validate} from "../../../utils/middleware";
import {hasValue} from "../../../utils/validation";
import {handleError} from "../../../utils/routerHelpers";
import logger from "../../../utils/logging/logger";
import BaseQuery from "../../../data/BaseQuery";
import {parseNumber} from "../../../utils/numberHelpers";
import {getRepository} from "typeorm";
import {LinqRepository} from "typeorm-linq-repository";
import {GroupCategory} from "../entities/GroupCategory";
import {createGroupCategoryRules, editGroupCategoryRules} from "../dto/rules";

const router = Router();
const repo = () => getRepository(GroupCategory);
const linqRepo = () => new LinqRepository(GroupCategory);
/* GET list. */
router.get("/", async (req: Request, res: Response) => {
    try {
        const q = req.query;
        logger.info("groupCategories.search ", q);
        const {skip = 0, limit = 10, query: sQuery}: BaseQuery = q;
        let query = linqRepo()
            .getAll();

        if (hasValue(sQuery)) {
            query = query
                .where(it => it.name )
                .contains(sQuery);
        }
         const data = query
            .skip(parseNumber(skip))
            .take(parseNumber(limit))
            .toPromise();
        res.send(data);
    } catch (e) {
        handleError(e, res);
    }
});

/* Create new */
router.post("/", createGroupCategoryRules, validate, async (req: Request, res: Response) => {
    try {
        logger.info("groupCategories.create");
        const data = await repo().save(req.body);
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
        const data = await repo().save(model);
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
        const data = await linqRepo().getById(id);
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
        await repo().delete(id);
        res.json({
            message: "Operation succeeded"
        });
    } catch (e) {
        handleError(e, res);
    }
});

export default router;
