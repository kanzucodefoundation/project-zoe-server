import {Express} from "express";
import authRouter from "./modules/security/auth/auth.router";
import {authorize} from "./utils/middleware";
import usersRouter from "./modules/security/users/users.router";
import userGroupRouter from "./modules/security/usergroup/usergroup.router";
import tagsRouter from "./modules/tags/tags.router";
import groupRouter from "./modules/groups/routes/group.router";
import groupCategoryRouter from "./modules/groups/routes/groupcategory.router";
import groupMemberRouter from "./modules/groups/routes/groupmember.router";
import groupComboRouter from "./modules/groups/routes/combo.router";
import contactRouter from "./modules/crm/routes/contact.router";
import personRouter from "./modules/crm/routes/person.router";
import phoneRouter from "./modules/crm/routes/phone.router";
import addressRouter from "./modules/crm/routes/address.router";
import emailRouter from "./modules/crm/routes/email.router";
import identificationRouter from "./modules/crm/routes/identification.router";
import occasionRouter from "./modules/crm/routes/occasion.router";
import relationshipRouter from "./modules/crm/routes/relationship.router";


export default function configureRouter(app: Express) {
    app.use("/api/auth", authRouter);
    app.use("/api/users", usersRouter);
    app.use("/api/user-groups", authorize, userGroupRouter);
    app.use("/api/tags", authorize, tagsRouter);
    app.use("/api/groups/categories", authorize, groupCategoryRouter);
    app.use("/api/groups/group", authorize, groupRouter);
    app.use("/api/groups/member", authorize, groupMemberRouter);
    app.use("/api/groups/combo", authorize, groupComboRouter);

    app.use("/api/crm/contact",  contactRouter);
    app.use("/api/crm/person", authorize, personRouter);
    app.use("/api/crm/phone", authorize, phoneRouter);
    app.use("/api/crm/address", authorize, addressRouter);
    app.use("/api/crm/email", authorize, emailRouter);
    app.use("/api/crm/identification", authorize, identificationRouter);
    app.use("/api/crm/occasion", authorize, occasionRouter);
    app.use("/api/crm/relationship", authorize, relationshipRouter);
}
