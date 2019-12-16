import {Request, Response, Router} from "express";

import {badRequest, handleError} from "../../../utils/routerHelpers";
import ContactModel from "../contacts/contact.model";
import {createQuery} from "../contacts/contact.service";
import IBaseQuery from "../../../data/BaseQuery";
import {parseNumber} from "../../../utils/numberHelpers";
import {getPersonFullName} from "../types";
import {check} from "express-validator";
import {isValidDate} from "../../../utils/dateHelpers";
import {validate} from "../../../utils/middleware";
import {hasValue} from "../../../utils/validation";

const router = Router();

/* GET listing. */
router.get('/', async (req: Request, res: Response) => {
    try {
        const q: IBaseQuery = req.query
        const filter: any = createQuery(q)
        const p = {
            "person.salutation": true,
            "person.firstName": true,
            "person.lastName": true,
            "person.middleName": true,
            "person.avatar": true
        }
        const data = await ContactModel
            .find(filter, p, {skip: parseNumber(q.skip), limit: parseNumber(q.limit)}).lean();
        const fine = data.map(({_id, person}: any) => {
            return {id: _id, avatar: person.avatar, name: getPersonFullName(person)}
        })
        res.send(fine);
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
        contact.person = {...old,...req.body}
        await contact.save()
        res.json(contact.person);
    } catch (error) {
        handleError(error, res)
    }
});
export default router;
