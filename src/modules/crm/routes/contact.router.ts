import {Request, Response, Router} from "express";
import * as service from "../services/contact.service";
import {handleError} from "../../../utils/routerHelpers";

const router = Router();

/* GET listing. */
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

// TODO Add validation
/* Create */
router.post("/", async (req: Request, res: Response) => {
    try {
        const saved = await service.createAsync(req.body);
        res.json(saved);
    } catch (error) {
        handleError(error, res);
    }
});


/* Delete by id. */
router.delete("/:id", async (req: Request, res: Response) => {
    try {
        const {id} = req.params;
        await service.deleteAsync(id);
        res.json({
            message: "Operation succeeded"
        });
    } catch (error) {
        handleError(error, res);
    }
});

export default router;
