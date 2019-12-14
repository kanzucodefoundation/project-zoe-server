import * as userService from "../modules/security/users/users.service";
import * as userGroupService from "../modules/security/usergroup/usergroup.service";

const userGroupData = {
    name: "Admin",
    details: "admin users",
    roles: ["ROLE_CREATE_CONTACT"]
}
const userData = {
    username: 'ekastimo@gmail.com',
    contactId: 'admin',
    password: 'Xpass@123',
    group: 'Admin'
}

export async function seedDataAsync() {
    const exists = await userGroupService.exitsAsync(userGroupData.name)
    if (exists) {
        console.log('Default user group already setup')
    } else {
        console.log('seeding default user group')
        await userGroupService.createAsync(userGroupData);
    }
    const user = await userService.findByUsername(userData.username)
    if (user) {
        console.log('Admin user already setup')
    } else {
        console.log('Seeding admin user')
        await userService.createAsync(userData);
    }

}
