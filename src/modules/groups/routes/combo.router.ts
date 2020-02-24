import {Request, Response, Router} from "express";
import * as service from "../services/group.service";
import {handleError} from "../../../utils/routerHelpers";

const router = Router();

/* GET listing. */
router.get("/", async (req: Request, res: Response) => {
    try {
        const data = await service.comboAsync(req.query);
        res.send(data);
    } catch (error) {
        handleError(error, res);
    }
});






export default router;
