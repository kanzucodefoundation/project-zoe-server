import request from "supertest";
import app from "../../../app";
import {seedDataAsync} from "../../../data/seed";
import {createConnection} from "typeorm";
import {crmEntities} from "../../crm/entities";
import {User} from "../../security/users/user.entity";
import {UserGroup} from "../../security/usergroup/usergroup.entity";

const route = "/api/groups/group";
let token = "";
beforeAll(async () => {
    await createConnection({
        type: "mysql",
        host: "localhost",
        port: 3306,
        username: "root",
        password: "root",
        database: "node-test",
        entities: [
            ...crmEntities,
            User, UserGroup,
        ],
        synchronize: true,
        logging: true
    });
    await seedDataAsync();
    const resp = await request(app)
        .post("/api/auth/login")
        .send({username: "ekastimo@gmail.com", password: "Xpass@123"});
    console.log("Response", resp);
    token = resp.body["token"];
});

describe(`GET ${route}`, () => {
    it("should return 200 OK", (done) => {
        request(app)
            .get(route)
            .set("Authorization", `Bearer ${token}`)
            .expect(200, done);
    });
});

