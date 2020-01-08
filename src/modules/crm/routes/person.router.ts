import {Request, Response, Router} from "express";

import {badRequest, handleError} from "../../../utils/routerHelpers";
import ContactModel from "../contacts/contact.model";
import * as service from "../contacts/contact.service";
import IBaseQuery from "../../../data/BaseQuery";
import {parseNumber} from "../../../utils/numberHelpers";
import {getPersonFullName} from "../types";
import {check} from "express-validator";
import {isValidDate} from "../../../utils/dateHelpers";
import {validate} from "../../../utils/middleware";
import {hasValue} from "../../../utils/validation";
import {createPersonRules} from "../contacts/contact.dto";
import {Contact} from "../entities/contact";
import {LinqRepository} from "typeorm-linq-repository";

const router = Router();
const linqRepo = () => new LinqRepository(Contact)

/* GET listing. */
router.get('/', async (req: Request, res: Response) => {
    try {
        const {skip = 0, limit = 10, query: sQuery}: IBaseQuery = req.query
        let query = linqRepo()
            .getAll()
        let wPerson = query
            .include(c => c.person)
        if (hasValue(sQuery)) {
            query = wPerson
                .where(it => it.person.firstName)
                .contains(sQuery)
                .or(it => it.person.lastName)
                .contains(sQuery)
                .or(it => it.person.middleName)
                .contains(sQuery)
        }
        const data = await query
            .skip(parseNumber(skip))
            .take(parseNumber(limit))
            .toPromise();

        const fine = data.map(({id, person}: any) => {
            return {id, avatar: person.avatar, name: getPersonFullName(person)}
        })
        res.send(fine);
    } catch (error) {
        handleError(error, res)
    }
});


/* Create */
router.post('/', createPersonRules, validate, async (req: Request, res: Response) => {
    try {
        const saved = await service.createPersonAsync(req.body)
        res.json(saved);
    } catch (error) {
        handleError(error, res)
    }
});

export const rules = [
    check("firstName", "First Name cannot be blank").not().isEmpty(),
    check("lastName", "Last Name cannot be blank").not().isEmpty(),
    check("gender", "Gender cannot be blank").not().isEmpty(),
    check("civilStatus", "Gender cannot be blank").not().isEmpty(),
    check("avatar", "Gender cannot be blank").not().isEmpty(),
    check("dateOfBirth", "Date of birth cannot be blank").custom(isValidDate)
]

/* Update by contactId. */
router.put('/:id', rules, validate, async (req: Request, res: Response) => {
    try {
        const {id} = req.params;
        if (!hasValue(id)) {
            await Promise.reject(badRequest('Invalid contact'))
        }
        const contact = await ContactModel.findById(id);
        if (!contact) {
            await Promise.reject(badRequest(`Invalid contact :${id}`))
        }
        const old = contact.toObject().person
        contact.person = {...old, ...req.body}
        await contact.save()
        res.json(contact.person);
    } catch (error) {
        handleError(error, res)
    }
});
export default router;
