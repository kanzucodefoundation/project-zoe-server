import {Request, Response, Router} from "express";

import {validate} from "../../utils/middleware";
import {hasValue} from "../../utils/validation";
import {handleError} from "../../utils/routerHelpers";
import logger from "../../utils/logging/logger";
import BaseQuery from "../../data/BaseQuery";
import {parseNumber} from "../../utils/numberHelpers";
import {getRepository} from "typeorm";
import {LinqRepository} from "typeorm-linq-repository";
import {Tag} from "./Tag";
import {createTagRules, editTagRules} from "./rules";

const router = Router();
const repo = () => getRepository(Tag);
const linqRepo = () => new LinqRepository(Tag);
/* GET list. */
router.get("/", async (req: Request, res: Response) => {
    try {
        const q = req.query;
        logger.info("tags.search ", q);
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
router.post("/", createTagRules, validate, async (req: Request, res: Response) => {
    try {
        logger.info("tags.create");
        const data = await repo().save(req.body);
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
        logger.info(`tags.getById ${id}`);
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
        logger.info(`tags.delete ${id}`);
        await repo().delete(id);
        res.json({
            message: "Operation succeeded"
        });
    } catch (e) {
        handleError(e, res);
    }
});

export default router;
