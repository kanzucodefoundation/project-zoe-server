import * as userService from "../modules/security/users/users.service";
import * as contactService from "../modules/crm/contacts/contact.service";
import * as userGroupService from "../modules/security/usergroup/usergroup.service";
import logger from "../utils/logging/logger";
import {createGroupCategories} from "./seed.groups";

const userGroupData = {
    name: "Admin",
    details: "admin users",
    roles: ["ROLE_CREATE_CONTACT"]
}

const users: any[] = [
    {
        firstName: "Timothy",
        lastName: "Kasasa",
        middleName: null,
        gender: "Male",
        civilStatus: "Married",
        dateOfBirth: "2019-12-15T04:12:59+00:00",
        phone: "0701035517",
        email: "ekastimo@gmail.com",
        password: 'Xpass@123'
    },
    {
        firstName: "Peter",
        lastName: "Kakoma",
        middleName: null,
        gender: "Male",
        civilStatus: "Married",
        dateOfBirth: "2019-12-15T04:12:59+00:00",
        phone: "0701035517",
        email: "kakoma@kanzucode.com",
        password: 'Password@1'
    }
]

export async function seedUsersAsync() {
    let group = await userGroupService.getByNameAsync(userGroupData.name)
    if (group) {
        logger.info('Default user group already setup')
        logger.info('GroupId', {id: group.id, _id: group._id})
    } else {
        logger.info('seeding default user group')
        group = await userGroupService.createAsync(userGroupData);
    }
    for (const it of users) {
        await createUser(it, group.id)
    }
}

async function createUser(data: any, groupId: any) {
    const user = await userService.findByUsername(data.email)
    if (user) {
        logger.info(`User ${data.email} already setup`)
    } else {
        logger.info(`Seeding ${data.email}`)
        const contact = await contactService.createPersonAsync(data)
        const userData = {
            username: data.email,
            password: data.password,
            contact: contact.id,
            group: groupId,
        }
        const user = await userService.createAsync(userData);
    }
}
