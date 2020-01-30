import request from "supertest";
import app from "../../../app";
import mongoose from "mongoose";
import {seedDataAsync} from "../../../data/seed";

const route = '/api/groups/group'
let token = ''
beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    await seedDataAsync()
    const resp = await request(app)
        .post('/api/auth/login')
        .send({username: "ekastimo@gmail.com", password: 'Xpass@123'});
    console.log("Response", resp)
    token = resp.body['token'];
});


describe(`GET ${route}`, () => {
    it("should return 200 OK", (done) => {
        request(app)
            .get(route)
            .set('Authorization', `Bearer ${token}`)
            .expect(200, done);
    });
});


describe(`POST ${route}`, () => {
    it("should return false from assert when no message is found", (done) => {
        request(app).post("/contact")
            .field("name", "John Doe")
            .field("email", "john@me.com")
            .end(function (err, res) {
                expect(res.error).toBe(false);
                done();
            })
            .expect(302);

    });
});
