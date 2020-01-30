import {Request, Response, Router} from "express";

import {badRequest, handleError} from "../../../utils/routerHelpers";

import * as service from "../services/contact.service";
import BaseQuery from "../../../data/BaseQuery";
import {parseNumber} from "../../../utils/numberHelpers";

import {check} from "express-validator";
import {isValidDate} from "../../../utils/dateHelpers";
import {validate} from "../../../utils/middleware";
import {hasValue} from "../../../utils/validation";
import {createPersonRules} from "../dto/contact.dto";
import {Contact} from "../entities/contact";
import {LinqRepository} from "typeorm-linq-repository";
import {getPersonFullName} from "../entities";
import {getRepository} from "typeorm";
import {Person} from "../entities/person";

const router = Router();
const linqRepo = () => new LinqRepository(Contact);
const personRepo = () => new LinqRepository(Person);

/* GET listing. */
router.get("/", async (req: Request, res: Response) => {
    try {
        const {skip = 0, limit = 10, query: sQuery}: BaseQuery = req.query;
        let query = linqRepo()
            .getAll();
        const wPerson = query
            .include(c => c.person);
        if (hasValue(sQuery)) {
            query = wPerson
                .where(it => it.person.firstName)
                .contains(sQuery)
                .or(it => it.person.lastName)
                .contains(sQuery)
                .or(it => it.person.middleName)
                .contains(sQuery);
        }
        const data = await query
            .skip(parseNumber(skip))
            .take(parseNumber(limit))
            .toPromise();

        const fine = data.map(({id, person}: any) => {
            return {id, avatar: person.avatar, name: getPersonFullName(person)};
        });
        res.send(fine);
    } catch (error) {
        handleError(error, res);
    }
});


/* Create */
router.post("/", createPersonRules, validate, async (req: Request, res: Response) => {
    try {
        const saved = await service.createPersonAsync(req.body);
        res.json(saved);
    } catch (error) {
        handleError(error, res);
    }
});

export const rules = [
    check("firstName", "First Name cannot be blank").not().isEmpty(),
    check("lastName", "Last Name cannot be blank").not().isEmpty(),
    check("gender", "Gender cannot be blank").not().isEmpty(),
    check("civilStatus", "Gender cannot be blank").not().isEmpty(),
    check("avatar", "Gender cannot be blank").not().isEmpty(),
    check("dateOfBirth", "Date of birth cannot be blank").custom(isValidDate)
];

/* Update by contactId. */
router.put("/", rules, validate, async (req: Request, res: Response) => {
    try {
        const model: Person = req.body;
        if (!hasValue(model.id)) {
            await Promise.reject(badRequest("Invalid contact"));
        }
        const count = await personRepo().getById(model.id).count();
        if (count <= 0) {
            await Promise.reject(badRequest(`Invalid contact :${model.id}`));
        }
        const updated = await personRepo().update(model);
        res.json(updated);
    } catch (error) {
        handleError(error, res);
    }
});
export default router;
