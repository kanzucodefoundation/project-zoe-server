import * as service from "../modules/security/users/users.service";

const userData = {
    username: 'test@example.com',
    contactId: 'admin',
    password: 'Xpass@123',
    group: 'admin',
    useless: 'useless',
}

export async function seedDataAsync() {
    const user = await service.findByUsername(userData.username)
    if (user) {
        console.log('Admin user already setup')
    } else {
        console.log('Seeding admin user')
        await service.createAsync(userData);
    }

}
