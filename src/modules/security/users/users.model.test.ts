import mongoose from 'mongoose';
import UserModel , {CreateUserDto, IUser, UpdateUserDto} from './users.model';
import {createAsync, deleteAsync, updateAsync} from "../../../utils/repository";

const userData = {
    username: 'test@example.com',
    contactId: 'admin',
    password: 'adminPass',
    group: 'admin',
    useless: 'useless',
}
describe('UserModel model', () => {
    beforeAll(async () => {
        await mongoose.connect(process.env.MONGO_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    it('Update Model picks correct data', async () => {
        const update = UpdateUserDto.create({
            ...userData,
            password: 'adminPassNew',
            group: 'admin'
        })
        console.log(update)
        expect(update.group).toBe('admin');
        expect(update.password).toBe('adminPassNew');
    });

    it('Should throw validation errors', () => {
        const user = new UserModel();
        expect(user.validate).toThrow();
    });

    it('Should save a user', async () => {
        expect.assertions(3);
        const userDto = CreateUserDto.create(userData)
        const user: IUser = new UserModel(userDto);
        const spy = jest.spyOn(user, 'save');
        await user.save();
        expect(spy).toHaveBeenCalled();
        expect(user).toMatchObject({
            username: expect.any(String),
            contactId: expect.any(String),
            password: expect.any(String),
            group: expect.any(String),
            id: expect.any(String),
        });
        expect(user.username).toBe('test@example.com');
    });

    it('Should Update a user', async () => {
        //expect.assertions(2);
        const userDto = CreateUserDto.create(userData)
        const user: IUser = await createAsync<IUser>(UserModel, userDto);
        console.log(user.id)
        const update = UpdateUserDto.create(user)
        update.password = 'adminPassNew'
        update.group = 'admin'
        const updated: any = await updateAsync<IUser>(UserModel, update);
        expect(updated.username).toBe('test@example.com');
        expect(updated.password).toBe('adminPassNew');

        const resp = await deleteAsync<IUser>(UserModel, user.id)
        console.log('Delete response', resp)
    });
});
